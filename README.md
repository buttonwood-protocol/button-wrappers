# Button Token

The Button token smart contract system which wrap ERC20 tokens and creates a new ERC20 asset that maintains the value of the underlying token, while keeping the unit value at or near $1. ButtonTokens are elastic supply tokens whose supply is rebased frequently in order to maintain the invariants described above.

Example Functionality: Manny “wraps” 1 Ether when the price of Ether is $1800. Manny receives 1800 ButtonEther tokens in return. The overall value of their ButtonEther is the same as their original Ether, however each unit is now priced at exactly $1. The next day, the price of Ether changes to $1900. The ButtonEther system detects this price change, and rebases such that Manny’s balance is now 1900 ButtonEther tokens, still priced at $1 each.

The smart contract system for ButtonTokens will be based off of the Ampleforth protocol. Ampleforth is an elastic supply token whose unit price is also pegged to $1, but whose total value can move freely. ButtonTokens are slightly different as they are fully collateralized. While in theory the value of a buttonToken can fluctuate freely, we expect it will trade on the market at or nearly at its collateral value. Thus, if rebasing properly, we expect the unit price for a buttonToken to stay at $1. More details about the Ampleforth protocol can be found here.


## Install

```bash
# Install project dependencies
yarn
```

## Testing

```bash
# Run all unit tests (compatible with node v12+)
yarn test
```

## Contribute

To report bugs within this package, create an issue in this repository.
When submitting code ensure that it is free of lint errors and has 100% test coverage.

```bash
# Lint code
yarn lint

# Format code
yarn format

# Run solidity coverage report (compatible with node v12)
yarn coverage

# Run solidity gas usage report
yarn profile
```

## License

[GNU General Public License v3.0](./LICENSE)
