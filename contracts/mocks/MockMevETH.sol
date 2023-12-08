// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.4;

import {IMevETH} from "../interfaces/IMevETH.sol";

contract MockMevETH is IMevETH {
    uint256 public totalShares = 10 ** 18;
    uint256 public totalAssets = 10 ** 18;

    function setTotalShares(uint256 totalShares_) external {
        totalShares = totalShares_;
    }

    function setTotalAssets(uint256 totalAssets_) external {
        totalAssets = totalAssets_;
    }

    function convertToAssets(uint256 shares) external view override returns (uint256) {
        return (shares * totalAssets) / totalShares;
    }
}
