// SPDX-License-Identifier: GPL-3.0

// solhint-disable-next-line max-line-length
/// @dev https://github.com/SwellNetwork/v3-core-public/blob/master/contracts/core/contracts/interfaces/IswETH.sol
interface IswETH {
    /**
     * @dev Returns the current SwETH to ETH rate,
     * returns 1:1 if no reprice has occurred otherwise it returns the swETHToETHRateFixed rate.
     * @return The current SwETH to ETH rate.
     */
    function swETHToETHRate() external view returns (uint256);

    /**
     * @dev Returns the current ETH to SwETH rate.
     * @return The current ETH to SwETH rate.
     */
    function ethToSwETHRate() external view returns (uint256);
}
