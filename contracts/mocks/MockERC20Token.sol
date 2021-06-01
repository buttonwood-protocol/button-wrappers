pragma solidity 0.8.4;

import "./Mock.sol";

contract MockERC20Token is Mock {
    uint256 private _supply;
    uint256 private _balance;

    // Methods to mock data on the chain
    function storeSupply(uint256 supply) public {
        _supply = supply;
    }

    // Methods to mock data on the chain
    function storeBalance(uint256 balance) public {
        _balance = balance;
    }

    function totalSupply() public view returns (uint256) {
        return _supply;
    }

    function balanceOf(address who) public view returns (uint256) {
        return _balance;
    }
}
