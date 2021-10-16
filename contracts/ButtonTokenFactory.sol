pragma solidity 0.8.4;

import {IFactory} from "./interfaces/IFactory.sol";
import {IButtonToken} from "./interfaces/IButtonToken.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {InstanceRegistry} from "./utilities/InstanceRegistry.sol";
import {
    OwnableUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title The ButtonToken Factory
 *
 * @dev Creates clones of the target ButtonToken template
 *
 */
contract ButtonTokenFactory is InstanceRegistry, IFactory {
    using SafeERC20 for IERC20;

    address public immutable template;

    constructor(address _template) {
        template = _template;
    }

    /// @dev Create and initialize an instance of the button token
    function create(bytes calldata args) external override returns (address) {
        // Parse params
        address underlying;
        string memory name;
        string memory symbol;
        address oracle;
        (underlying, name, symbol, oracle) = abi.decode(args, (address, string, string, address));
        return _create(underlying, name, symbol, oracle);
    }

    /// @dev Create and initialize an instance of the button token
    function create(
        address underlying,
        string memory name,
        string memory symbol,
        address oracle
    ) external returns (address) {
        return _create(underlying, name, symbol, oracle);
    }

    /**
     * @dev Create and initialize an instance of the button token with ownership set to msg.sender
     * ButtonTokens require owners for updating oracle and other parameters.
     */
    function _create(
        address underlying,
        string memory name,
        string memory symbol,
        address oracle
    ) private returns (address) {
        // Create instance
        address buttonToken = Clones.clone(template);

        // Initialize instance
        IButtonToken(buttonToken).initialize(underlying, name, symbol, oracle);

        // Transfer ownership to msg.sender
        OwnableUpgradeable(buttonToken).transferOwnership(msg.sender);

        // Register instance
        InstanceRegistry._register(address(buttonToken));

        // Return instance
        return buttonToken;
    }
}
