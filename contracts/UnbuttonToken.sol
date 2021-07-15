pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract UnbuttonToken is ERC20 {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address public immutable asset;

    uint256 public constant MINIMUM_DEPOSIT = 1_000;
    uint256 public constant INITIAL_RATE = 1_000_000;

    constructor(
        string memory name,
        string memory symbol,
        address asset_
    ) ERC20(name, symbol) {
        asset = asset_;
    }

    function deposit(uint256 cAmount) external returns (uint256) {
        if (totalSupply() == 0) {
            _mint(address(this), _fromCAmount(MINIMUM_DEPOSIT));

            IERC20(asset).safeTransferFrom(msg.sender, address(this), MINIMUM_DEPOSIT);

            cAmount = cAmount.sub(MINIMUM_DEPOSIT);
        }

        uint256 amount = _fromCAmount(cAmount);

        require(cAmount > 0 && amount > 0, "UnbuttonToken: too few collateral tokens to deposit");

        IERC20(asset).safeTransferFrom(msg.sender, address(this), cAmount);

        _mint(msg.sender, amount);

        return amount;
    }

    function withdraw(uint256 amount) external returns (uint256) {
        uint256 cAmount = _toCAmount(amount);

        require(cAmount > 0 && amount > 0, "UnbuttonToken: too few collateral tokens to withdraw");

        _burn(msg.sender, amount);
        IERC20(asset).safeTransfer(msg.sender, cAmount);

        return cAmount;
    }

    function totalDeposits() public view returns (uint256) {
        return IERC20(asset).balanceOf(address(this));
    }

    function balanceOfUnderlying(address owner) public view returns (uint256) {
        return _toCAmount(balanceOf(owner));
    }

    function _fromCAmount(uint256 cAmount) private view returns (uint256) {
        return
            (totalDeposits() > 0)
                ? cAmount.mul(totalSupply()).div(totalDeposits())
                : cAmount.mul(INITIAL_RATE);
    }

    function _toCAmount(uint256 amount) private view returns (uint256) {
        return (totalSupply() > 0) ? amount.mul(totalDeposits()).div(totalSupply()) : 0;
    }
}
