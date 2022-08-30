import './test/utils/loadDotEnv'
import { HardhatUserConfig } from 'hardhat/config'
import { Wallet } from 'ethers'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import '@openzeppelin/hardhat-upgrades'
import '@nomiclabs/hardhat-etherscan'
import 'solidity-coverage'
import 'hardhat-gas-reporter'
import './tasks'

const DEFAULT_MNEMONIC = Wallet.createRandom().mnemonic.phrase

export default {
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  networks: {
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
      accounts: process.env.DEV_PKEY
        ? [process.env.DEV_PKEY]
        : {
            mnemonic: process.env.DEV_MNEMONIC || DEFAULT_MNEMONIC,
          },
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
      accounts: process.env.DEV_PKEY
        ? [process.env.DEV_PKEY]
        : {
            mnemonic: process.env.DEV_MNEMONIC || DEFAULT_MNEMONIC,
          },
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
      accounts: process.env.DEV_PKEY
        ? [process.env.DEV_PKEY]
        : {
            mnemonic: process.env.DEV_MNEMONIC || DEFAULT_MNEMONIC,
          },
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
      accounts: process.env.PROD_PKEY
        ? [process.env.PROD_PKEY]
        : {
            mnemonic: process.env.PROD_MNEMONIC || DEFAULT_MNEMONIC,
          },
    },
  },
  solidity: {
    compilers: [
      {
        version: '0.8.4',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  mocha: {
    timeout: 1000000,
  },
  gasReporter: {
    currency: 'USD',
    enabled: process.env.REPORT_GAS ? true : false,
    excludeContracts: ['mocks/'],
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
} as HardhatUserConfig
