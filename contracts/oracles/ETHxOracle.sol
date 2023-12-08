// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.4;

import {IOracle} from "../interfaces/IOracle.sol";
import {IStaderOracle} from "../interfaces/IStaderOracle.sol";

/**
 * @title Stader Oracle
 *
 * @notice Provides an ETHx:ETH rate for a button wrapper to use
 */
contract ETHxOracle is IOracle {
    /// @dev The output price has a 18 decimal point precision.
    uint256 public constant PRICE_DECIMALS = 18;
    // The address of the source Stader Labs oracle contract
    IStaderOracle public immutable staderOracle;

    constructor(IStaderOracle staderOracle_) {
        staderOracle = staderOracle_;
    }

    /**
     * @notice Fetches the decimal precision used in the market price from Stader oracle
     * @return priceDecimals_: Number of decimals in the price
     */
    function priceDecimals() external pure override returns (uint256) {
        return PRICE_DECIMALS;
    }

    /**
     * @notice Fetches the latest ETHx:ETH exchange rate from ETHx contract.
     * The returned value is specifically how much ETH is represented by 1e18 raw units of ETHx.
     * @dev The returned value is considered to be always valid since it is derived directly from
     *   the source token.
     * @return Value: Latest market price as an `priceDecimals` decimal fixed point number.
     *         valid: Boolean indicating an value was fetched successfully.
     */
    function getData() external view override returns (uint256, bool) {
        IStaderOracle.ExchangeRate memory exchangeRate = staderOracle.getExchangeRate();
        return (((10 ** 18) * exchangeRate.totalETHBalance) / exchangeRate.totalETHXSupply, true);
    }
}
