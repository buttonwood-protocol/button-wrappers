// SPDX-License-Identifier: GPL-3.0-or-later

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IButtonWrapper} from "./IButtonWrapper.sol";

// Interface definition for the UnbuttonToken ERC20 wrapper contract
interface IUnbuttonToken is IButtonWrapper, IERC20 {
    /// @dev Deposit amount during initialization
    function INITIAL_DEPOSIT() external pure returns (uint256);

    /// @dev Contract initializer
    function initialize(
        address underlying_,
        string memory name_,
        string memory symbol_,
        uint256 initialRate
    ) external;
}
