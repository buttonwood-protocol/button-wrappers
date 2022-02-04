// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.4;

import {IWrapperRegistry} from "./interfaces/IWrapperRegistry.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
 * @title The Wrapper Registry
 *
 * @dev Registers bijective pairs of tokens and button/unbutton wrappers
 *
 */
contract WrapperRegistry is IWrapperRegistry, Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;

    /**
     * @dev Mapping of underlying tokens to wrapper tokens
     */
    mapping(address => address) private _wrapperMapping;
    /**
     * @dev Enumerable set of underlying token addresses
     * @dev Required since EnumerableMap only supports uint256->address maps
     */
    EnumerableSet.AddressSet private _underlyingTokens;

    /**
     * @inheritdoc IWrapperRegistry
     * @dev Stores address of underlyingToken into `_underlyingTokens`
     * @dev Stores an entry of underlyingToken address to wrapperToken address into `_wrapperMapping`
     */
    function addWrapper(address underlyingToken, address wrapperToken)
        external
        override
        onlyOwner
        returns (bool)
    {
        if (_underlyingTokens.add(underlyingToken)) {
            _wrapperMapping[underlyingToken] = wrapperToken;
            emit WrapperAdded(underlyingToken, wrapperToken);
            return true;
        }
        return false;
    }

    /**
     * @inheritdoc IWrapperRegistry
     * @dev Removes address of underlyingToken from `_underlyingTokens`
     * @dev Removes the entry of underlyingToken address to wrapperToken address from `_wrapperMapping`
     */
    function removeWrapper(address underlyingToken) external override onlyOwner returns (bool) {
        if (_underlyingTokens.remove(underlyingToken)) {
            emit WrapperRemoved(underlyingToken, _wrapperMapping[underlyingToken]);
            delete _wrapperMapping[underlyingToken];
            return true;
        }
        return false;
    }

    /**
     * @inheritdoc IWrapperRegistry
     * @dev Retrieves the length of `_underlyingTokens`
     */
    function numWrappers() public view override returns (uint256) {
        return _underlyingTokens.length();
    }

    /**
     * @inheritdoc IWrapperRegistry
     * @dev No guarantees are made on the ordering.
     * @dev Retrieves the underlying token at `index` and returns it with matching wrapper token
     */
    function wrapperAt(uint256 index) public view override returns (address, address) {
        address underlyingToken = _underlyingTokens.at(index);
        return (underlyingToken, _wrapperMapping[underlyingToken]);
    }

    /**
     * @inheritdoc IWrapperRegistry
     * @dev Retrieves the wrapper from `_wrapperMapping` by using `underlyingToken` as the key
     */
    function getWrapperFromUnderlying(address underlyingToken)
        external
        view
        override
        returns (address)
    {
        return _wrapperMapping[underlyingToken];
    }

    /**
     * @inheritdoc IWrapperRegistry
     * @dev Retrieves the underlying token by iterating over `underlyingTokens`.
     * @dev Finds first instance that maps to `wrapperToken` in `_wrapperMapping`
     */
    function getUnderlyingFromWrapper(address wrapperToken)
        external
        view
        override
        returns (address)
    {
        for (uint256 i = 0; i < numWrappers(); i++) {
            (address underlying, address wrapper) = wrapperAt(i);
            if (wrapper == wrapperToken) {
                return underlying;
            }
        }
        return address(0);
    }
}
