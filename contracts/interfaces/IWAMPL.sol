// SPDX-License-Identifier: GPL-3.0-or-later

interface IWAMPL {
    function decimals() external view returns (uint8);

    function underlying() external view returns (address);

    function wrapperToUnderlying(uint256 wamples) external view returns (uint256);
}
