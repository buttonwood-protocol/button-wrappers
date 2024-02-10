// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {IRockXStaking} from "../interfaces/IRockXStaking.sol";

contract MockRockXStaking is IRockXStaking {
    uint256 private constant MULTIPLIER = 1e18;

    uint256 public xETHAmount = 10 ** 18;
    uint256 public reserveETH = 10 ** 18;

    function setXETHAmount(uint256 xETHAmount_) external {
        xETHAmount = xETHAmount_;
    }

    function setETHReserve(uint256 reserveETH_) external {
        reserveETH = reserveETH_;
    }

    function exchangeRatio() external view override returns (uint256) {
        if (xETHAmount == 0) {
            return 1 * MULTIPLIER;
        }

        uint256 ratio = (reserveETH * MULTIPLIER) / xETHAmount;
        return ratio;
    }
}
