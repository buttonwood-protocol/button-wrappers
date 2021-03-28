pragma solidity ^0.7.6;

import "../interfaces/IChainlinkAggregator.sol";

/**
 * @title Chainlink Oracle
 *
 * @notice Provides a value onchain from a chainlink oracle aggregator
 */
contract MockChainlinkAggregator is IChainlinkAggregator {
    uint256 public answer;

    /**
     * Get the latest answer from the oracle
     */
    function latestAnswer() external view override returns (uint256) {
        return answer;
    }

    /**
     * Set the latest answer to be returned from now on
     */
    function setLatestAnswer(uint256 _answer) public {
        answer = _answer;
    }
}
