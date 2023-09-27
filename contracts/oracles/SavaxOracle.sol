// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.4;

import {IOracle} from "../interfaces/IOracle.sol";
import {IStakedAvax} from "../interfaces/IStakedAvax.sol";

/**
 * @title SavaxOracle Oracle
 *
 * @notice Provides a sAVAX:AVAX rate for a button wrapper to use
 */
contract SavaxOracle is IOracle {
    /// @dev The output price has a 18 decimal point precision.
    uint256 public constant PRICE_DECIMALS = 18;
    // The address of the BENQI Staked AVAX contract
    IStakedAvax public immutable savax;

    constructor(IStakedAvax savax_) {
        savax = savax_;
    }

    /**
     * @notice Fetches the decimal precision used in the market price from chainlink
     * @return priceDecimals_: Number of decimals in the price
     */
    function priceDecimals() external pure override returns (uint256) {
        return PRICE_DECIMALS;
    }

    /**
     * @notice Fetches the latest sAVAX:AVAX exchange rate from sAVAX contract.
     * The returned value is specifically how much AVAX is represented by 1e18 raw units of sAVAX.
     * @dev The returned value is considered to be always valid since it is derived directly from
     *   the source token.
     * @return Value: Latest market price as an `priceDecimals` decimal fixed point number.
     *         valid: Boolean indicating an value was fetched successfully.
     */
    function getData() external view override returns (uint256, bool) {
        return (savax.getPooledAvaxByShares(10 ** PRICE_DECIMALS), true);
    }
}
