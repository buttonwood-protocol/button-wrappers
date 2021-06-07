pragma solidity 0.8.4;

interface IOracle {
    function getData() external returns (uint256, bool);
}
