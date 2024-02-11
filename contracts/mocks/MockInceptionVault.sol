// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {IInceptionVault} from "../interfaces/IInceptionVault.sol";

contract MockInceptionVault is IInceptionVault {
    uint256 private constant MULTIPLIER = 1e18;

    uint256 public inceptionTokenSupply = 10 ** 18;
    uint256 public totalDeposited = 10 ** 18;
    uint256 public totalAmountToWithdraw = 0;

    function setInceptionTokenSupply(uint256 inceptionTokenSupply_) external {
        inceptionTokenSupply = inceptionTokenSupply_;
    }

    function setTotalDeposited(uint256 totalDeposited_) external {
        totalDeposited = totalDeposited_;
    }

    function saturatingMultiply(uint256 a, uint256 b) internal pure returns (uint256) {
        unchecked {
            if (a == 0) return 0;
            uint256 c = a * b;
            if (c / a != b) return type(uint256).max;
            return c;
        }
    }

    function saturatingAdd(uint256 a, uint256 b) internal pure returns (uint256) {
        unchecked {
            uint256 c = a + b;
            if (c < a) return type(uint256).max;
            return c;
        }
    }

    // Preconditions:
    //  1. a may be arbitrary (up to 2 ** 256 - 1)
    //  2. b * c < 2 ** 256
    // Returned value: min(floor((a * b) / c), 2 ** 256 - 1)
    function multiplyAndDivideFloor(
        uint256 a,
        uint256 b,
        uint256 c
    ) internal pure returns (uint256) {
        return
            saturatingAdd(
                saturatingMultiply(a / c, b),
                ((a % c) * b) / c // can't fail because of assumption 2.
            );
    }

    // Preconditions:
    //  1. a may be arbitrary (up to 2 ** 256 - 1)
    //  2. b * c < 2 ** 256
    // Returned value: min(ceil((a * b) / c), 2 ** 256 - 1)
    function multiplyAndDivideCeil(
        uint256 a,
        uint256 b,
        uint256 c
    ) internal pure returns (uint256) {
        require(c != 0, "c == 0");
        return
            saturatingAdd(
                saturatingMultiply(a / c, b),
                ((a % c) * b + (c - 1)) / c // can't fail because of assumption 2.
            );
    }

    function ratio() public view override returns (uint256) {
        // take into account pending withdrawn amount
        uint256 denominator = totalDeposited < totalAmountToWithdraw
            ? 0
            : totalDeposited - totalAmountToWithdraw;
        if (denominator == 0 || inceptionTokenSupply == 0) {
            return 1e18;
        }
        return multiplyAndDivideCeil(inceptionTokenSupply, 1e18, denominator);
    }

    function convertToShares(uint256 assets) public view override returns (uint256 shares) {
        return multiplyAndDivideFloor(assets, ratio(), 1e18);
    }

    function convertToAssets(uint256 iShares) public view override returns (uint256 assets) {
        return multiplyAndDivideFloor(iShares, 1e18, ratio());
    }
}
