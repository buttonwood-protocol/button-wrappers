// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "./IButtonWrapper.sol";

// Interface definition for the UnbuttonToken ERC20 wrapper contract
interface IUnbuttonToken is IButtonWrapper, IERC20Upgradeable {
    function init(
        address underlying_,
        string memory name_,
        string memory symbol_
    ) external;
}
