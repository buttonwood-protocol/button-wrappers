pragma solidity 0.8.4;

import "./interfaces/IUnbuttonToken.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./external/ERC20.sol";

/**
 * @title The UnbuttonToken ERC20 wrapper.
 *
 * @dev The UnbuttonToken wraps elastic balance (rebasing) tokens like
 *      AMPL, Chai and AAVE's aTokens, to create a fixed balance representation.
 *
 *      User's unbutton balances are represented as their "share" of the total deposit pool.
 *
 */
contract UnbuttonToken is Initializable, IUnbuttonToken, ERC20 {
    using SafeERC20 for IERC20;

    //--------------------------------------------------------------------------
    // Constants

    /// @dev Initial conversion between underlying tokens to unbutton tokens.
    uint256 public constant INITIAL_RATE = 1_000_000;

    /// @dev Small deposit which is locked to the contract to ensure that
    ///      the `totalUnderlying` balance is always non-zero.
    uint256 public constant MINIMUM_DEPOSIT = 1_000;

    // TODO: recalculate this
    /// @dev The maximum units of the underlying token that can be
    ///      safely deposited into this contract without any numeric overflow.
    /// MAX_UNDERLYING = sqrt(MAX_UINT256/INITIAL_RATE)
    uint256 public constant MAX_UNDERLYING = type(uint128).max / 1_000;

    //--------------------------------------------------------------------------
    // Attributes

    /// @inheritdoc IButtonWrapper
    address public override underlying;

    //--------------------------------------------------------------------------

    /**
     * @dev Constructor for Unbutton ERC20 token
     */
    constructor() ERC20("IMPLEMENTATION", "IMPL") {}

    /// @param underlying_ The underlying ERC20 token address.
    /// @param name_ The ERC20 name.
    /// @param symbol_ The ERC20 symbol.
    function init(
        address underlying_,
        string memory name_,
        string memory symbol_
    ) public override initializer {
        super.init(name_, symbol_);
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

        uint256 totalSupply_ = totalSupply();

        if (totalSupply_ == 0) {
            IERC20(underlying).safeTransferFrom(msg.sender, address(this), MINIMUM_DEPOSIT);

            _mint(address(this), _fromUnderlyingAmount(MINIMUM_DEPOSIT, totalUnderlying_, totalSupply_));

            totalUnderlying_ = _queryUnderlyingBalance();

            uAmount -= MINIMUM_DEPOSIT;
        }

        uint256 mintAmount = _fromUnderlyingAmount(uAmount, totalUnderlying_, totalSupply_);

        require(mintAmount > 0, "UnbuttonToken: too few unbutton tokens to mint");

        IERC20(underlying).safeTransferFrom(msg.sender, address(this), uAmount);

        _mint(msg.sender, mintAmount);

        return mintAmount;
    }

    /// @inheritdoc IButtonWrapper
    function withdraw(uint256 uAmount) external override returns (uint256) {
        uint256 burnAmount = _fromUnderlyingAmount(uAmount, _queryUnderlyingBalance(), totalSupply());

        require(burnAmount > 0, "UnbuttonToken: too few unbutton tokens to burn");

        _burn(msg.sender, burnAmount);

        IERC20(underlying).safeTransfer(msg.sender, uAmount);

        return burnAmount;
    }

    /// @inheritdoc IButtonWrapper
    function withdrawAll() external override returns (uint256) {
        uint256 totalUnderlying_ = _queryUnderlyingBalance();
        uint256 totalSupply_ = totalSupply();
        uint256 uAmount = _toUnderlyingAmount(balanceOf(msg.sender), totalUnderlying_, totalSupply_);
        uint256 burnAmount = _fromUnderlyingAmount(uAmount, totalUnderlying_, totalSupply_);

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
        return _toUnderlyingAmount(balanceOf(owner), _queryUnderlyingBalance(), totalSupply());
    }

    //--------------------------------------------------------------------------
    // Private methods

    /// @dev Queries the underlying ERC-20 balance of this contract.
    function _queryUnderlyingBalance() private view returns (uint256) {
        return IERC20(underlying).balanceOf(address(this));
    }

    /// @dev Converts underlying to unbutton token amount.
    function _fromUnderlyingAmount(uint256 uAmount, uint256 totalUnderlying_, uint256 totalSupply)
        private
        pure
        returns (uint256)
    {
        return
            (totalUnderlying_ > 0)
                ? (uAmount * totalSupply) / totalUnderlying_
                : uAmount * INITIAL_RATE;
    }

    /// @dev Converts unbutton to underlying token amount.
    function _toUnderlyingAmount(uint256 amount, uint256 totalUnderlying_, uint256 totalSupply)
        private
        pure
        returns (uint256)
    {
        return (totalSupply > 0) ? (amount * totalUnderlying_) / totalSupply : 0;
    }
}
