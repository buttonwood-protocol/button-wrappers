// SPDX-License-Identifier: GPL-3.0

/// @dev https://etherscan.io/token/0xE95A203B1a91a908F9B9CE46459d101078c2c3cb#code
interface IAnkrETH {
    /**
     * @notice Returns the current amount of ETH underlying the amount of ankrETH
     * @param amount The amount of ankrETH to convert to ETH
     * returns 1:1 if no reprice has occurred otherwise it returns the amount * rate.
     * @return The current ankrETH to ETH rate.
     */
    function sharesToBonds(uint256 amount) external view returns (uint256);

    function bondsToShares(uint256 amount) external view returns (uint256);
}
