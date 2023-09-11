// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.4;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";

contract MockRebasingERC20 is Context, IERC20, IERC20Metadata {
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    uint256 private _totalSupply;

    string private _name;
    string private _symbol;

    uint256 private _multiplier;
    uint256 private _multiplierGranularity;

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 multiplier_,
        uint256 multiplierGranularity_
    ) {
        _name = name_;
        _symbol = symbol_;
        _multiplier = multiplier_;
        _multiplierGranularity = multiplierGranularity_;
    }

    function name() public view virtual override returns (string memory) {
        return _name;
    }

    function symbol() public view virtual override returns (string memory) {
        return _symbol;
    }

    function decimals() public view virtual override returns (uint8) {
        return 18;
    }

    function applyMultiplier(uint256 value) private view returns (uint256) {
        return (value * _multiplier) / _multiplierGranularity;
    }

    function applyInverseMultiplier(uint256 value) private view returns (uint256) {
        return (value * _multiplierGranularity) / _multiplier;
    }

    function totalSupply() public view virtual override returns (uint256) {
        return applyMultiplier(_totalSupply);
    }

    function balanceOf(address account) public view virtual override returns (uint256) {
        return applyMultiplier(_balances[account]);
    }

    function _transfer(address sender, address recipient, uint256 amount) internal virtual {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");

        //        _beforeTokenTransfer(sender, recipient, amount);
        uint256 underlyingAmount = applyInverseMultiplier(amount);

        uint256 senderBalance = _balances[sender];
        require(senderBalance >= underlyingAmount, "ERC20: transfer amount exceeds balance");
        _balances[sender] = senderBalance - underlyingAmount;
        _balances[recipient] += underlyingAmount;

        emit Transfer(sender, recipient, amount);
    }

    function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
        _transfer(_msgSender(), recipient, amount);
        return true;
    }

    function _approve(address owner, address spender, uint256 amount) internal virtual {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function approve(address spender, uint256 amount) public virtual override returns (bool) {
        _approve(_msgSender(), spender, amount);
        return true;
    }

    function allowance(
        address owner,
        address spender
    ) public view virtual override returns (uint256) {
        return _allowances[owner][spender];
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

    function _mint(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: mint to the zero address");

        //        _beforeTokenTransfer(address(0), account, amount);

        _totalSupply += amount;
        _balances[account] += amount;
        emit Transfer(address(0), account, amount);
    }

    function mint(address account, uint256 amount) public virtual {
        _mint(account, applyInverseMultiplier(amount));
    }

    function rebase(uint256 multiplier_) external {
        _multiplier = multiplier_;
    }
}
