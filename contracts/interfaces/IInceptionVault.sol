// SPDX-License-Identifier: GPL-3.0

// solhint-disable-next-line
/// @dev https://github.com/inceptionlrt/smart-contracts/blob/master/contracts/interfaces/IInceptionVault.sol
// solhint-disable-next-line
/// @dev https://github.com/inceptionlrt/smart-contracts/blob/master/contracts/Inception/vaults/InceptionVault.sol#L222-L232
interface IInceptionVault {
    function ratio() external view returns (uint256);

    function convertToShares(uint256 assets) external view returns (uint256 shares);

    function convertToAssets(uint256 iShares) external view returns (uint256 assets);
}
