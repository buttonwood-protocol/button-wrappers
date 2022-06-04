// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "../interfaces/IChainlinkAggregator.sol";

/**
 * @title Chainlink Oracle
 *
 * @notice Provides a value onchain from a chainlink oracle aggregator
 */
contract MockChainlinkAggregator is IChainlinkAggregator {
    uint256 public answer;
    uint256 public updatedAt;
    uint8 public immutable override decimals;

    constructor(uint8 _decimals) {
        decimals = _decimals;
    }

    /**
     * Get the latest answer from the oracle
     */
    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 _answer,
            uint256 startedAt,
            uint256 _updatedAt,
            uint80 answeredInRound
        )
    {
        return (0, int256(answer), 0, updatedAt, 0);
    }

    /**
     * Set the latest answer to be returned from now on
     */
    function setLatestAnswer(uint256 _answer) public {
        answer = _answer;
    }

    /**
     * Set the latest answer to be returned from now on
     */
    function setUpdatedAt(uint256 _updatedAt) public {
        updatedAt = _updatedAt;
    }
}
