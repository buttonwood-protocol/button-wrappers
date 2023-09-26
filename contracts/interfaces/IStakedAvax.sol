// SPDX-License-Identifier: GPL-3.0

/// @dev https://github.com/Benqi-fi/BENQI-Smart-Contracts/blob/master/sAVAX/IStakedAvax.sol
interface IStakedAvax {
    function getSharesByPooledAvax(uint avaxAmount) external view returns (uint);

    function getPooledAvaxByShares(uint shareAmount) external view returns (uint);
}
