// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.4;

import {IButtonWrapper} from "./interfaces/IButtonWrapper.sol";
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
    mapping(address => address) private _underlyingToWrapperMapping;
    /**
     * @dev Enumerable set of underlying token addresses
     * @dev Required since EnumerableMap only supports uint256->address maps
     */
    EnumerableSet.AddressSet private _underlyingTokens;

    /**
     * @inheritdoc IWrapperRegistry
     * @dev Stores address of underlyingToken into `_underlyingTokens`
     * @dev Stores an entry of underlyingToken address to wrapperToken
     *  address into `_underlyingToWrapperMapping`
     */
    function addWrapper(address wrapperToken) external override onlyOwner returns (bool) {
        address underlyingToken = IButtonWrapper(wrapperToken).underlying();
        if (_underlyingTokens.add(underlyingToken)) {
            _underlyingToWrapperMapping[underlyingToken] = wrapperToken;
            emit WrapperAdded(underlyingToken, wrapperToken);
            return true;
        }
        return false;
    }

    /**
     * @inheritdoc IWrapperRegistry
     * @dev Gets address of underlyingToken from `wrapperToken` and calls `removeUnderlying`
     */
    function removeWrapper(address wrapperToken) external override onlyOwner returns (bool) {
        return removeUnderlying(IButtonWrapper(wrapperToken).underlying());
    }

    /**
     * @inheritdoc IWrapperRegistry
     * @dev Removes address of underlyingToken from `_underlyingTokens`
     * @dev Removes the entry of underlyingToken address to wrapperToken
     *  address from `_underlyingToWrapperMapping`
     */
    function removeUnderlying(address underlyingToken) public override onlyOwner returns (bool) {
        if (_underlyingTokens.remove(underlyingToken)) {
            emit WrapperRemoved(underlyingToken, _underlyingToWrapperMapping[underlyingToken]);
            delete _underlyingToWrapperMapping[underlyingToken];
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
        return (underlyingToken, _underlyingToWrapperMapping[underlyingToken]);
    }

    /**
     * @inheritdoc IWrapperRegistry
     * @dev Retrieves the wrapper from `_underlyingToWrapperMapping` by using
     *  `underlyingToken` as the key
     */
    function getWrapperFromUnderlying(address underlyingToken)
        external
        view
        override
        returns (address)
    {
        return _underlyingToWrapperMapping[underlyingToken];
    }

    /**
     * @inheritdoc IWrapperRegistry
     * @dev Retrieves the underlying token from wrapperToken and returns it if present in registry
     */
    function getUnderlyingFromWrapper(address wrapperToken)
        external
        view
        override
        returns (address)
    {
        address underlyingToken = IButtonWrapper(wrapperToken).underlying();
        if (
            _underlyingTokens.contains(underlyingToken) &&
            _underlyingToWrapperMapping[underlyingToken] == wrapperToken
        ) {
            return underlyingToken;
        }
        return address(0);
    }
}
