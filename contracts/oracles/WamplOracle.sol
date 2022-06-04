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
    uint256 public immutable amplEthOracleDecimals;
    IChainlinkAggregator public immutable ethUsdOracle;
    uint256 public immutable ethUsdOracleDecimals;
    IWAMPL public immutable wampl;
    uint256 public immutable unitAmpl;
    uint256 public immutable unitWampl;
    uint256 public immutable stalenessThresholdSecs;

    constructor(
        address _amplEthOracle,
        address _ethUsdOracle,
        address _wampl,
        uint256 _stalenessThresholdSecs
    ) {
        IChainlinkAggregator __amplEthOracle = IChainlinkAggregator(_amplEthOracle);
        amplEthOracle = __amplEthOracle;
        amplEthOracleDecimals = uint256(__amplEthOracle.decimals());
        IChainlinkAggregator __ethUsdOracle = IChainlinkAggregator(_ethUsdOracle);
        ethUsdOracle = __ethUsdOracle;
        ethUsdOracleDecimals = uint256(__ethUsdOracle.decimals());
        IWAMPL __wampl = IWAMPL(_wampl);
        wampl = __wampl;
        unitAmpl = 10**uint256(IERC20Metadata(__wampl.underlying()).decimals());
        unitWampl = 10**uint256(__wampl.decimals());
        stalenessThresholdSecs = _stalenessThresholdSecs;
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
        int256 convertPriceByDecimals = int256(amplEthOracleDecimals) +
            int256(ethUsdOracleDecimals) -
            int256(PRICE_DECIMALS);
        if (convertPriceByDecimals > 0) {
            amplUsd = amplUsd / (10**uint256(convertPriceByDecimals));
        } else if (convertPriceByDecimals < 0) {
            amplUsd = amplUsd * (10**uint256(-convertPriceByDecimals));
        }
        uint256 amplPerWampl = wampl.wrapperToUnderlying(unitWampl);
        uint256 wamplUsd = (amplUsd * amplPerWampl) / unitAmpl;
        return (
            wamplUsd,
            amplEthDiff <= stalenessThresholdSecs && ethUsdDiff <= stalenessThresholdSecs
        );
    }
}
