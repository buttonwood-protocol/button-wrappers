// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.4;
import {IStaderOracle} from "../interfaces/IStaderOracle.sol";

contract MockStaderOracle is IStaderOracle {
    uint256 public totalETHBalance = 10 ** 18;
    uint256 public totalETHXSupply = 10 ** 18;

    function setTotalETHBalance(uint256 totalETHBalance_) external {
        totalETHBalance = totalETHBalance_;
    }

    function setTotalETHXSupply(uint256 totalETHXSupply_) external {
        totalETHXSupply = totalETHXSupply_;
    }

    function getExchangeRate() external view override returns (ExchangeRate memory) {
        return
            ExchangeRate({
                reportingBlockNumber: 0,
                totalETHBalance: totalETHBalance,
                totalETHXSupply: totalETHXSupply
            });
    }
}
