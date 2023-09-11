// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.4;

contract MockWAMPL {
    uint8 public decimals;
    address public underlying;
    uint256 private totalAMPLSupply = 59291643044413257;
    uint256 private MAX_WAMPL_SUPPLY = 10000000 * (10 ** 18);

    constructor(uint8 _decimals, address _underlying) {
        decimals = _decimals;
        underlying = _underlying;
    }

    function setTotalAMPLSupply(uint256 amples) external {
        totalAMPLSupply = amples;
    }

    function wrapperToUnderlying(uint256 wamples) external view returns (uint256) {
        return (wamples * totalAMPLSupply) / MAX_WAMPL_SUPPLY;
    }
}
