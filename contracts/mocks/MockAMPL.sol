// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.4;

contract MockAMPL {
    uint8 public decimals;
    string public name = "Ampleforth";
    string public symbol = "AMPL";

    constructor(uint8 _decimals) {
        decimals = _decimals;
    }
}
