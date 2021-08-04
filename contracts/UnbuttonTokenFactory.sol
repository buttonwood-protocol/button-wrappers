pragma solidity 0.8.4;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "./interfaces/IUnbuttonToken.sol";
import "./interfaces/IUnbuttonTokenFactory.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
 * @title The UnbuttonToken Factory
 *
 * @dev The UnbuttonTokenFactory creates clones of a target UnbuttonToken
 *
 */
contract UnbuttonTokenFactory is IUnbuttonTokenFactory, Context {
    using EnumerableSet for EnumerableSet.AddressSet;
    struct UnbuttonParameters {
        address underlying;
        string name;
        string symbol;
    }

    mapping(bytes32 => address) parameterToInstance;
    EnumerableSet.AddressSet private instanceSet;

    address public target;

    constructor(address _target) {
        target = _target;
    }

    function createUnbuttonToken(
        address underlying,
        string memory name,
        string memory symbol
    ) external override returns (address) {
        require(
            !containsInstance(underlying, name, symbol),
            "UnbuttonToken already exists for input parameters."
        );
        address clone = Clones.clone(target);
        IUnbuttonToken(clone).init(underlying, name, symbol);

        // Adding instance to registry
        parameterToInstance[(keccak256(abi.encode(underlying, name, symbol)))] = clone;
        instanceSet.add(clone);

        // Emitting create event
        emit UnbuttonTokenCreated(clone, underlying);

        return clone;
    }

    function containsInstance(
        address underlying,
        string memory name,
        string memory symbol
    ) public view returns (bool contains) {
        return
            containsInstance(
                parameterToInstance[(keccak256(abi.encode(underlying, name, symbol)))]
            );
    }

    function containsInstance(address instance) public view returns (bool contains) {
        return instanceSet.contains(instance);
    }

    function instanceCount() external view returns (uint256 count) {
        return instanceSet.length();
    }

    function instanceAt(uint256 index) external view returns (address instance) {
        return instanceSet.at(index);
    }
}
