pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IButtonWrapper.sol";

/**
 * @dev Factory for UnbuttonToken contracts
 */
interface IUnbuttonTokenFactory {
    event UnbuttonTokenCreated(address newUnbuttonTokenAddress);

    function createUnbuttonToken(
        address underlying,
        string memory name,
        string memory symbol
    ) external returns (address);
}
