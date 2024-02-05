// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.4;

import {IyyAVAX} from "../interfaces/IyyAVAX.sol";

contract MockYyAVAX is IyyAVAX {
    uint256 public totalShares = 10 ** 18;
    uint256 public totalAssets = 10 ** 18;

    function setTotalShares(uint256 totalShares_) external {
        totalShares = totalShares_;
    }

    function setTotalAssets(uint256 totalAssets_) external {
        totalAssets = totalAssets_;
    }

    function pricePerShare() external view override returns (uint256) {
        return ((10 ** 18) * totalAssets) / totalShares;
    }
}
