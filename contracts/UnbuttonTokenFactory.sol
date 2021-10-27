// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.4;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IFactory} from "./interfaces/IFactory.sol";
import {IUnbuttonToken} from "./interfaces/IUnbuttonToken.sol";

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {InstanceRegistry} from "./utilities/InstanceRegistry.sol";

/**
 * @title The UnbuttonToken Factory
 *
 * @dev Creates clones of the target UnbuttonToken template
 *
 */
contract UnbuttonTokenFactory is InstanceRegistry, IFactory {
    using SafeERC20 for IERC20;

    address public immutable template;

    constructor(address _template) {
        template = _template;
    }

    /// @dev Create and initialize an instance of the unbutton token
    function create(bytes calldata args) external override returns (address) {
        // Parse params
        address underlying;
        string memory name;
        string memory symbol;
        uint256 initialRate;
        (underlying, name, symbol, initialRate) = abi.decode(
            args,
            (address, string, string, uint256)
        );

        return _create(underlying, name, symbol, initialRate);
    }

    /// @dev Create and initialize an instance of the unbutton token
    function create(
        address underlying,
        string memory name,
        string memory symbol,
        uint256 initialRate
    ) external returns (address) {
        return _create(underlying, name, symbol, initialRate);
    }

    /// @dev Create and initialize an instance of the unbutton token
    function _create(
        address underlying,
        string memory name,
        string memory symbol,
        uint256 initialRate
    ) private returns (address) {
        // Create instance
        address unbuttonToken = Clones.clone(template);

        // Approve transfer of initial deposit to instance
        uint256 inititalDeposit = IUnbuttonToken(unbuttonToken).INITIAL_DEPOSIT();
        IERC20(underlying).safeTransferFrom(msg.sender, address(this), inititalDeposit);
        IERC20(underlying).approve(unbuttonToken, inititalDeposit);

        // Initialize instance
        IUnbuttonToken(unbuttonToken).initialize(underlying, name, symbol, initialRate);

        // Register instance
        InstanceRegistry._register(address(unbuttonToken));

        // Return instance
        return unbuttonToken;
    }
}
