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

  instances:
    - name: "Unbuttoned AAVE AMPL"
    - symbol: "ubAAMPL"
    - underlying: "0x1e6bb68acec8fefbd87d192be09bb274170a0548"
    - address: "0xF03387d8d0FF326ab586A58E0ab4121d106147DF"

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
