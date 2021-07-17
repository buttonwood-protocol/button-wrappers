// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IButtonWrapper.sol";

// Interface definition for the UnbuttonToken ERC20 wrapper contract
interface IUnbuttonToken is IButtonWrapper, IERC20 {

}
