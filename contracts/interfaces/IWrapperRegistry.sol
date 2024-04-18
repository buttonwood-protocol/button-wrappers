// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * @title Wrapper Registry Interface
 * @notice Interface for storing Wrapper addresses for tokens. Tokens are stored in bijection.
 */
interface IWrapperRegistry {
    /**
     * @notice Event emitted when a wrapper is added
     * @param underlyingToken address of the contract for the underlying token
     * @param wrapperToken address of the contract for the wrapper token
     */
    event WrapperAdded(address underlyingToken, address wrapperToken);

    /**
     * @notice Event emitted when a wrapper is removed
     * @param underlyingToken address of the contract for the underlying token
     * @param wrapperToken address of the contract for the wrapper token
     */
    event WrapperRemoved(address underlyingToken, address wrapperToken);

    /**
     * @notice Adds new wrapper to the registry. Emits WrapperAdded on successful add
     * @param wrapperToken address of the contract for the wrapper token
     * @return true if the wrapper was added, that is, if it wasn't already present.
     */
    function addWrapper(address wrapperToken) external returns (bool);

    /**
     * @notice Removes wrapper from the registry by looking up wrapper token address.
     * @notice Emits WrapperRemoved on successful remove
     * @param wrapperToken address of the contract for the wrapper token
     * @return true if the wrapper was removed, that is if it was present.
     */
    function removeWrapper(address wrapperToken) external returns (bool);

    /**
     * @notice Removes wrapper from the registry by looking up underlying token address.
     * @notice Emits WrapperRemoved on successful remove
     * @param underlyingToken address of the contract for the underlying token
     * @return true if the wrapper was removed, that is if it was present.
     */
    function removeUnderlying(address underlyingToken) external returns (bool);

    /**
     * @notice The number of wrappers stored in the registry
     * @return The number of wrappers currently stored
     */
    function numWrappers() external view returns (uint256);

    /**
     * @notice Gets the addresses of the underlying token corresponding wrapper
     * @notice token for an index greater than 0 and less than `numWrappers()`
     * @param index index of the underlying token in the registry
     * @return Pair of addresses for the underlying token and the wrapper token stored at `index`
     */
    function wrapperAt(uint256 index) external view returns (address, address);

    /**
     * @notice Gets the wrapper for an underlying token
     * @param underlyingToken address of the underlying token
     * @return The wrapper token corresponding to the underlying token address. 0-address if not present.
     */
    function getWrapperFromUnderlying(address underlyingToken) external view returns (address);

    /**
     * @notice Gets the underlying for a wrapper token
     * @param wrapperToken address of the wrapper token
     * @return The underlying token corresponding to the wrapper token address. 0-address if not present.
     */
    function getUnderlyingFromWrapper(address wrapperToken) external view returns (address);
}
