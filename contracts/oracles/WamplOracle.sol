// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IOracle} from "../interfaces/IOracle.sol";
import {IWAMPL} from "../interfaces/IWAMPL.sol";
import {IChainlinkAggregator} from "../interfaces/IChainlinkAggregator.sol";

/**
 * @title WamplOracle Oracle
 *
 * @notice Provides a value onchain from a chainlink oracle aggregator
 */
contract WamplOracle is IOracle {
    /// @dev The output price has a 8 decimal point precision.
    uint256 public constant PRICE_DECIMALS = 8;
    // The address of the Chainlink Aggregator contract
    IChainlinkAggregator public immutable amplEthOracle;
    IChainlinkAggregator public immutable ethUsdOracle;
    IWAMPL public immutable wampl;
    uint256 public immutable stalenessThresholdSecs;
    uint256 public immutable amplDecimals;
    uint256 public immutable wamplDecimals;
    int256 public immutable convertPriceByDecimals;

    constructor(
        IChainlinkAggregator _amplEthOracle,
        IChainlinkAggregator _ethUsdOracle,
        IWAMPL _wampl,
        uint256 _stalenessThresholdSecs
    ) {
        amplEthOracle = _amplEthOracle;
        ethUsdOracle = _ethUsdOracle;
        wampl = _wampl;
        stalenessThresholdSecs = _stalenessThresholdSecs;
        amplDecimals = uint256(IERC20Metadata(_wampl.underlying()).decimals());
        wamplDecimals = uint256(_wampl.decimals());
        convertPriceByDecimals =
            int256(uint256(_amplEthOracle.decimals())) +
            int256(uint256(_ethUsdOracle.decimals())) -
            int256(PRICE_DECIMALS);
    }

    /**
     * @notice Fetches the decimal precision used in the market price from chainlink
     * @return priceDecimals_: Number of decimals in the price
     */
    function priceDecimals() external view override returns (uint256) {
        return PRICE_DECIMALS;
    }

    /**
     * @notice Fetches the latest market price from chainlink
     * @return Value: Latest market price as an 8 decimal fixed point number.
     *         valid: Boolean indicating an value was fetched successfully.
     */
    function getData() external view override returns (uint256, bool) {
        (, int256 amplEth, , uint256 amplEthUpdatedAt, ) = amplEthOracle.latestRoundData();
        (, int256 ethUsd, , uint256 ethUsdUpdatedAt, ) = ethUsdOracle.latestRoundData();
        uint256 amplEthDiff = block.timestamp - amplEthUpdatedAt;
        uint256 ethUsdDiff = block.timestamp - ethUsdUpdatedAt;
        uint256 amplUsd = uint256(amplEth) * uint256(ethUsd);
        if (convertPriceByDecimals > 0) {
            amplUsd = amplUsd / (10 ** uint256(convertPriceByDecimals));
        } else if (convertPriceByDecimals < 0) {
            amplUsd = amplUsd * (10 ** uint256(-convertPriceByDecimals));
        }
        uint256 amplPerWampl = wampl.wrapperToUnderlying(10 ** wamplDecimals);
        uint256 wamplUsd = (amplUsd * amplPerWampl) / (10 ** amplDecimals);
        return (
            wamplUsd,
            amplEthDiff <= stalenessThresholdSecs && ethUsdDiff <= stalenessThresholdSecs
        );
    }
}
