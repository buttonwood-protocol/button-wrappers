# Notes

## Deploying `UnbuttonToken`

Run the following tasks:

```bash
yarn hardhat deploy:UnbuttonTokenFactory --network base-goerli
yarn hardhat deploy:UnbuttonToken --network base-goerli  --factory {factoryAddress} --underlying {tokenToWrapAddress} --name "Unbuttoned SEAM" --symbol ubASEAM --initialRate 1
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
