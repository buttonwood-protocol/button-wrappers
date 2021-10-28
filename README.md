# Button Wrappers

ERC-20 Token wrappers for the button wood ecosystem.

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


## Deployments

```yaml
mainnet:
  UnbuttonTokenFactory: "0x75ff649d6119fab43dea5e5e9e02586f27fc8b8f"
  ButtonTokenFactory: "0xfa5914837f3c225a9e6ae93f9e35d2d85f54adc5"

  instances:
    - name: "Unbuttoned AAVE AMPL"
        - symbol: "ubAAMPL"
        - underlying: "0x1e6bb68acec8fefbd87d192be09bb274170a0548"
        - address: "0xF03387d8d0FF326ab586A58E0ab4121d106147DF"
    - name: "Button ETH"
        - symbol: "bETH"
        - underlying: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
        - address: "0x125c7b36bea62ba3266257521667154446412921"
    - name: "Button BTC"
        - symbol: "bBTC"
        - underlying: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599"
        - address: "0x69d4d3629e1aFEE0C4E75B6B345B482979A77112"

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

## Bug Bounty

[Details](bug-bounty.md)
