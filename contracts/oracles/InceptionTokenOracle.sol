// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.4;

import {IOracle} from "../interfaces/IOracle.sol";
import {IInceptionVault} from "../interfaces/IInceptionVault.sol";

/**
 * @title InceptionToken Oracle
 *
 * @notice Provides a inceptionToken:ETH rate for a button wrapper to use
 */
contract InceptionTokenOracle is IOracle {
    /**
     * @dev The output price has a 18 decimal point precision.
     * 1e18 is hardcoded into InceptionVault contract
     */
    uint256 public constant PRICE_DECIMALS = 18;
    // The address of the source InceptionVault contract to validate ETH staked
    IInceptionVault public immutable inceptionVault;

    constructor(IInceptionVault inceptionVault_) {
        inceptionVault = inceptionVault_;
    }

    /**
     * @notice Fetches the decimal precision used in the market price from InceptionVault contract
     * @return priceDecimals_: Number of decimals in the price
     */
    function priceDecimals() external pure override returns (uint256) {
        return PRICE_DECIMALS;
    }

    /**
     * @notice Fetches the latest inceptionToken:ETH exchange rate from uniETH contract.
     * The returned value is specifically how much ETH is represented by
     * 1e18 raw units of the inceptionToken.
     * @dev The returned value is considered to be always valid since it is derived directly from
     *   the source token.
     * @return Value: Latest market price as an `priceDecimals` decimal fixed point number.
     *         valid: Boolean indicating an value was fetched successfully.
     */
    function getData() external view override returns (uint256, bool) {
        return (inceptionVault.convertToAssets(1e18), true);
    }
}
