// SPDX-License-Identifier: GPL-3.0

/// @dev https://github.com/Bedrock-Technology/stake/blob/main/src/contracts/rockx_staking.sol
interface IRockXStaking {
    /**
     * @dev Exchange Ratio of xETH to ETH, normally >= 1.0
     * @dev return exchange ratio of , multiplied by 1e18
     */
    function exchangeRatio() external view returns (uint256);
}
