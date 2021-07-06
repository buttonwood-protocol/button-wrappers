// SPDX-License-Identifier: GPL-3.0-or-later

interface IChainlinkAggregator {
    function latestAnswer() external view returns (uint256);
}
