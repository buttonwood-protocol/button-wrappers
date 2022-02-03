// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.4;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockRebasingERC20 is ERC20 {
    uint256 private _multiplier;
    uint256 private _multiplierGranularity;

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 multiplier_,
        uint256 multiplierGranularity_
    ) ERC20(name_, symbol_) {
        _multiplier = multiplier_;
        _multiplierGranularity = multiplierGranularity_;
    }

    function applyMultiplier(uint256 value) private view returns (uint256) {
        return (value * _multiplier) / _multiplierGranularity;
    }

    function applyInverseMultiplier(uint256 value) private view returns (uint256) {
        return (value * _multiplierGranularity) / _multiplier;
    }

    function totalSupply() public view virtual override returns (uint256) {
        return applyMultiplier(super.totalSupply());
    }

    function balanceOf(address account) public view virtual override returns (uint256) {
        return applyMultiplier(super.balanceOf(account));
    }

    function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
        _transfer(_msgSender(), recipient, applyInverseMultiplier(amount));
        return true;
    }

    function approve(address spender, uint256 amount) public virtual override returns (bool) {
        _approve(_msgSender(), spender, amount);
        return true;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public virtual override returns (bool) {
        _transfer(sender, recipient, amount);

        uint256 currentAllowance = allowance(sender, _msgSender());
        require(currentAllowance >= amount, "ERC20: transfer amount exceeds allowance");
        _approve(sender, _msgSender(), currentAllowance - amount);

        return true;
    }

    function mint(address account, uint256 amount) public virtual {
        _mint(account, applyInverseMultiplier(amount));
    }

    function rebase(uint256 multiplier_) external {
        _multiplier = multiplier_;
    }
}
