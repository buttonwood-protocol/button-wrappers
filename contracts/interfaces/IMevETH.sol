// SPDX-License-Identifier: GPL-3.0

/// @dev https://github.com/manifoldfinance/mevETH2/blob/main/src/interfaces/IMevEth.sol
interface IMevETH {
    /**
     * convertToAssets()
     *
     * @dev Converts a given number of shares to assets.
     * @param shares The number of shares to convert.
     * @return The number of assets.
     */
    function convertToAssets(uint256 shares) external view returns (uint256);
}
