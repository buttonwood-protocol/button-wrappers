// SPDX-License-Identifier: GPL-3.0

/// @dev https://github.com/makerdao/sdai/blob/master/src/ISavingsDai.sol
interface ISavingsDai {
    function convertToAssets(uint256) external view returns (uint256);
}
