pragma solidity 0.7.6;

interface IChainlinkAggregator {
    function latestAnswer() external view returns (uint256);
}
