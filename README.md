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

avalanche:
  ButtonTokenFactory: "0x83f6392Aab030043420D184a025e0Cd63f508798"
    
  instances:
    - name: "Button WETH"
        - symbol: "bWETH"
        - underlying: "0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab"
        - address: "0x227d7A0e2586A5bFdA7f32aDF066d20D1bfDfDfb"
    - name: "Button WAVAX"
        - symbol: "bWAVAX"
        - underlying: "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7"
        - address: "0x9f61aE42c01698aC35AedeF651B0FE5E407bC6A0"
    - name: "Button WBTC"
        - symbol: "bWBTC"
        - underlying: "0x50b7545627a5162f82a992c33b87adc75187b218"
        - address: "0x9bFE32D18e66ffAF6dcB0306AE7D24F768469f91"
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

## Notes

Note that the ButtonToken contract _does not_ work with fee-on-transfer (FoT) tokens. These tokens are not compatible with the accounting of the `deposit/mint` functions in ButtonToken.

## Bug Bounty

[Details](bug-bounty.md)
