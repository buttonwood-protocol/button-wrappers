pragma solidity 0.8.4;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "./interfaces/IUnbuttonToken.sol";
import "./interfaces/IUnbuttonTokenFactory.sol";

/**
 * @title The UnbuttonToken ERC20 wrapper.
 *
 * @dev The UnbuttonToken wraps elastic balance (rebasing) tokens like
 *      AMPL, Chai and AAVE's aTokens, to create a fixed balance representation.
 *
 *      User's unbutton balances are represented as their "share" of the total deposit pool.
 *
 */
contract UnbuttonTokenFactory is IUnbuttonTokenFactory, Context {
    address public target;

    constructor(address _target) {
        target = _target;
    }

    function createUnbuttonToken(
        address underlying,
        string memory name,
        string memory symbol
    ) external override returns (address) {
        address clone = Clones.clone(target);
        IUnbuttonToken(clone).init(underlying, name, symbol);
        emit UnbuttonTokenCreated(clone, underlying);
        return clone;
    }
}
