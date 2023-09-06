# Notes

## Deploying `UnbuttonToken` on Testnet

Run the following tasks:

```bash
yarn hardhat deploy:UnbuttonTokenFactory --network base-goerli
yarn hardhat deploy:UnbuttonToken --network base-goerli  --factory {factoryAddress} --underlying {tokenToWrapAddress} --name {name} --symbol {symbol} --initialRate 1
```

Note: make sure to have the underlying of the deployed wrapped asset, since it requires and `initialrate` of funds. For example, for Seamless, need to supply assets and get aTokens before wrapping below:

```bash
# old unbutton WETH
yarn hardhat deploy:UnbuttonToken --network base-goerli  --factory 0xdB48F0FF1335b48bf73194e29Aa6c3E8dB92d8ae --underlying 0x7A71F6514bE49500712AB09D5fFeA6a9ea5C2C45 --name "Unbuttoned Aave BASE WETH" --symbol ubABASEWETH --initialrate 1

# new unbutton WETH
yarn hardhat deploy:UnbuttonToken --network base-goerli  --factory 0xdB48F0FF1335b48bf73194e29Aa6c3E8dB92d8ae --underlying 0x2311D94F5a407D1AA3D8400a7dECF8E2324A033D --name "Unbuttoned Aave BASE WETH" --symbol ubABASEWETH2 --initialrate 1
```

Created at:

```
# old unbutton WETH
Successfully created tx 0xc890c2c74ed6158a1f1706b915e7b9430c97f6964cb31b45a01db17341c9bb9f
Token will be deployed to 0xf4781a935Fe1F177f9ef65C69Fc64706a19e9F25

# new unbutton WETH
Successfully created tx 0xd5695e8c8f7d413404739634364156fff24db41085b30101783811378105f097
Token will be deployed to 0x4fc8603DAFFA1391F31c1F55b45d54E1424D6C82
```

# Deploying `UnbuttonToken` on Tenderly Fork

Replace network tag: `--network tenderly`. Make sure to have some aTokens, for now need to run the UI `interface` locally and add tenderly network manually. Then supply to get aTokens.

```bash
yarn hardhat deploy:UnbuttonTokenFactory --network tenderly
yarn hardhat deploy:UnbuttonToken --network tenderly  --factory {factoryAddress} --underlying {tokenToWrapAddress} --name {name} --symbol {symbol} --initialRate 1
```

## Tenderly Fork v2

Create wrappers of the AAVE aTokens, can grab from AAVE frontend

```bash
yarn hardhat deploy:UnbuttonTokenFactory --network tenderly

yarn hardhat deploy:UnbuttonToken --network tenderly --factory 0x8676837f4cC1ad747a8270b6A2991AB0d0adeA10 --underlying 0x350B43b4C0757E2f589CACab7AD51aA74762F47B --name "Unbuttoned Aave BASE USDBC" --symbol ubABASEUSDBC --initialrate 1

yarn hardhat deploy:UnbuttonToken --network tenderly --factory 0x8676837f4cC1ad747a8270b6A2991AB0d0adeA10 --underlying 0x7d00064279473c95FF1EEfAc79581405E6468aD5 --name "Unbuttoned Aave BASE WETH" --symbol ubABASEWETH --initialrate 1
```

Created at:

```
Factory:
UnbuttonToken template deployed to 0x7223EF16A5167c7e853218C17bfd6cD6Eda3567d
UnbuttonTokenFactory deployed to 0x8676837f4cC1ad747a8270b6A2991AB0d0adeA10

ubABASEUSDBC:
Successfully created tx 0x0bf97ccaae87324f141b1ff82c156c5baa7602d3fe9763b010c1962968a9e1f4
Token will be deployed to 0xf84e14984Dccf4D27267f597dC4BF74b334015b7

ubABASEWETH:
Successfully created tx 0xbb1f9c97c73de99e22227354295a4c3d6c7e68fcf077040c969b3090d0e65d70
Token will be deployed to 0x91366f8dD9F4191F6310318813D548EeAc4aA740
```

## Base Mainnet

```bash
yarn hardhat deploy:UnbuttonTokenFactory --network tenderly

yarn hardhat deploy:UnbuttonToken --network base-mainnet --factory 0x613379008101df98D4CE5a1819e9F53Fe33dc138 --underlying 0x13A13869B814Be8F13B86e9875aB51bda882E391 --name "Wrapped Seamless USDbC" --symbol wsUSDbC --initialrate 1

yarn hardhat deploy:UnbuttonToken --network base-mainnet --factory 0x613379008101df98D4CE5a1819e9F53Fe33dc138 --underlying 0x48bf8fCd44e2977c8a9A744658431A8e6C0d866c --name "Wrapped Seamless WETH" --symbol wsWETH --initialrate 1
```

Creates:

```
Factory:
UnbuttonToken template deployed to 0xf9A5D255220e14E69475c1180640eAB3f14Ba2Aa
UnbuttonTokenFactory deployed to 0x613379008101df98D4CE5a1819e9F53Fe33dc138

wsUSDbC:
Successfully created tx 0x1be67889ff36c8077a25aee0e00e13bd5aefb0239b19ba8e105958faca2eb504
Token will be deployed to 0x7A595538b91D40B411A32a9c6668D8f63c130f0c

wsWETH:
Successfully created tx 0x261631b8b7901ed9b46f32e0cac427a308e32b7b3867ecb52e26f35e67652eca
Token will be deployed to 0xAf72867FB2bFBb55FD44773733a7bc03963f701f
```

Verify contracts:

```bash
yarn hardhat verify:UnbuttonToken --network base-mainnet --address 0xf9A5D255220e14E69475c1180640eAB3f14Ba2Aa

yarn hardhat verify:UnbuttonTokenFactory --network base-mainnet --address 0x613379008101df98D4CE5a1819e9F53Fe33dc138 --template 0xf9A5D255220e14E69475c1180640eAB3f14Ba2Aa

yarn hardhat verify:UnbuttonToken --network base-mainnet --address 0x7A595538b91D40B411A32a9c6668D8f63c130f0c

yarn hardhat verify:UnbuttonToken --network base-mainnet --address 0xAf72867FB2bFBb55FD44773733a7bc03963f701f
```
