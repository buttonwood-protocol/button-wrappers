pragma solidity 0.8.4;

import "./interfaces/IUnbuttonToken.sol";

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title The UnbuttonToken ERC20 wrapper.
 *
 * @dev The UnbuttonToken wraps elastic balance (rebasing) tokens like
 *      AMPL, Chai and AAVE's aTokens, to create a fixed balance representation.
 *
 *      User's unbutton balances are represented as their "share" of the total deposit pool.
 *
 */
contract UnbuttonToken is IUnbuttonToken, ERC20 {
    using SafeERC20 for IERC20;

    //--------------------------------------------------------------------------
    // Constants

    /// @dev Initial conversion between underlying tokens to unbutton tokens.
    uint256 public constant INITIAL_RATE = 1_000_000;

    /// @dev Small deposit which is locked to the contract to ensure that
    ///      the `totalUnderlying` balance is always non-zero.
    uint256 public constant MINIMUM_DEPOSIT = 1_000;

    // TODO: recauclate this
    /// @dev The maximum units of the underlying token that can be
    ///      safely deposited into this contract without any numeric overflow.
    /// MAX_UNDERLYING = sqrt(MAX_UINT256/INITIAL_RATE)
    uint256 public constant MAX_UNDERLYING = type(uint128).max / 1_000;

    //--------------------------------------------------------------------------
    // Attributes

    /// @inheritdoc IButtonWrapper
    address public immutable override underlying;

    //--------------------------------------------------------------------------

    /// @param underlying_ The underlying ERC20 token address.
    /// @param name_ The ERC20 name.
    /// @param symbol_ The ERC20 symbol.
    constructor(
        address underlying_,
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_) {
        underlying = underlying_;
    }

    //--------------------------------------------------------------------------
    // ButtonWrapper write methods

    /// @inheritdoc IButtonWrapper
    function deposit(uint256 uAmount) external override returns (uint256) {
        uint256 totalUnderlying_ = _queryUnderlyingBalance();
        require(
            (uAmount + totalUnderlying_) < MAX_UNDERLYING,
            "UnbuttonToken: too many unbutton tokens to mint"
        );

        if (totalSupply() == 0) {
            IERC20(underlying).safeTransferFrom(msg.sender, address(this), MINIMUM_DEPOSIT);

            _mint(address(this), _fromUnderlyingAmount(MINIMUM_DEPOSIT, totalUnderlying_));

            totalUnderlying_ = _queryUnderlyingBalance();

            uAmount -= MINIMUM_DEPOSIT;
        }

        uint256 mintAmount = _fromUnderlyingAmount(uAmount, totalUnderlying_);

        require(mintAmount > 0, "UnbuttonToken: too few unbutton tokens to mint");

        IERC20(underlying).safeTransferFrom(msg.sender, address(this), uAmount);

        _mint(msg.sender, mintAmount);

        return mintAmount;
    }

    /// @inheritdoc IButtonWrapper
    function withdraw(uint256 uAmount) external override returns (uint256) {
        uint256 burnAmount = _fromUnderlyingAmount(uAmount, _queryUnderlyingBalance());

        require(burnAmount > 0, "UnbuttonToken: too few unbutton tokens to burn");

        _burn(msg.sender, burnAmount);

        IERC20(underlying).safeTransfer(msg.sender, uAmount);

        return burnAmount;
    }

    /// @inheritdoc IButtonWrapper
    function withdrawAll() external override returns (uint256) {
        uint256 totalUnderlying_ = _queryUnderlyingBalance();
        uint256 uAmount = _toUnderlyingAmount(balanceOf(msg.sender), totalUnderlying_);
        uint256 burnAmount = _fromUnderlyingAmount(uAmount, totalUnderlying_);

        require(burnAmount > 0, "UnbuttonToken: too few unbutton tokens to burn");

        _burn(msg.sender, burnAmount);

        IERC20(underlying).safeTransfer(msg.sender, uAmount);

        return burnAmount;
    }

    //--------------------------------------------------------------------------
    // ButtonWrapper view methods

    /// @inheritdoc IButtonWrapper
    function totalUnderlying() external view override returns (uint256) {
        return _queryUnderlyingBalance();
    }

    /// @inheritdoc IButtonWrapper
    function balanceOfUnderlying(address owner) external view override returns (uint256) {
        return _toUnderlyingAmount(balanceOf(owner), _queryUnderlyingBalance());
    }

    //--------------------------------------------------------------------------
    // Private methods

    /// @dev Converts underlying to unbutton token amount.
    function _fromUnderlyingAmount(uint256 uAmount, uint256 totalUnderlying_)
        private
        view
        returns (uint256)
    {
        return
            (totalUnderlying_ > 0)
                ? (uAmount * totalSupply()) / totalUnderlying_
                : uAmount * INITIAL_RATE;
    }

    /// @dev Converts unbutton to underlying token amount.
    function _toUnderlyingAmount(uint256 amount, uint256 totalUnderlying_)
        private
        view
        returns (uint256)
    {
        uint256 totalSupply = totalSupply();
        return (totalSupply > 0) ? (amount * totalUnderlying_) / totalSupply : 0;
    }

    /// @dev Queries the underlying ERC-20 balance of this contract.
    function _queryUnderlyingBalance() private view returns (uint256) {
        return IERC20(underlying).balanceOf(address(this));
    }
}
