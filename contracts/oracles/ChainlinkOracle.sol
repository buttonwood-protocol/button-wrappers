// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.4;

import {IOracle} from "../interfaces/IOracle.sol";
import {IChainlinkAggregator} from "../interfaces/IChainlinkAggregator.sol";

/**
 * @title Chainlink Oracle
 *
 * @notice Provides a value onchain from a chainlink oracle aggregator
 */
contract ChainlinkOracle is IOracle {
    // The address of the Chainlink Aggregator contract
    IChainlinkAggregator public oracle;

    constructor(address _oracle) {
        oracle = IChainlinkAggregator(_oracle);
    }

    /**
     * @notice Fetches the latest market price from chainlink
     * @return Value: Latest market price as an 8 decimal fixed point number.
     *         valid: Boolean indicating an value was fetched successfully.
     */
    function getData() external view override returns (uint256, bool) {
        uint256 result = oracle.latestAnswer();
        return (result, true);
    }
}
