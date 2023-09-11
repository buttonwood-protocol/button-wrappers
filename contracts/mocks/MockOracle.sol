// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.4;

import "../interfaces/IOracle.sol";

/**
 * @title Mock oracle
 */
contract MockOracle is IOracle {
    uint256 private data;
    bool private success;

    function priceDecimals() external view override returns (uint256 priceDecimals_) {
        priceDecimals_ = 8;
    }

    /**
     * Return mocked data returned by the oracle
     */
    function getData() external view override returns (uint256, bool) {
        return (data, success);
    }

    /**
     * Return sets the mocked data
     */
    function setData(uint256 dt, bool v) external {
        data = dt;
        success = v;
    }
}
