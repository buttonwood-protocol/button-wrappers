// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.4;

contract MockSAVAX {
    uint256 public totalShares = 10 ** 18;
    uint256 public totalPooledAvax = 10 ** 18;

    function setTotalShares(uint256 totalShares_) external {
        totalShares = totalShares_;
    }

    function setTotalPooledAvax(uint256 totalPooledAvax_) external {
        totalPooledAvax = totalPooledAvax_;
    }

    function getSharesByPooledAvax(uint avaxAmount) external view returns (uint) {
        if (totalPooledAvax == 0) {
            return 0;
        }

        uint shares = (avaxAmount * totalShares) / totalPooledAvax;
        require(shares > 0, "Invalid share count");

        return shares;
    }

    function getPooledAvaxByShares(uint shareAmount) external view returns (uint) {
        if (totalShares == 0) {
            return 0;
        }

        return (shareAmount * totalPooledAvax) / totalShares;
    }
}
