pragma solidity 0.7.6;

import "./_external/SafeMath.sol";
import "./_external/Ownable.sol";
import "./_external/IERC20.sol";

import "./lib/SafeMathInt.sol";
import "./lib/UInt256Lib.sol";

import "./interfaces/IOracle.sol";

interface IUFragments {
    function totalSupply() external view returns (uint256);

    function rebase(uint256 newSupply) external returns (uint256);
}

/**
 * @title uFragments Monetary Supply Policy
 * @dev This is an implementation of the uFragments Ideal Money protocol.
 *      uFragments operates symmetrically on expansion and contraction. It will both split and
 *      combine coins to maintain a stable unit price.
 *
 *      This component regulates the token supply of the uFragments ERC20 token in response to
 *      market oracles.
 */
contract UFragmentsPolicy is Ownable {
    using SafeMath for uint256;
    using SafeMathInt for int256;
    using UInt256Lib for uint256;

    event LogRebase(uint256 exchangeRate, uint256 newSupply);

    IUFragments public uFrags;
    IERC20 public collateralToken;

    // Market oracle provides the token/USD exchange rate as an 8 decimal fixed point number.
    // (eg) An oracle value of 1.5e8 it would mean 1 unit of collateral is trading for $1.50.
    IOracle public marketOracle;

    uint256 private constant EXCHANGE_RATE_DECIMALS = 8;

    /**
     * @notice Initiates a new rebase operation.
     *
     * @dev The new supply equals (exchangeRate * collateralBalance)
     */
    function rebase() external {
        uint256 exchangeRate;
        bool rateValid;
        (exchangeRate, rateValid) = marketOracle.getData();
        require(rateValid, "Invalid rate");

        uint256 newSupply = computeNewSupply(exchangeRate);

        uint256 supplyAfterRebase = uFrags.rebase(newSupply);
        // the actual rebase can result in a lower supply than requested
        // to satisfy maximum supply constraint in uFrags - but should never be higher.
        // Note this means that if we exceed the maximum supply constraint, the unit token value
        // will not properly rebase to $1 and collateral should be removed.
        // however this value is 2^128 units, which is over ~$3e20 worth of collateral
        require(supplyAfterRebase <= newSupply, "Invalid supply");
        emit LogRebase(exchangeRate, newSupply);
    }

    /**
     * @notice Sets the reference to the market oracle.
     * @param marketOracle_ The address of the market oracle contract.
     */
    function setMarketOracle(IOracle marketOracle_) external onlyOwner {
        marketOracle = marketOracle_;
    }

    /**
     * @dev ZOS upgradable contract initialization method.
     *      It is called at the time of contract creation to invoke parent class initializers and
     *      initialize the contract's state variables.
     */
    function initialize(
        address _owner,
        IUFragments _uFrags,
        IERC20 _collateralToken
    ) public initializer {
        Ownable.initialize(_owner);

        uFrags = _uFrags;
        collateralToken = _collateralToken;
    }

    /**
     * @return Computes the new total supply in response to the exchange rate
     *         and the targetRate.
     */
    function computeNewSupply(uint256 exchangeRate) internal view returns (uint256) {
        uint256 collateralBalance = collateralToken.balanceOf(address(this));
        // newSupply is the total value of the collateral = (exchange rate * collateral balance)
        return exchangeRate.mul(collateralBalance).div(10**EXCHANGE_RATE_DECIMALS);
    }
}
