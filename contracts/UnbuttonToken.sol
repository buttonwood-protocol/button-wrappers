pragma solidity 0.8.4;

import {IButtonWrapper} from "./interfaces/IButtonWrapper.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
// solhint-disable-next-line max-line-length
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
// solhint-disable-next-line max-line-length
import {ERC20PermitUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";

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
    // PLEASE READ BEFORE CHANGING ANY ACCOUNTING OR MATH
    // The maximum units of the underlying token that can be
    // safely deposited into this contract without any numeric overflow
    // is calculated as:
    //
    // MAX_UNDERLYING = sqrt(MAX_UINT256/INITIAL_RATE)
    //
    // where INITIAL_RATE is the conversion between underlying tokens to unbutton tokens
    // for the initial mint.
    //
    // Since the underlying balances increase due both users depositing
    // into this contract as well as the underlying token rebasing,
    // there's no way to absolutely ENFORCE this bound.
    //
    // In practice the underlying of any token with a reasonable supply
    // will never be this high.

    //--------------------------------------------------------------------------
    // Constants

    /// @dev Small deposit which is locked to the contract to ensure that
    ///      the `totalUnderlying` balance is always non-zero.
    uint256 public constant INITIAL_DEPOSIT = 1_000;

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
        string memory symbol_,
        uint256 initialRate
    ) public initializer {
        __ERC20_init(name_, symbol_);
        __ERC20Permit_init(name_);
        underlying = underlying_;

        // NOTE: First mint with initial micro deposit
        uint256 mintAmount = INITIAL_DEPOSIT * initialRate;
        IERC20Upgradeable(underlying).safeTransferFrom(
            _msgSender(),
            address(this),
            INITIAL_DEPOSIT
        );
        _mint(address(this), mintAmount);
    }

    //--------------------------------------------------------------------------
    // ButtonWrapper write methods

    /// @inheritdoc IButtonWrapper
    function mint(uint256 amount) external override returns (uint256) {
        uint256 uAmount = _toUnderlyingAmount(amount, _queryUnderlyingBalance(), totalSupply());
        _deposit(_msgSender(), _msgSender(), uAmount, amount);
        return uAmount;
    }

    /// @inheritdoc IButtonWrapper
    function mintFor(address to, uint256 amount) external override returns (uint256) {
        uint256 uAmount = _toUnderlyingAmount(amount, _queryUnderlyingBalance(), totalSupply());
        _deposit(_msgSender(), to, uAmount, amount);
        return uAmount;
    }

    /// @inheritdoc IButtonWrapper
    function burn(uint256 amount) external override returns (uint256) {
        uint256 uAmount = _toUnderlyingAmount(amount, _queryUnderlyingBalance(), totalSupply());
        _withdraw(_msgSender(), _msgSender(), uAmount, amount);
        return uAmount;
    }

    /// @inheritdoc IButtonWrapper
    function burnTo(address to, uint256 amount) external override returns (uint256) {
        uint256 uAmount = _toUnderlyingAmount(amount, _queryUnderlyingBalance(), totalSupply());
        _withdraw(_msgSender(), to, uAmount, amount);
        return uAmount;
    }

    /// @inheritdoc IButtonWrapper
    function burnAll() external override returns (uint256) {
        uint256 amount = balanceOf(_msgSender());
        uint256 uAmount = _toUnderlyingAmount(amount, _queryUnderlyingBalance(), totalSupply());
        _withdraw(_msgSender(), _msgSender(), uAmount, amount);
        return uAmount;
    }

    /// @inheritdoc IButtonWrapper
    function burnAllTo(address to) external override returns (uint256) {
        uint256 amount = balanceOf(_msgSender());
        uint256 uAmount = _toUnderlyingAmount(amount, _queryUnderlyingBalance(), totalSupply());
        _withdraw(_msgSender(), to, uAmount, amount);
        return uAmount;
    }

    /// @inheritdoc IButtonWrapper
    function deposit(uint256 uAmount) external override returns (uint256) {
        uint256 amount = _fromUnderlyingAmount(uAmount, _queryUnderlyingBalance(), totalSupply());
        _deposit(_msgSender(), _msgSender(), uAmount, amount);
        return amount;
    }

    /// @inheritdoc IButtonWrapper
    function depositFor(address to, uint256 uAmount) external override returns (uint256) {
        uint256 amount = _fromUnderlyingAmount(uAmount, _queryUnderlyingBalance(), totalSupply());
        _deposit(_msgSender(), to, uAmount, amount);
        return amount;
    }

    /// @inheritdoc IButtonWrapper
    function withdraw(uint256 uAmount) external override returns (uint256) {
        uint256 amount = _fromUnderlyingAmount(uAmount, _queryUnderlyingBalance(), totalSupply());
        _withdraw(_msgSender(), _msgSender(), uAmount, amount);
        return amount;
    }

    /// @inheritdoc IButtonWrapper
    function withdrawTo(address to, uint256 uAmount) external override returns (uint256) {
        uint256 amount = _fromUnderlyingAmount(uAmount, _queryUnderlyingBalance(), totalSupply());
        _withdraw(_msgSender(), to, uAmount, amount);
        return amount;
    }

    /// @inheritdoc IButtonWrapper
    function withdrawAll() external override returns (uint256) {
        uint256 amount = balanceOf(_msgSender());
        uint256 uAmount = _toUnderlyingAmount(amount, _queryUnderlyingBalance(), totalSupply());
        _withdraw(_msgSender(), _msgSender(), uAmount, amount);
        return amount;
    }

    /// @inheritdoc IButtonWrapper
    function withdrawAllTo(address to) external override returns (uint256) {
        uint256 amount = balanceOf(_msgSender());
        uint256 uAmount = _toUnderlyingAmount(amount, _queryUnderlyingBalance(), totalSupply());
        _withdraw(_msgSender(), to, uAmount, amount);
        return amount;
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

    /// @inheritdoc IButtonWrapper
    function underlyingToWrapper(uint256 uAmount) external view override returns (uint256) {
        return _fromUnderlyingAmount(uAmount, _queryUnderlyingBalance(), totalSupply());
    }

    /// @inheritdoc IButtonWrapper
    function wrapperToUnderlying(uint256 amount) external view override returns (uint256) {
        return _toUnderlyingAmount(amount, _queryUnderlyingBalance(), totalSupply());
    }

    //--------------------------------------------------------------------------
    // Private methods

    /// @dev Internal method to commit deposit state.
    ///      NOTE: Expects uAmount, amount to be pre-calculated.
    function _deposit(address from, address to, uint256 uAmount, uint256 amount) private {
        require(amount > 0, "UnbuttonToken: too few unbutton tokens to mint");

        // Transfer underlying token from the initiator to the contract
        IERC20Upgradeable(underlying).safeTransferFrom(from, address(this), uAmount);

        // Mint unbutton token to the beneficiary
        _mint(to, amount);
    }

    /// @dev Internal method to commit deposit state.
    ///      NOTE: Expects uAmount, amount to be pre-calculated.
    function _withdraw(address from, address to, uint256 uAmount, uint256 amount) private {
        require(amount > 0, "UnbuttonToken: too few unbutton tokens to burn");

        // Burn unbutton tokens from the initiator
        _burn(from, amount);

        // Transfer underlying tokens to the beneficiary
        IERC20Upgradeable(underlying).safeTransfer(to, uAmount);
    }

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
