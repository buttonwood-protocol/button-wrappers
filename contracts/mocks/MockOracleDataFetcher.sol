// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "../interfaces/IOracle.sol";

/**
 * @title Mock oracle data fetcher
 *
 * @notice Fetches data from an oracle
 */
contract MockOracleDataFetcher {
    IOracle public oracle;
    uint256 public data;
    bool public success;

    constructor(address _oracle) {
        oracle = IOracle(_oracle);
    }

    /**
     * Return the latest answer from the oracle
     */
    function getData() external view returns (uint256, bool) {
        return (data, success);
    }

    /**
     * Fetch the latest answer from the oracle
     */
    function fetch() external {
        (uint256 _data, bool _success) = oracle.getData();
        data = _data;
        success = _success;
    }
}
