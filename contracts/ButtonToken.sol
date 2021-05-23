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
 * @title The Button ERC20 token
 *
 * @dev The ButtonToken is a rebasing wrapper for fixed balance ERC-20 tokens.
 *      Public balances are elastic and are called "buttons".
 *      Internal balances are fixed and are called "bits".
 *
 *      TODO -- write more and add natspec doc
 *
 */
contract ButtonToken is IERC20, IERC20Detailed, Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // ERC-20 identity attributes:
    string private _name;
    string private _symbol;

    // ERC20 variables:
    uint256 private _totalBitSupply;
    mapping(address => uint256) private _bitBalances;
    mapping(address => mapping(address => uint256)) private _allowedButtons;

    // The reference to the underlying asset.
    address public immutable asset;

    // Button token attributes:
    // Most recent price recorded from the price oracle.
    uint256 public currentPrice;

    // The when the most recent price was updated.
    uint256 public lastUpdateTimestampSec;


    // Button token hyper-parameters:
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

    // admin actions
    function setPriceOracle(address priceOracle_) public onlyOwner {
        bool dataValid;
        (, dataValid) = IOracle(priceOracle_).getData();
        require(dataValid, "ButtonToken: unable to fetch data from oracle");

        priceOracle = priceOracle_;
    }

    function setMinUpdateIntervalSec(uint256 minUpdateIntervalSec_) public onlyOwner {
        minUpdateIntervalSec = minUpdateIntervalSec_;
    }

    // erc20 attributes
    function name() external view override returns (string memory) {
        return _name;
    }

    function symbol() external view override returns (string memory) {
        return _symbol;
    }

    function decimals() external view override returns (uint8) {
        return IERC20Detailed(asset).decimals();
    }

    // erc20 view methods
    function totalSupply() external view override returns (uint256) {
        return bitsToButtons(_totalBitSupply, _getOraclePrice());
    }

    function balanceOf(address account) external view override returns (uint256) {
        return bitsToButtons(_bitBalances[account], _getOraclePrice());
    }

    function allowance(address owner, address spender) external view override returns (uint256) {
        return _allowedButtons[owner][spender];
    }

    // rebase token view methods
    function scaledTotalSupply() external view returns (uint256) {
        return _totalBitSupply;
    }

    function scaledBalanceOf(address account) external view returns (uint256) {
        return _bitBalances[account];
    }

    // button view methods
    function getOraclePrice() public view returns (uint256) {
        return _getOraclePrice();
    }

    // erc20 methods
    function transfer(address to, uint256 buttons)
        external
        override
        validRecipient(to)
        afterPriceUpdate
        returns (bool)
    {
        uint256 bits = buttonsToBits(buttons, currentPrice);

        _bitBalances[msg.sender] = _bitBalances[msg.sender].sub(bits);
        _bitBalances[to] = _bitBalances[to].add(bits);

        emit Transfer(msg.sender, to, buttons);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 buttons
    ) external override validRecipient(to) afterPriceUpdate returns (bool) {
        _allowedButtons[from][msg.sender] = _allowedButtons[from][msg.sender].sub(buttons);

        uint256 bits = buttonsToBits(buttons, currentPrice);

        _bitBalances[from] = _bitBalances[from].sub(bits);
        _bitBalances[to] = _bitBalances[to].add(bits);

        emit Transfer(from, to, buttons);
        return true;
    }

    function approve(address spender, uint256 buttons) external override returns (bool) {
        _allowedButtons[msg.sender][spender] = buttons;

        emit Approval(msg.sender, spender, buttons);
        return true;
    }

    function increaseAllowance(address spender, uint256 addedButtons) external returns (bool) {
        _allowedButtons[msg.sender][spender] = _allowedButtons[msg.sender][spender].add(
            addedButtons
        );

        emit Approval(msg.sender, spender, _allowedButtons[msg.sender][spender]);
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedButtons) external returns (bool) {
        if (subtractedButtons >= _allowedButtons[msg.sender][spender]) {
            _allowedButtons[msg.sender][spender] = 0;
        } else {
            _allowedButtons[msg.sender][spender] = _allowedButtons[msg.sender][spender].sub(
                subtractedButtons
            );
        }

        emit Approval(msg.sender, spender, _allowedButtons[msg.sender][spender]);
        return true;
    }

    // rebase token transfer methods
    function transferAll(address to) external validRecipient(to) afterPriceUpdate returns (bool) {
        uint256 buttons = bitsToButtons(_bitBalances[msg.sender], currentPrice);

        delete _bitBalances[msg.sender];
        _bitBalances[to] = _bitBalances[to].add(_bitBalances[msg.sender]);

        emit Transfer(msg.sender, to, buttons);
        return true;
    }

    function transferAllFrom(address from, address to)
        external
        validRecipient(to)
        afterPriceUpdate
        returns (bool)
    {
        uint256 buttons = bitsToButtons(_bitBalances[from], currentPrice);

        _allowedButtons[from][msg.sender] = _allowedButtons[from][msg.sender].sub(buttons);

        delete _bitBalances[from];
        _bitBalances[to] = _bitBalances[to].add(_bitBalances[from]);

        emit Transfer(from, to, buttons);
        return true;
    }

    // button methods
    function deposit(uint256 bits) public afterPriceUpdate {
        require(priceOracle != address(0),
            "ButtonToken: price oracle not setup");

        IERC20(asset).safeTransferFrom(msg.sender, address(this), bits);

        _totalBitSupply = _totalBitSupply.add(bits);
        _bitBalances[msg.sender] = _bitBalances[msg.sender].add(bits);

        uint256 buttons = bitsToButtons(bits, currentPrice);
        emit Transfer(address(0), msg.sender, buttons);
    }

    function withdraw(uint256 bits) public afterPriceUpdate {
        require(_bitBalances[msg.sender] >= bits,
            "ButtonToken: burn amount exceeds balance");

        _bitBalances[msg.sender] = _bitBalances[msg.sender].sub(bits);
        _totalBitSupply = _totalBitSupply.sub(bits);

        uint256 buttons = bitsToButtons(bits, currentPrice);
        emit Transfer(msg.sender, address(0), buttons);

        IERC20(asset).safeTransfer(msg.sender, bits);
    }

    // private methods
    function bitsToButtons(uint256 bits, uint256 price) private pure returns (uint256) {
        return price.mul(bits).div(10**ORACLE_PRICE_DECIMALS);
    }

    function buttonsToBits(uint256 buttons, uint256 price) private pure returns (uint256) {
        return buttons.mul(10**ORACLE_PRICE_DECIMALS).div(price);
    }

    function _updatePrice() private {
        if (block.timestamp.sub(lastUpdateTimestampSec) < minUpdateIntervalSec) {
            return;
        }

        currentPrice = _getOraclePrice();
        lastUpdateTimestampSec = block.timestamp;
    }

    function _getOraclePrice() private view returns (uint256) {
        uint256 newPrice;
        bool dataValid;
        (newPrice, dataValid) = IOracle(priceOracle).getData();
        return (dataValid ? newPrice : currentPrice);
    }
}
