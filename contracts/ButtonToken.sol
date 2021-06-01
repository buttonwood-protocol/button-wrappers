// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.4;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Detailed} from "./interfaces/IERC20Detailed.sol";

interface IOracle {
    function getData() external view returns (uint256, bool);
}

/**
 * @title The ButtonToken ERC20 wrapper.
 *
 * @dev The ButtonToken is a rebasing wrapper for fixed balance ERC-20 tokens.
 *      Token balances are elastic and change up or down when the value of the
 *      underlying collateral changes. An oracle informs the token about the
 *      value of the collateral held.
 *
 *      FYI: cAmount -> "collateral" amount
 *           amount  -> "button token" amount
 *
 */
contract ButtonToken is IERC20, IERC20Detailed, Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // ERC-20 identity attributes:
    string private _name;
    string private _symbol;

    // ERC20 variables:
    uint256 private _totalCollateral;
    mapping(address => uint256) private _collateralBalances;
    mapping(address => mapping(address => uint256)) private _allowances;

    // The reference to the underlying asset.
    address public immutable asset;

    // ButtonToken attributes:
    // Most recent price recorded from the price oracle.
    uint256 public currentPrice;

    // The when the most recent price was updated.
    uint256 public lastUpdateTimestampSec;

    // ButtonToken hyper-parameters:
    // The reference to the price oracle which feeds in the price of the underlying asset.
    address public priceOracle;

    // The minimum time to be elapsed before reading a new price from the oracle.
    uint256 public minUpdateIntervalSec;

    // Constants:
    uint256 public constant ORACLE_PRICE_DECIMALS = 8;

    // Modifiers:
    modifier validRecipient(address to) {
        require(to != address(0x0), "ButtonToken: recipient zero address");
        require(to != address(this), "ButtonToken: recipient token address");
        _;
    }

    modifier validOracleSetup() {
        require(priceOracle != address(0), "ButtonToken: price oracle not setup");
        _;
    }

    modifier afterPriceUpdate() {
        _updatePrice();
        _;
    }

    constructor(
        address asset_,
        string memory name_,
        string memory symbol_
    ) {
        asset = asset_;
        _name = name_;
        _symbol = symbol_;
    }

    // Administrative actions

    /**
     * @dev Sets reference to the price oracle contract.
     * @param priceOracle_ The address of the new price oracle.
     */
    function setPriceOracle(address priceOracle_) public onlyOwner {
        bool dataValid;
        (, dataValid) = IOracle(priceOracle_).getData();
        require(dataValid, "ButtonToken: unable to fetch data from oracle");

        priceOracle = priceOracle_;
    }

    /**
     * @dev Sets the minUpdateIntervalSec hyper-parameter.
     * @param minUpdateIntervalSec_ The new price update interval.
     */
    function setMinUpdateIntervalSec(uint256 minUpdateIntervalSec_) public onlyOwner {
        minUpdateIntervalSec = minUpdateIntervalSec_;
    }

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

    // ERC-20 token view methods

    /**
     * @return The total supply of button tokens.
     */
    function totalSupply() external view override returns (uint256) {
        return _collateralToTokens(_totalCollateral, _getOraclePrice());
    }

    /**
     * @return The amount of collateral in the button token contract.
     */
    function scaledTotalSupply() external view returns (uint256) {
        return _totalCollateral;
    }

    /**
     * @return The account's elastic button token balance.
     */
    function balanceOf(address account) external view override returns (uint256) {
        return _collateralToTokens(_collateralBalances[account], _getOraclePrice());
    }

    /**
     * @param account The address to query.
     * @return The amount of collateral deposited by the account.
     */
    function scaledBalanceOf(address account) external view returns (uint256) {
        return _collateralBalances[account];
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

    // ButtonToken view methods

    /**
     * @return The account's elastic button token balance.
     */
    function getOraclePrice() public view returns (uint256) {
        return _getOraclePrice();
    }

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
        afterPriceUpdate
        returns (bool)
    {
        return _transferCollateral(msg.sender, to,
            _tokensToCollateral(amount, currentPrice),
            currentPrice);
    }

    /**
     * @dev Transfer all of the {msg.sender}'s button tokens to a specified address.
     * @param to The address to transfer to.
     * @return True on success, false otherwise.
     */
    function transferAll(address to) external validRecipient(to) afterPriceUpdate returns (bool) {
        return _transferCollateral(msg.sender, to,
            _collateralBalances[msg.sender],
            currentPrice);
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
    ) external override validRecipient(to) afterPriceUpdate returns (bool) {

        _allowances[from][msg.sender] = _allowances[from][msg.sender].sub(amount);

        return _transferCollateral(msg.sender, to,
            _tokensToCollateral(amount, currentPrice),
            currentPrice);
    }

    /**
     * @dev Transfer all button tokens from one address to another.
     * @param from The address you want to send button tokens from.
     * @param to The address you want to transfer to.
     */
    function transferAllFrom(address from, address to)
        external
        validRecipient(to)
        afterPriceUpdate
        returns (bool)
    {

        uint256 amount = _collateralToTokens(_collateralBalances[from], currentPrice);

        _allowances[from][msg.sender] = _allowances[from][msg.sender].sub(amount);

        return _transferCollateral(msg.sender, to,
            _allowances[from][msg.sender],
            currentPrice);
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
        _allowances[msg.sender][spender] = _allowances[msg.sender][spender].add(
            addedAmount
        );

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


    // ButtonToken write methods

    /**
     * @dev Transfers collateral from {msg.sender} to the contract and mints button tokens.
     *
     * @param amount The amount of collateral to be deposited, dominated in button tokens.
     */
    function deposit(uint256 amount) external afterPriceUpdate validOracleSetup {
        uint256 cAmount = _tokensToCollateral(amount, currentPrice);

        IERC20(asset).safeTransferFrom(msg.sender, address(this), cAmount);

        _mintCollateral(msg.sender, cAmount, currentPrice);
    }

    /**
     * @dev Transfers collateral from {msg.sender} to the contract and mints button tokens.
     *
     * @param cAmount The amount of collateral to be deposited.
     */
    function depositCollateral(uint256 cAmount) external afterPriceUpdate validOracleSetup {
        IERC20(asset).safeTransferFrom(msg.sender, address(this), cAmount);

        _mintCollateral(msg.sender, cAmount, currentPrice);
    }

    /**
     * @dev Burns button tokens from {msg.sender} and transfers collateral back.
     *
     * @param amount The amount of collateral to be released, dominated in button tokens.
     */
    function withdraw(uint256 amount) external afterPriceUpdate {
        uint256 cAmount = _tokensToCollateral(amount, currentPrice);

        _burnCollateral(msg.sender, cAmount, currentPrice);

        IERC20(asset).safeTransfer(msg.sender, cAmount);
    }

    /**
     * @dev Burns button tokens from {msg.sender} and transfers collateral back.
     *
     * @param cAmount The amount of collateral to be released.
     */
    function withdrawCollateral(uint256 cAmount) external afterPriceUpdate {
        _burnCollateral(msg.sender, cAmount, currentPrice);

        IERC20(asset).safeTransfer(msg.sender, cAmount);
    }

    /**
     * @dev Burns all button tokens from {msg.sender} and transfers collateral back.
     */
    function withdrawAll() external afterPriceUpdate {
        _burnCollateral(msg.sender, _collateralBalances[msg.sender], currentPrice);

        IERC20(asset).safeTransfer(msg.sender, _collateralBalances[msg.sender]);
    }

    // Private methods
    /**
     * @dev Internal book-keeping to transfer between tow accounts.
     */
    function _transferCollateral(address from, address to, uint256 cAmount, uint256 price) private returns (bool) {
        _collateralBalances[from] = _collateralBalances[from].sub(cAmount);
        _collateralBalances[to] = _collateralBalances[to].add(cAmount);

        emit Transfer(msg.sender, to,
            _collateralToTokens(cAmount, price));

        return true;
    }

    /**
     * @dev Internal book-keeping to mint tokens.
     */
    function _mintCollateral(address to, uint256 cAmount, uint256 price) private {
        _totalCollateral = _totalCollateral.add(cAmount);
        _collateralBalances[to] = _collateralBalances[to].add(cAmount);

        emit Transfer(address(0), to,
            _collateralToTokens(cAmount, price));
    }

    /**
     * @dev Internal book-keeping to burn tokens.
     */
    function _burnCollateral(address from, uint256 cAmount, uint256 price) private {
        _collateralBalances[from] = _collateralBalances[from].sub(cAmount);
        _totalCollateral = _totalCollateral.sub(cAmount);

        emit Transfer(from, address(0),
            _collateralToTokens(cAmount, price));
    }

    /**
     * @dev If sufficient time has elapsed since last fetch,
     *      Fetches the latest oracle price and updates the `currentPrice`.
     */
    function _updatePrice() private {
        if (block.timestamp.sub(lastUpdateTimestampSec) < minUpdateIntervalSec) {
            return;
        }

        currentPrice = _getOraclePrice();
        lastUpdateTimestampSec = block.timestamp;
    }

    /**
     * @dev Fetches the oracle price to be used. If the fetched price is not valid
     *      returns the current price.
     */
    function _getOraclePrice() private view returns (uint256) {
        uint256 newPrice;
        bool dataValid;
        (newPrice, dataValid) = IOracle(priceOracle).getData();
        return (dataValid ? newPrice : currentPrice);
    }

    /**
     * @dev Pure math to calculate token amount from collateral amount.
     */
    function _collateralToTokens(uint256 amount, uint256 price) private pure returns (uint256) {
        return price.mul(amount).div(10**ORACLE_PRICE_DECIMALS);
    }

    /**
     * @dev Pure math to calculate collateral amount from token amount.
     */
    function _tokensToCollateral(uint256 amount, uint256 price) private pure returns (uint256) {
        return amount.mul(10**ORACLE_PRICE_DECIMALS).div(price);
    }
}
