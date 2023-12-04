// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.4;

contract MockSwETH {
    uint256 public totalSwETH = 10 ** 18;
    uint256 public totalETH = 10 ** 18;

    function setTotalSwETH(uint256 totalSwETH_) external {
        totalSwETH = totalSwETH_;
    }

    function setTotalETH(uint256 totalETH_) external {
        totalETH = totalETH_;
    }

    function swETHToETHRate() external returns (uint256) {
        return (totalETH * (10 ** 18)) / totalSwETH;
    }

    function ethToSwETHRate() external returns (uint256) {
        return (totalSwETH * (10 ** 18)) / totalETH;
    }
}
