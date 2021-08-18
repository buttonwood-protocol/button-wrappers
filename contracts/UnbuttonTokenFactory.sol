pragma solidity 0.8.4;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "./interfaces/IUnbuttonToken.sol";
import "./interfaces/IFactory.sol";
import {InstanceRegistry} from "./utilities/InstanceRegistry.sol";

/**
 * @title The UnbuttonToken Factory
 *
 * @dev Creates clones of the target  UnbuttonToken implementation
 *
 */
contract UnbuttonTokenFactory is InstanceRegistry, IFactory {
    address public implementation;

    constructor(address _implementation) {
        implementation = _implementation;
    }

    function create(bytes calldata args) external override returns (address) {
        address underlying;
        string name;
        string symbol;
        (underlying, name, symbol) = abi.decode(args, (address,string,string));

        address unbuttonToken = Clones.clone(implementation);
        IUnbuttonToken(unbuttonToken).init(underlying, name, symbol);

        InstanceRegistry._register(address(unbuttonToken));
        return address(unbuttonToken);
    }
}
