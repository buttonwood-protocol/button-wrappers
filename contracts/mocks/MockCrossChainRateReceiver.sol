// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.4;

import {IRSETHRateReceiver} from "../interfaces/IRSETHRateReceiver.sol";

contract MockRSETHRateReceiver is IRSETHRateReceiver {
    uint256 public rate = 10 ** 18;

    function setRate(uint256 rate_) external {
        rate = rate_;
    }

    function getRate() external view override returns (uint256) {
        return rate;
    }
}
