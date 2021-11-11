// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IButtonWrapper.sol";
import "./interfaces/IRebasingERC20.sol";
import "./interfaces/IWETH.sol";

/**
 * @dev Router to automatically wrap ETH into WETH for ButtonToken actions
 */
contract ButtonTokenWethRouter is ReentrancyGuard {
    IWETH9 public weth;

    constructor(address _weth) {
        weth = IWETH9(_weth);
    }

    receive() external payable {
        require(msg.sender == address(weth), "ButtonTokenWethRouter: unexpected receive");
    }

    /**
     * @dev Deposit the given amount of ETH into the given ButtonToken
     *  Returns the output buttonTokens to the user.
     *
     * @param buttonToken the button token to deposit into
     * @return The amount of ButtonTokens created
     */
    function deposit(address buttonToken) external payable nonReentrant returns (uint256) {
        uint256 value = msg.value;
        require(value > 0, "ButtonTokenWethRouter: No ETH supplied");
        weth.deposit{value: msg.value}();
        weth.approve(buttonToken, value);
        return IButtonWrapper(buttonToken).depositFor(msg.sender, value);
    }

    /**
     * @dev Withdraw the given amount of button tokens from the given ButtonToken
     *  Returns the output ETH to the user
     *
     * @param buttonToken the button token to burn from
     * @param amount The amount of ButtonTokens to burn
     * @return The amount of ButtonTokens burned
     */
    function burn(address buttonToken, uint256 amount) external nonReentrant returns (uint256) {
        IRebasingERC20(buttonToken).transferFrom(msg.sender, address(this), amount);
        IButtonWrapper(buttonToken).burn(amount);
        weth.withdraw(weth.balanceOf(address(this)));
        (bool success, ) = msg.sender.call{value: address(this).balance}("");
        require(success, "Failed to send ETH");
        return amount;
    }

    /**
     * @dev Withdraw all button tokens from the given ButtonToken
     *  Returns the output ETH to the user
     *
     * @param buttonToken the button token to burn from
     * @return The amount of ButtonTokens burned
     */
    function burnAll(address buttonToken) external nonReentrant returns (uint256) {
        IRebasingERC20(buttonToken).transferAllFrom(msg.sender, address(this));
        uint256 amount = IButtonWrapper(buttonToken).burnAll();
        weth.withdraw(weth.balanceOf(address(this)));
        (bool success, ) = msg.sender.call{value: address(this).balance}("");
        require(success, "Failed to send ETH");
        return amount;
    }
}
