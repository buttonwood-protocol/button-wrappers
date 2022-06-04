// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.4;

contract MockAMPL {
    uint8 private _decimals;

    constructor(uint8 decimals) {
        _decimals = decimals;
    }

    /**
     * @dev Returns the name of the token.
     */
    function name() external view returns (string memory) {
        return "Ampleforth";
    }

    /**
     * @dev Returns the symbol of the token.
     */
    function symbol() external view returns (string memory) {
        return "AMPL";
    }

    /**
     * @dev Returns the decimals places of the token.
     */
    function decimals() public view returns (uint8) {
        return _decimals;
    }
}
