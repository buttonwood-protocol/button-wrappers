pragma solidity 0.8.4;

import "./Mock.sol";

contract MockUFragments is Mock {
    uint256 private _supply;

    // Methods to mock data on the chain
    function storeSupply(uint256 supply) public {
        _supply = supply;
    }

    // Mock methods
    function rebase(uint256 newSupply) public returns (uint256) {
        emit FunctionCalled("UFragments", "rebase", msg.sender);
        uint256[] memory uintVals = new uint256[](1);
        uintVals[0] = newSupply;
        int256[] memory intVals = new int256[](0);
        emit FunctionArguments(uintVals, intVals);
        return newSupply;
    }

    function totalSupply() public view returns (uint256) {
        return _supply;
    }
}
