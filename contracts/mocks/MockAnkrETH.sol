// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.4;

import {IAnkrETH} from "../interfaces/IAnkrETH.sol";

contract MockAnkrETH is IAnkrETH {
    uint256 public totalShares = 10 ** 18;
    uint256 public totalBonds = 10 ** 18;

    function setTotalShares(uint256 totalShares_) external {
        totalShares = totalShares_;
    }

    function setTotalBonds(uint256 totalBonds_) external {
        totalBonds = totalBonds_;
    }

    function sharesToBonds(uint256 amount) external view override returns (uint256) {
        return (amount * totalBonds) / totalShares;
    }

    function bondsToShares(uint256 amount) external view override returns (uint256) {
        return (amount * totalShares) / totalBonds;
    }
}
