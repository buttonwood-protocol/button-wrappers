// SPDX-License-Identifier: GPL-3.0

// solhint-disable-next-line
/// @dev https://github.com/inceptionlrt/smart-contracts/blob/master/contracts/interfaces/IInceptionVault.sol
interface IInceptionVault {
    function ratio() external view returns (uint256);

    function convertToShares(uint256 assets) external view returns (uint256 shares);

    function convertToAssets(uint256 iShares) external view returns (uint256 assets);
}
