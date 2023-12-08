// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.4;

import {IOracle} from "../interfaces/IOracle.sol";
import {ISavingsDai} from "../interfaces/ISavingsDai.sol";

/**
 * @title sDAI Oracle
 *
 * @notice Provides a sDAI:DAI rate for a button wrapper to use
 */
contract SDaiOracle is IOracle {
    /// @dev The output price has a 18 decimal point precision.
    uint256 public constant PRICE_DECIMALS = 18;
    // The address of the Swell Staked ETH contract
    ISavingsDai public immutable sDAI;

    constructor(ISavingsDai sDAI_) {
        sDAI = sDAI_;
    }

    /**
     * @notice Fetches the decimal precision used
     * @return priceDecimals_: Number of decimals in the price
     */
    function priceDecimals() external pure override returns (uint256) {
        return PRICE_DECIMALS;
    }

    /**
     * @notice Fetches the latest sDAI:DAI exchange rate from sDAI contract.
     * The returned value is specifically how much DAI is represented by 1e18 raw units of sDAI.
     * @dev The returned value is considered to be always valid since it is derived directly from
     *   the source token.
     * @return Value: Latest market price as an `priceDecimals` decimal fixed point number.
     *         valid: Boolean indicating an value was fetched successfully.
     */
    function getData() external view override returns (uint256, bool) {
        return (sDAI.convertToAssets(1e18), true);
    }
}
