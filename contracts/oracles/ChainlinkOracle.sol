pragma solidity 0.7.6;

import "../interfaces/IOracle.sol";
import "../interfaces/IChainlinkAggregator.sol";

/**
 * @title Chainlink Oracle
 *
 * @notice Provides a value onchain from a chainlink oracle aggregator
 */
contract ChainlinkOracle is IOracle {
    // The address of the Chainlink Aggregator contract
    IChainlinkAggregator public oracle;

    constructor(address _oracle) public {
        oracle = IChainlinkAggregator(_oracle);
    }

    /**
     * @notice Fetches the latest market price from chainlink
     * @return Value: Latest market price as an 8 decimal fixed point number.
     *         valid: Boolean indicating an value was fetched successfully.
     */
    function getData() external override returns (uint256, bool) {
        uint256 result = oracle.latestAnswer();
        return (result, true);
    }
}
