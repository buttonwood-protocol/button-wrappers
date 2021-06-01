pragma solidity 0.8.4;

interface IChainlinkAggregator {
    function latestAnswer() external view returns (uint256);
}
