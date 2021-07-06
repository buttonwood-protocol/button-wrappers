// SPDX-License-Identifier: GPL-3.0-or-later

// Interface definition for ButtonWrapper contract, which wraps an
// underlying ERC20 asset into a new ERC20 with different characteristics.
// NOTE: "uAmount" => underlying asset (wrapped) amount and
//       "amount" => external (wrapper) amount
interface IButtonWrapper {
    /// @return The address of the underlying asset.
    function underlying() external view returns (address);

    /// @return The total underlying assets held by the wrapper contract.
    function totalUnderlying() external view returns (uint256);

    /// @param who The account address.
    /// @return The underlying asset balance of the account.
    function balanceOfUnderlying(address who) external view returns (uint256);

    /// @notice Transfers underlying assets from {msg.sender} to the contract and
    ///         mints wrapper tokens.
    /// @param uAmount The amount of underlying asset tokens to deposit.
    /// @return The number of mint wrapper tokens.
    function deposit(uint256 uAmount) external returns (uint256);

    /// @notice Burns wrapper tokens from {msg.sender} and transfers
    ///         the underlying assets back.
    /// @param uAmount The amount of underlying asset tokens to withdraw.
    /// @return The number of burnt wrapper tokens.
    function withdraw(uint256 uAmount) external returns (uint256);

    /// @notice Burns all wrapper tokens from {msg.sender} and transfers
    ///         the underlying assets back.
    /// @return The number of burnt wrapper tokens.
    function withdrawAll() external returns (uint256);
}
