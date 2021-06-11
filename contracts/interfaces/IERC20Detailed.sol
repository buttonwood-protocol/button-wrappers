// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.4;

interface IERC20Detailed {
    function name() external view returns (string memory);

    function symbol() external view returns (string memory);

    function decimals() external view returns (uint8);
}
