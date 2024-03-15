// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "../interfaces/IDapiProxy.sol";

/**
 * @title Mock DapiProxy
 *
 * @notice Provides a value onchain from an API3 oracle
 */
contract MockDapiProxy is IDapiProxy {
    int224 public answer;
    uint32 public updatedAt;

    function read() external view override returns (int224 value, uint32 timestamp) {
        return (answer, updatedAt);
    }

    /**
     * Set the latest answer to be returned from now on
     */
    function setLatestAnswer(int224 _answer) public {
        answer = _answer;
    }

    /**
     * Set the latest answer to be returned from now on
     */
    function setUpdatedAt(uint32 _updatedAt) public {
        updatedAt = _updatedAt;
    }
}
