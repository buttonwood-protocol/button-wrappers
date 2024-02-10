// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.4;

import {IOracle} from "../interfaces/IOracle.sol";
import {IRockXStaking} from "../interfaces/IRockXStaking.sol";

/**
 * @title uniETH Oracle
 *
 * @notice Provides a uniETH:ETH rate for a button wrapper to use
 */
contract UniETHOracle is IOracle {
    /// @dev The output price has a 18 decimal point precision.
    uint256 public constant PRICE_DECIMALS = 18;
    // The address of the source Bedrock contract to validate ETH staked
    IRockXStaking public immutable rockXStaking;

    constructor(IRockXStaking rockXStaking_) {
        rockXStaking = rockXStaking_;
    }

    /**
     * @notice Fetches the decimal precision used in the market price from RockXStaking contract
     * @return priceDecimals_: Number of decimals in the price
     */
    function priceDecimals() external pure override returns (uint256) {
        return PRICE_DECIMALS;
    }

    /**
     * @notice Fetches the latest uniETH:ETH exchange rate from uniETH contract.
     * The returned value is specifically how much ETH is represented by 1e18 raw units of uniETH.
     * @dev The returned value is considered to be always valid since it is derived directly from
     *   the source token.
     * @return Value: Latest market price as an `priceDecimals` decimal fixed point number.
     *         valid: Boolean indicating an value was fetched successfully.
     */
    function getData() external view override returns (uint256, bool) {
        return (rockXStaking.exchangeRatio(), true);
    }
}
