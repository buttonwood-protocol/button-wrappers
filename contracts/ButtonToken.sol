// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.4;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Detailed} from "./interfaces/IERC20Detailed.sol";
import {IOracle} from "./interfaces/IOracle.sol";

/**
 * @title The ButtonToken ERC20 wrapper.
 *
 * @dev The ButtonToken is a rebasing wrapper for fixed balance ERC-20 tokens.
 *      Users deposit a collateral asset and are minted button tokens with elastic
 *      balances which change up or down when the value of the collateral changes.
 *
 *
 *      The ButtonToken math is almost identical to Ampleforth's μFragments.
 *
 *      For AMPL, internal balances are represented using `gons` and
 *          -> internal account balance     `_gonBalances[account]`
 *          -> internal supply scalar       `gonsPerFragment = TOTAL_GONS / _totalSupply`
 *          -> public balance               `_gonBalances[account] * gonsPerFragment`
 *          -> public total supply          `_totalSupply`
 *
 *      In our case internal balances are stored as 'bits'.
 *          -> unit collateral price     `p_u = price / 10 ^ (PRICE_DECIMALS)`
 *          -> collateral deposited      `_totalDeposits`
 *          -> internal account balance  `_accountBits[account]`
 *          -> internal supply scalar    `_bitsPerUnitToken = TOTAL_BITS / (MAX_COLLATERAL*p_u)`
 *                                       `  = BITS_PER_UNIT_COLLATERAL*(10^PRICE_DECIMALS)/price`
 *                                       `  = PRICE_BITS / price`
 *          -> user's collateral balance `(_accountBits[account] / BITS_PER_UNIT_COLLATERAL`
 *          -> public balance            `_accountBits[account] * _bitsPerUnitToken`
 *          -> public total supply       `_totalDeposits * p_u`
 *
 *
 *      NOTE: Since the button token tries to keep the same number of decimal places as the
 *      underlying collateral, converting from collateral amount to button token amount
 *      and back is not loss-less.
 *
 */
contract ButtonToken is IERC20, IERC20Detailed, Ownable {
    // PLEASE READ BEFORE CHANGING ANY ACCOUNTING OR MATH
    // We make the following guarantees:
    // - If address 'A' transfers x button tokens to address 'B'.
    //   A's resulting external balance will be decreased by "precisely" x button tokens,
    //   and B's external balance will be "precisely" increased by x button tokens.
    // - If address 'A' mints x button tokens.
    //   A's resulting external balance will increase by "precisely" x button tokens.
    // - If address 'A' burns x button tokens.
    //   A's resulting external balance will decrease by "precisely" x button tokens.
    // - If the current quoted `exchangeRate` from collateral amount to button tokens
    //   is x:y, then any address will be able to mint/burn "precisely" y button tokens for
    //   "at the most" x collateral tokens.
    //
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    //--------------------------------------------------------------------------
    // Token Constants
    // The price has a 8 decimal point precision.
    uint256 public constant PRICE_DECIMALS = 8;

    // Math constants
    uint256 private constant MAX_UINT256 = type(uint256).max;

    // The maximum units of collateral that can be deposited into this contract
    // ie) for a collateral token with 18 decimals, MAX_COLLATERAL is 1B tokens.
    uint256 public constant MAX_COLLATERAL = 1_000_000_000e18;

    // TOTAL_BITS is a multiple of MAX_COLLATERAL so that
    // {BITS_PER_UNIT_COLLATERAL} is an integer and.
    // Use the highest value that fits in a uint256 for max granularity.
    uint256 private constant TOTAL_BITS = MAX_UINT256 - (MAX_UINT256 % MAX_COLLATERAL);

    // Number of BITS per unit of collateral
    uint256 private constant BITS_PER_UNIT_COLLATERAL = TOTAL_BITS / MAX_COLLATERAL;

    // Number of BITS per unit of collateral * (1 USD)
    uint256 private constant PRICE_BITS = BITS_PER_UNIT_COLLATERAL * (10**PRICE_DECIMALS);

    // TRUE_MAX_PRICE = maximum integer < (sqrt(4*PRICE_BITS + 1) - 1) / 2
    // Setting MAX_PRICE to the closest two power which is just under TRUE_MAX_PRICE
    uint256 public constant MAX_PRICE = (2**96 - 1); // (2^96) - 1

    //--------------------------------------------------------------------------
    // ButtonToken attributes

    // The reference to the underlying asset.
    address public immutable asset;

    // The reference to the price oracle which feeds in the
    // price of the underlying asset.
    address public priceOracle;

    // Most recent price recorded from the price oracle.
    uint256 public currentPrice;

    // The when the most recent price was updated.
    uint256 public lastPriceUpdateTimestampSec;

    // The minimum time to be elapsed before reading a new price from the oracle.
    uint256 public minPriceUpdateIntervalSec;

    //--------------------------------------------------------------------------
    // ERC-20 identity attributes
    string private _name;
    string private _symbol;

    // internal balance, bits issued per account
    mapping(address => uint256) private _accountBits;

    // ERC20 allowances
    mapping(address => mapping(address => uint256)) private _allowances;

    //--------------------------------------------------------------------------
    // Events
    event Rebase(uint256 newPrice);
    event PriceOracleUpdated(address priceOracle);

    //--------------------------------------------------------------------------
    // Modifiers
    modifier validRecipient(address to) {
        require(to != address(0x0), "ButtonToken: recipient zero address");
        require(to != address(this), "ButtonToken: recipient token address");
        _;
    }

    modifier onAfterRebase() {
        uint256 price;
        bool dirty;
        (dirty, price) = _queryPrice();
        if (dirty) {
            _rebase(price);
        }
        _;
    }

    //--------------------------------------------------------------------------
    constructor(
        address asset_,
        string memory name_,
        string memory symbol_,
        address priceOracle_
    ) {
        // NOTE: If the collateral token has more than 18 decimals,
        // MAX_PRICE and MAX_COLLATERAL need to be recalculated.
        require(IERC20Detailed(asset_).decimals() <= 18, "ButtonToken: unsupported precision");

        asset = asset_;
        _name = name_;
        _symbol = symbol_;

        minPriceUpdateIntervalSec = 3600; // 1hr

        // MAX_COLLATERAL worth bits are 'pre-mined' to `address(0x)`
        // at the time of construction.
        //
        // During mint, bits are transferred from `address(0x)`
        // and during burn, bits are transferred back to `address(0x)`.
        //
        // No more than MAX_COLLATERAL can be deposited into the ButtonToken contract.
        _accountBits[address(0)] = TOTAL_BITS;

        resetPriceOracle(priceOracle_);
    }

    //--------------------------------------------------------------------------
    // ADMIN actions

    /**
     * @dev Update reference to the price oracle contract and resets price.
     * @param priceOracle_ The address of the new price oracle.
     */
    function resetPriceOracle(address priceOracle_) public onlyOwner {
        uint256 price;
        bool v;
        (price, v) = IOracle(priceOracle_).getData();
        require(v, "ButtonToken: unable to fetch data from oracle");

        priceOracle = priceOracle_;
        emit PriceOracleUpdated(priceOracle);

        _rebase(price);
    }

    /**
     * @dev Sets the minPriceUpdateIntervalSec hyper-parameter.
     * @param minPriceUpdateIntervalSec_ The new price update interval.
     */
    function setMinUpdateIntervalSec(uint256 minPriceUpdateIntervalSec_) public onlyOwner {
        minPriceUpdateIntervalSec = minPriceUpdateIntervalSec_;
    }

    //--------------------------------------------------------------------------
    // ERC20 description attributes

    /**
     * @dev Returns the name of the token.
     */
    function name() external view override returns (string memory) {
        return _name;
    }

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() external view override returns (string memory) {
        return _symbol;
    }

    /**
     * @dev Returns the number of decimals used to get its user representation.
     * For example, if `decimals` equals `2`, a balance of `505` tokens should
     * be displayed to a user as `5,05` (`505 / 10 ** 2`).
     *
     * NOTE: This information is only used for _display_ purposes: it in
     * no way affects any of the arithmetic of the contract, including
     * {IERC20-balanceOf} and {IERC20-transfer}.
     */
    function decimals() external view override returns (uint8) {
        return IERC20Detailed(asset).decimals();
    }

    //--------------------------------------------------------------------------
    // ERC-20 token view methods

    /**
     * @return The total supply of button tokens.
     */
    function totalSupply() external view override returns (uint256) {
        uint256 price;
        (, price) = _queryPrice();
        return _bitsToAmount(_activeBits(), price);
    }

    /**
     * @return The account's elastic button token balance.
     */
    function balanceOf(address account) external view override returns (uint256) {
        if (account == address(0)) {
            return 0;
        }
        uint256 price;
        (, price) = _queryPrice();
        return _bitsToAmount(_accountBits[account], price);
    }

    /**
     * @return The amount of collateral in the button token contract.
     */
    function scaledTotalSupply() external view returns (uint256) {
        return _bitsToCAmount(_activeBits());
    }

    /**
     * @param account The address to query.
     * @return The amount of collateral deposited by the account.
     */
    function scaledBalanceOf(address account) external view returns (uint256) {
        if (account == address(0)) {
            return 0;
        }
        return _bitsToCAmount(_accountBits[account]);
    }

    /**
     * @dev Function to check the amount of button tokens that an owner has allowed to a spender.
     * @param owner_ The address which owns the funds.
     * @param spender The address which will spend the funds.
     * @return The number of button tokens still available for the spender.
     */
    function allowance(address owner_, address spender) external view override returns (uint256) {
        return _allowances[owner_][spender];
    }

    //--------------------------------------------------------------------------
    // ButtonToken view methods
    /**
     * @return The amount of button tokens that can be exchanged,
     *         for the given collateral amount.
     */
    function exchangeRate(uint256 cAmount) external view returns (uint256) {
        uint256 price;
        (, price) = _queryPrice();
        // Note: Picking the min ensures that:
        // when going from {cAmount} to {amount} to {cAmount'} that {cAmount'} <= {cAmount}
        uint256 bits =
            Math.min(
                _cAmountToBits(cAmount),
                _amountToBits(_cAmountToAmount(cAmount, price), price)
            );
        return _bitsToAmount(bits, price);
    }

    //--------------------------------------------------------------------------
    // ERC-20 write methods

    /**
     * @dev Transfer {msg.sender}'s button tokens to a specified address.
     * @param to The address to transfer to.
     * @param amount The amount of button tokens to be transferred.
     * @return True on success, false otherwise.
     */
    function transfer(address to, uint256 amount)
        external
        override
        validRecipient(to)
        onAfterRebase
        returns (bool)
    {
        uint256 bits = _amountToBits(amount, currentPrice);

        _accountBits[msg.sender] = _accountBits[msg.sender].sub(bits);
        _accountBits[to] = _accountBits[to].add(bits);
        _clearDust(msg.sender, currentPrice);

        emit Transfer(msg.sender, to, amount);

        return true;
    }

    /**
     * @dev Transfer all of the {msg.sender}'s button tokens to a specified address.
     * @param to The address to transfer to.
     * @return True on success, false otherwise.
     */
    function transferAll(address to) external validRecipient(to) onAfterRebase returns (bool) {
        uint256 bits = _accountBits[msg.sender];
        uint256 amount = _bitsToAmount(bits, currentPrice);

        delete _accountBits[msg.sender];
        _accountBits[to] = _accountBits[to].add(bits);

        emit Transfer(msg.sender, to, amount);

        return true;
    }

    /**
     * @dev Transfer button tokens from one address to another.
     * @param from The address you want to send button tokens from.
     * @param to The address you want to transfer to.
     * @param amount The amount of button tokens to be transferred.
     */
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external override validRecipient(to) onAfterRebase returns (bool) {
        uint256 bits = _amountToBits(amount, currentPrice);

        _allowances[from][msg.sender] = _allowances[from][msg.sender].sub(amount);

        _accountBits[from] = _accountBits[from].sub(bits);
        _accountBits[to] = _accountBits[to].add(bits);
        _clearDust(msg.sender, currentPrice);

        emit Transfer(from, to, amount);

        return true;
    }

    /**
     * @dev Transfer all button tokens from one address to another.
     * @param from The address you want to send button tokens from.
     * @param to The address you want to transfer to.
     */
    function transferAllFrom(address from, address to)
        external
        validRecipient(to)
        onAfterRebase
        returns (bool)
    {
        uint256 bits = _accountBits[from];
        uint256 amount = _bitsToAmount(bits, currentPrice);

        _allowances[from][msg.sender] = _allowances[from][msg.sender].sub(amount);

        delete _accountBits[from];
        _accountBits[to] = _accountBits[to].add(bits);

        emit Transfer(from, to, amount);

        return true;
    }

    /**
     * @dev Approve the passed address to spend the specified amount of button tokens on behalf of
     * `msg.sender`. This method is included for ERC20 compatibility.
     * increaseAllowance and decreaseAllowance should be used instead.
     * Changing an allowance with this method brings the risk that someone may transfer both
     * the old and the new allowance - if they are both greater than zero - if a transfer
     * transaction is mined before the later approve() call is mined.
     * Approvals are denominated in button tokens and NOT the collateral amount.
     * They DO NOT change with underlying balances.
     *
     * @param spender The address which will spend the funds.
     * @param amount The amount of button tokens to be spent.
     */
    function approve(address spender, uint256 amount) external override returns (bool) {
        _allowances[msg.sender][spender] = amount;

        emit Approval(msg.sender, spender, amount);
        return true;
    }

    /**
     * @dev Increase the amount of button tokens that an owner has allowed to a spender.
     * This method should be used instead of approve() to avoid the double approval vulnerability
     * described above.
     * @param spender The address which will spend the funds.
     * @param addedAmount The amount of button tokens to increase the allowance by.
     */
    function increaseAllowance(address spender, uint256 addedAmount) external returns (bool) {
        _allowances[msg.sender][spender] = _allowances[msg.sender][spender].add(addedAmount);

        emit Approval(msg.sender, spender, _allowances[msg.sender][spender]);
        return true;
    }

    /**
     * @dev Decrease the amount of button tokens that an owner has allowed to a spender.
     *
     * @param spender The address which will spend the funds.
     * @param subtractedAmount The amount of button tokens to decrease the allowance by.
     */
    function decreaseAllowance(address spender, uint256 subtractedAmount) external returns (bool) {
        if (subtractedAmount >= _allowances[msg.sender][spender]) {
            _allowances[msg.sender][spender] = 0;
        } else {
            _allowances[msg.sender][spender] = _allowances[msg.sender][spender].sub(
                subtractedAmount
            );
        }

        emit Approval(msg.sender, spender, _allowances[msg.sender][spender]);
        return true;
    }

    //--------------------------------------------------------------------------
    // ButtonToken write methods
    /**
     * @dev Helper method to manually trigger rebase
     */
    function rebase() external onAfterRebase {
        return;
    }

    /**
     * @dev Transfers collateral from {msg.sender} to the contract and mints button tokens.
     *
     * @param amount The amount of button tokens to be mint.
     */
    function mint(uint256 amount) external onAfterRebase returns (uint256) {
        uint256 bits = _calcMintBits(_accountBits[msg.sender], amount, currentPrice);
        uint256 cAmount = _bitsToCAmount(bits);

        require(bits > 0 && cAmount > 0, "ButtonToken: too few button tokens to mint");

        require(
            _accountBits[address(0)] > bits,
            "ButtonToken: cant deposit more than MAX_COLLATERAL"
        );

        _accountBits[address(0)] = _accountBits[address(0)].sub(bits);
        _accountBits[msg.sender] = _accountBits[msg.sender].add(bits);

        IERC20(asset).safeTransferFrom(msg.sender, address(this), cAmount);

        emit Transfer(address(0), msg.sender, amount);

        return cAmount;
    }

    /**
     * @dev Burns button tokens from {msg.sender} and transfers collateral back.
     *
     * @param amount The amount of button tokens to be burnt.
     */
    function burn(uint256 amount) external onAfterRebase returns (uint256) {
        uint256 bits = _amountToBits(amount, currentPrice);
        uint256 cAmount = _bitsToCAmount(bits);

        require(bits > 0 && cAmount > 0, "ButtonToken: too few button tokens to burn");

        _accountBits[msg.sender] = _accountBits[msg.sender].sub(bits);
        _accountBits[address(0)] = _accountBits[address(0)].add(bits);
        _clearDust(msg.sender, currentPrice);

        emit Transfer(msg.sender, address(0), amount);

        IERC20(asset).safeTransfer(msg.sender, cAmount);

        return cAmount;
    }

    /**
     * @dev Burns all button tokens from {msg.sender} and transfers collateral back.
     */
    function burnAll() external onAfterRebase returns (uint256) {
        uint256 bits = _accountBits[msg.sender];
        uint256 cAmount = _bitsToCAmount(bits);

        require(bits > 0, "ButtonToken: too few button tokens to burn");

        delete _accountBits[msg.sender];
        _accountBits[address(0)] = _accountBits[address(0)].add(bits);

        uint256 amount = _bitsToAmount(bits, currentPrice);
        emit Transfer(msg.sender, address(0), amount);

        IERC20(asset).safeTransfer(msg.sender, cAmount);

        return cAmount;
    }

    //--------------------------------------------------------------------------
    // Private methods
    /**
     * @dev Updates the `currentPrice` and recomputes the internal scalar.
     */
    function _rebase(uint256 price) private {
        if (price > MAX_PRICE) {
            price = MAX_PRICE;
        }

        currentPrice = price;
        lastPriceUpdateTimestampSec = block.timestamp;

        emit Rebase(price);
    }

    /**
     * @dev Cleans up dust bits from a given address.
     */
    function _clearDust(address from, uint256 price) private {
        uint256 dustBits = _accountBits[from];
        // less than 1 token worth bits
        if (dustBits < _bitsPerUnitToken(price)) {
            delete _accountBits[from];
            _accountBits[address(0)] = _accountBits[address(0)].add(dustBits);
        }
    }

    /**
     * @dev Returns the active "un-mined" bits
     */
    function _activeBits() public view returns (uint256) {
        return TOTAL_BITS.sub(_accountBits[address(0)]);
    }

    /**
     * @dev Queries the oracle for the latest price
     *      If sufficient time hasn't elapsed since the last pull,
     *      returns the current price,
     *      else If fetched oracle price isn't valid returns the current price,
     *      else returns the fetched oracle price oracle price.
     */
    function _queryPrice() private view returns (bool, uint256) {
        if (block.timestamp.sub(lastPriceUpdateTimestampSec) < minPriceUpdateIntervalSec) {
            return (false, currentPrice);
        }

        uint256 price;
        bool dataValid;
        (price, dataValid) = IOracle(priceOracle).getData();
        if (!dataValid) {
            return (false, currentPrice);
        }

        return (true, price);
    }

    /**
     * @dev Calculate bits to mint based on existing.
     */
    function _calcMintBits(
        uint256 existing,
        uint256 amount,
        uint256 price
    ) private pure returns (uint256) {
        uint256 mintBits = _amountToBits(amount, price);
        uint256 afterMint = existing.add(mintBits);
        return mintBits.sub(afterMint.mod(_bitsPerUnitToken(price)));
    }

    /**
     * @dev Convert button token amount to bits.
     */
    function _amountToBits(uint256 amount, uint256 price) private pure returns (uint256) {
        return amount.mul(_bitsPerUnitToken(price));
    }

    /**
     * @dev Convert collateral amount to bits.
     */
    function _cAmountToBits(uint256 cAmount) private pure returns (uint256) {
        return cAmount.mul(BITS_PER_UNIT_COLLATERAL);
    }

    /**
     * @dev Convert bits to button token amount.
     */
    function _bitsToAmount(uint256 bits, uint256 price) private pure returns (uint256) {
        return bits.div(_bitsPerUnitToken(price));
    }

    /**
     * @dev Convert bits to collateral amount.
     */
    function _bitsToCAmount(uint256 bits) private pure returns (uint256) {
        return bits.div(BITS_PER_UNIT_COLLATERAL);
    }

    /**
     * @dev Convert collateral amount to button token amount.
     */
    function _cAmountToAmount(uint256 cAmount, uint256 price) private pure returns (uint256) {
        return cAmount.mul(price).div(10**PRICE_DECIMALS);
    }

    /**
     * @dev Internal scalar to convert bits to button tokens.
     */
    function _bitsPerUnitToken(uint256 price) private pure returns (uint256) {
        return PRICE_BITS.div(price);
    }
}
