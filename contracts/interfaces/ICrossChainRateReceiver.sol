// SPDX-License-Identifier: GPL-3.0

/// @dev https://github.com/Kelp-DAO/LRT-rsETH/blob/main/contracts/cross-chain/CrossChainRateReceiver.sol
interface ICrossChainRateReceiver {
    /// @notice Gets the last stored rate in the contract
    function getRate() external view returns (uint256);
}
