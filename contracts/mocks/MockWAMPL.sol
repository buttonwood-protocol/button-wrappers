// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.4;

contract MockWAMPL {
    uint8 private _decimals;
    address private _underlying;

    constructor(uint8 decimals, address underlying) {
        _decimals = decimals;
        _underlying = underlying;
    }

    function decimals() public view returns (uint8) {
        return _decimals;
    }

    function underlying() public view returns (address) {
        return _underlying;
    }

    function wrapperToUnderlying(uint256 wamples) external view returns (uint256) {
        uint256 totalAMPLSupply = 59291643044413257;
        uint256 MAX_WAMPL_SUPPLY = 10000000 * (10**18);
        return (wamples * totalAMPLSupply) / MAX_WAMPL_SUPPLY;
    }
}
