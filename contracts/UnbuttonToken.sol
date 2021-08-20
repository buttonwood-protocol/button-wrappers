pragma solidity 0.8.4;

import {IButtonWrapper} from "./interfaces/IButtonWrapper.sol";
import {
    IERC20Upgradeable
} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import {
    SafeERC20Upgradeable
} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {
    ERC20PermitUpgradeable
} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";

/**
 * @title The UnbuttonToken ERC20 wrapper.
 *
 * @dev The UnbuttonToken wraps elastic balance (rebasing) tokens like
 *      AMPL, Chai and AAVE's aTokens, to create a fixed balance representation.
 *
 *      The ratio of a user’s balance to the total supply represents
 *      their share of the total deposit pool.
 *
 */
contract UnbuttonToken is IButtonWrapper, ERC20PermitUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    //--------------------------------------------------------------------------
    // Constants

    /// @dev Small deposit which is locked to the contract to ensure that
    ///      the `totalUnderlying` balance is always non-zero.
    uint256 public constant MINIMUM_DEPOSIT = 1_000;

    /// @dev Initial conversion between underlying tokens to unbutton tokens.
    uint256 public constant INITIAL_RATE = 1_000_000;

    /// @dev The maximum units of the underlying token that can be
    ///      safely deposited into this contract without any numeric overflow.
    /// MAX_UNDERLYING = sqrt(MAX_UINT256/INITIAL_RATE)
    uint256 public constant MAX_UNDERLYING = type(uint128).max / 1_000;

    //--------------------------------------------------------------------------
    // Attributes

    /// @inheritdoc IButtonWrapper
    address public override underlying;

    //--------------------------------------------------------------------------

    /// @param underlying_ The underlying ERC20 token address.
    /// @param name_ The ERC20 name.
    /// @param symbol_ The ERC20 symbol.
    function initialize(
        address underlying_,
        string memory name_,
        string memory symbol_
    ) public initializer {
        __ERC20_init(name_, symbol_);
        __ERC20Permit_init(name_);
        underlying = underlying_;

        // NOTE: First mint with initial micro deposit
        uint256 mintAmount = MINIMUM_DEPOSIT * INITIAL_RATE;
        IERC20Upgradeable(underlying).safeTransferFrom(
            _msgSender(),
            address(this),
            MINIMUM_DEPOSIT
        );
        _mint(address(this), mintAmount);
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

        uint256 mintAmount = _fromUnderlyingAmount(uAmount, totalUnderlying_, totalSupply());

        require(mintAmount > 0, "UnbuttonToken: too few unbutton tokens to mint");

        IERC20Upgradeable(underlying).safeTransferFrom(_msgSender(), address(this), uAmount);

        _mint(_msgSender(), mintAmount);

        return mintAmount;
    }

    /// @inheritdoc IButtonWrapper
    function withdraw(uint256 uAmount) external override returns (uint256) {
        uint256 burnAmount =
            _fromUnderlyingAmount(uAmount, _queryUnderlyingBalance(), totalSupply());

        require(burnAmount > 0, "UnbuttonToken: too few unbutton tokens to burn");

        _burn(_msgSender(), burnAmount);

        IERC20Upgradeable(underlying).safeTransfer(_msgSender(), uAmount);

        return burnAmount;
    }

    /// @inheritdoc IButtonWrapper
    function withdrawAll() external override returns (uint256) {
        uint256 totalUnderlying_ = _queryUnderlyingBalance();
        uint256 totalSupply_ = totalSupply();
        uint256 burnAmount = balanceOf(_msgSender());
        uint256 uAmount = _toUnderlyingAmount(burnAmount, totalUnderlying_, totalSupply_);

        require(burnAmount > 0, "UnbuttonToken: too few unbutton tokens to burn");

        _burn(_msgSender(), burnAmount);

        IERC20Upgradeable(underlying).safeTransfer(_msgSender(), uAmount);

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
        return _toUnderlyingAmount(balanceOf(owner), _queryUnderlyingBalance(), totalSupply());
    }

    //--------------------------------------------------------------------------
    // Private methods

    /// @dev Queries the underlying ERC-20 balance of this contract.
    function _queryUnderlyingBalance() private view returns (uint256) {
        return IERC20Upgradeable(underlying).balanceOf(address(this));
    }

    /// @dev Converts underlying to unbutton token amount.
    function _fromUnderlyingAmount(
        uint256 uAmount,
        uint256 totalUnderlying_,
        uint256 totalSupply
    ) private pure returns (uint256) {
        return (uAmount * totalSupply) / totalUnderlying_;
    }

    /// @dev Converts unbutton to underlying token amount.
    function _toUnderlyingAmount(
        uint256 amount,
        uint256 totalUnderlying_,
        uint256 totalSupply
    ) private pure returns (uint256) {
        return (amount * totalUnderlying_) / totalSupply;
    }
}
