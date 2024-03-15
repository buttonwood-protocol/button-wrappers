// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Actual interface taken from https://arbiscan.io/address/0x1bEB65b15689cCAeb5dA191c9fd5F94513923Cab#code#F11
// This should be a useful reference but at time of writing it is unclear how the import resolves to source code:
//   https://github.com/api3dao/contracts/blob/main/contracts/v0.8/interfaces/IDapiProxy.sol
interface IDapiProxy {
    function read() external view returns (int224 value, uint32 timestamp);
}
