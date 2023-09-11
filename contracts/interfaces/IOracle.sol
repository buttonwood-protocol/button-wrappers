// SPDX-License-Identifier: GPL-3.0-or-later

interface IOracle {
    function priceDecimals() external view returns (uint256 priceDecimals_);

    function getData() external view returns (uint256, bool);
}
