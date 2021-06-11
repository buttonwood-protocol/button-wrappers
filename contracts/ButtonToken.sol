// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.4;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";

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
 *      An oracle provides contract the current USD price for 1 unit of the collateral asset.
 *      CRITICAL: eg) if price of 1 BTC is 33k USD and BTC ERC20 has 18 decimals
 *                    then 1 unit of collateral is 0.000000000000000001
 *                    and oracle price should be 0.000000000000033 USD
 *                        or "3300000" in fixed point with 20 PRICE_DECIMALS.
 *
 *      The ButtonToken math is almost identical to Ampleforth's μFragments.
 *
 *      For AMPL, internal balances are represented using `gons` and
 *          -> internal account balance     `_gonBalances[account]`
 *          -> internal supply scalar       `gonsPerFragment = TOTAL_GONS / _totalSupply`
 *          -> public balance               `_gonBalances[account] * gonsPerFragment`
 *          -> public total supply          `_totalSupply`
 *
 *      In our case internal balances are stored as 'shares'.
 *          -> unit collateral price     `p_u = price / 10 ^ (PRICE_DECIMALS)`
 *          -> collateral deposited      `_totalDeposits`
 *          -> internal account balance  `_shareBalances[account]`
 *          -> internal supply scalar    `_sharesPerUnitToken = TOTAL_SHARES / (MAX_COLLATERAL*p_u)`
 *                                       `  = SHARES_PER_UNIT_COLLATERAL*(10^PRICE_DECIMALS)/price`
 *                                       `  = PRICE_SHARES / price`
 *          -> user's collateral balance `(_shareBalances[account] / SHARES_PER_UNIT_COLLATERAL`
 *          -> public balance            `_shareBalances[account] * _sharesPerUnitToken`
 *          -> public total supply       `_totalDeposits * p_u`
 *
 *
 *
 */
contract ButtonToken is IERC20, IERC20Detailed, Ownable {
    // PLEASE READ BEFORE CHANGING ANY ACCOUNTING OR MATH
    // Similar to AMPL, we make the following guarantees:
    // - If address 'A' mints x button tokens. A's resulting external balance will
    //   increase precisely x button tokens.
    // - If address 'A' burns x button tokens. A's resulting external balance will
    //   decrease precisely x button tokens.
    // - If address 'A' transfers x button tokens to address 'B'.
    //   A's resulting external balance will be decreased by precisely x button tokens,
    //   and B's external balance will be precisely increased by x button tokens.
    //
    // We do not guarantee that the sum of all balances equals the result of calling totalSupply().
    // This is because, for any conversion function 'f()' that has non-zero rounding error,
    // f(x0) + f(x1) + ... + f(xn) is not always equal to f(x0 + x1 + ... xn).
    //
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    //--------------------------------------------------------------------------
    // Token Constants
    // Say the collateral token has 18 decimals,
    // The price a unit collateral token 1e-18, has a 2 decimal point precision (1 cent).
    uint256 public constant PRICE_DECIMALS = 20;

    // Math constants
    uint256 private constant MAX_UINT256 = type(uint256).max;

    // The maximum units of collateral that can be deposited into this contract
    // ie) for a collateral token with 18 decimals, MAX_COLLATERAL is 1B tokens.
    uint256 public constant MAX_COLLATERAL = (10**27);

    // TOTAL_SHARES is a multiple of MAX_COLLATERAL so that
    // {SHARES_PER_UNIT_COLLATERAL} is an integer.
    // Use the highest value that fits in a uint256 for max granularity.
    uint256 public constant TOTAL_SHARES = MAX_UINT256 - (MAX_UINT256 % MAX_COLLATERAL);

    // Number of SHARES per unit of collateral
    uint256 public constant SHARES_PER_UNIT_COLLATERAL = TOTAL_SHARES / MAX_COLLATERAL;

    // Number of SHARES per unit of collateral * (1 USD)
    uint256 public constant PRICE_SHARES = SHARES_PER_UNIT_COLLATERAL * (10**PRICE_DECIMALS);

    // TRUE_MAX_PRICE = maximum integer < (sqrt(4*PRICE_SHARES + 1) - 1) / 2
    // Setting MAX_PRICE to the closest two power which is just under TRUE_MAX_PRICE
    uint256 private constant MAX_PRICE = (2**115 - 1); // (2^115) - 1

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

    // ratio of total shares to total tokens
    uint256 public _sharesPerUnitToken;

    // Shares of the collateral pool issued per account
    mapping(address => uint256) public _accountShares;

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
        // PRICE_DECIMALS has been fixed to 20, which means that
        // For a unit collateral (0.000000000000000001 with 18 decimals),
        // price can be at most 0.01 USD.
        //
        // NOTE: If the collateral token has more than 18 decimals,
        // PRICE_DECIMALS has to be increased
        // and MAX_PRICE and MAX_COLLATERAL need to be recalculated.
        require(IERC20Detailed(asset_).decimals() <= 18, "ButtonToken: unsupported precision");

        asset = asset_;
        _name = name_;
        _symbol = symbol_;

        minPriceUpdateIntervalSec = 3600; // 1hr

        // MAX_COLLATERAL worth shares are 'pre-mined' to `address(0x)`
        // at the time of construction.
        //
        // During mint, shares are transferred from `address(0x)`
        // and during burn, shares are transferred back to `address(0x)`.
        //
        // No more than MAX_COLLATERAL can be deposited into the ButtonToken contract.
        _accountShares[address(0)] = TOTAL_SHARES;

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
        uint256 sharesPerUnitToken = PRICE_SHARES.div(price);
        return _activeShares().div(sharesPerUnitToken);
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
        uint256 sharesPerUnitToken = PRICE_SHARES.div(price);
        return _accountShares[account].div(sharesPerUnitToken);
    }

    /**
     * @return The amount of collateral in the button token contract.
     */
    function scaledTotalSupply() external view returns (uint256) {
        return _activeShares().div(SHARES_PER_UNIT_COLLATERAL);
    }

    /**
     * @param account The address to query.
     * @return The amount of collateral deposited by the account.
     */
    function scaledBalanceOf(address account) external view returns (uint256) {
        if (account == address(0)) {
            return 0;
        }
        return _accountShares[account].div(SHARES_PER_UNIT_COLLATERAL);
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
     * @return The amount of button token units that can be exchanged,
     *         for the given collateral amount.
     */
    function getExchangeRate(uint256 cAmount) external view returns (uint256) {
        uint256 price;
        (, price) = _queryPrice();
        return cAmount.mul(price).div(10**PRICE_DECIMALS);
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
        uint256 shares = amount.mul(_sharesPerUnitToken);

        _accountShares[msg.sender] = _accountShares[msg.sender].sub(shares);
        _accountShares[to] = _accountShares[to].add(shares);

        emit Transfer(msg.sender, to, amount);

        return true;
    }

    /**
     * @dev Transfer all of the {msg.sender}'s button tokens to a specified address.
     * @param to The address to transfer to.
     * @return True on success, false otherwise.
     */
    function transferAll(address to) external validRecipient(to) onAfterRebase returns (bool) {
        uint256 shares = _accountShares[msg.sender];
        uint256 amount = shares.div(_sharesPerUnitToken);

        delete _accountShares[msg.sender];
        _accountShares[to] = _accountShares[to].add(shares);

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
        uint256 shares = amount.mul(_sharesPerUnitToken);

        _allowances[from][msg.sender] = _allowances[from][msg.sender].sub(amount);

        _accountShares[from] = _accountShares[from].sub(shares);
        _accountShares[to] = _accountShares[to].add(shares);

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
        uint256 shares = _accountShares[from];
        uint256 amount = shares.div(_sharesPerUnitToken);

        _allowances[from][msg.sender] = _allowances[from][msg.sender].sub(amount);

        delete _accountShares[from];
        _accountShares[to] = _accountShares[to].add(shares);

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
    function mint(uint256 amount) external onAfterRebase {
        uint256 mintShares = amount.mul(_sharesPerUnitToken);

        // require(_accountShares[address(0)] > mintShares,
        //      "ButtonToken: cant deposit more than MAX_COLLATERAL");
        _accountShares[address(0)] = _accountShares[address(0)].sub(mintShares);
        _accountShares[msg.sender] = _accountShares[msg.sender].add(mintShares);

        uint256 cAmount = mintShares.div(SHARES_PER_UNIT_COLLATERAL);
        IERC20(asset).safeTransferFrom(msg.sender, address(this), cAmount);

        emit Transfer(address(0), msg.sender, amount);
    }

    /**
     * @dev Burns button tokens from {msg.sender} and transfers collateral back.
     *
     * @param amount The amount of button tokens to be burnt.
     */
    function burn(uint256 amount) external onAfterRebase {
        uint256 burnShares = amount.mul(_sharesPerUnitToken);

        _accountShares[msg.sender] = _accountShares[msg.sender].sub(burnShares);
        _accountShares[address(0)] = _accountShares[address(0)].add(burnShares);

        emit Transfer(msg.sender, address(0), amount);

        uint256 cAmount = burnShares.div(SHARES_PER_UNIT_COLLATERAL);
        IERC20(asset).safeTransfer(msg.sender, cAmount);
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

        _sharesPerUnitToken = PRICE_SHARES.div(price);

        emit Rebase(price);
    }

    /**
     * @dev Returns the active "un-mined" shares
     */
    function _activeShares() private view returns (uint256) {
        return TOTAL_SHARES.sub(_accountShares[address(0)]);
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
}
