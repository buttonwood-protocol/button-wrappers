pragma solidity 0.7.6;

interface IOracle {
    function getData() external returns (uint256, bool);
}
