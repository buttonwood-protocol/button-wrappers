import './test/utils/loadDotEnv';
import { HardhatUserConfig } from 'hardhat/config';
import { Wallet } from 'ethers';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';
import '@openzeppelin/hardhat-upgrades';
import '@nomiclabs/hardhat-etherscan';
import 'solidity-coverage';
import 'hardhat-gas-reporter';
import './tasks';

const DEFAULT_MNEMONIC = Wallet.createRandom().mnemonic.phrase;

export default {
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY,
      goerli: process.env.ETHERSCAN_API_KEY,
      'base-goerli': process.env.BASE_API_KEY,
      'base-mainnet': process.env.BASE_API_KEY,
      avalanche: process.env.SNOWTRACE_API_KEY,
      fuji: process.env.SNOWTRACE_API_KEY,
      arbitrumOne: process.env.ARBISCAN_API_KEY,
    },
    customChains: [
      {
        network: 'base-mainnet',
        chainId: 8453,
        urls: {
          apiURL: 'https://api.basescan.org/api',
          browserURL: 'https://basescan.org',
        },
      },
      {
        network: 'base-goerli',
        chainId: 84531,
        urls: {
          apiURL: 'https://api-goerli.basescan.org/api',
          browserURL: 'https://goerli.basescan.org',
        },
      },
    ],
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
    'base-mainnet': {
      url: 'https://mainnet.base.org',
      accounts: process.env.PROD_PKEY
        ? [process.env.PROD_PKEY]
        : {
            mnemonic: process.env.PROD_MNEMONIC || DEFAULT_MNEMONIC,
          },
      gasPrice: 1000000000,
    },
    'base-goerli': {
      url: 'https://goerli.base.org',
      accounts: process.env.DEV_PKEY
        ? [process.env.DEV_PKEY]
        : {
            mnemonic: process.env.DEV_MNEMONIC || DEFAULT_MNEMONIC,
          },
      gasPrice: 1000000000,
    },
    fuji: {
      url: 'https://api.avax-test.network/ext/bc/C/rpc',
      accounts: process.env.AVAX_DEV_PKEY
        ? [process.env.AVAX_DEV_PKEY]
        : {
            mnemonic: process.env.DEV_MNEMONIC || DEFAULT_MNEMONIC,
          },
      gasPrice: 225000000000,
      chainId: 43113,
    },
    avalanche: {
      url: 'https://api.avax.network/ext/bc/C/rpc',
      accounts: process.env.AVAX_PROD_PKEY
        ? [process.env.AVAX_PROD_PKEY]
        : {
            mnemonic: process.env.PROD_MNEMONIC || DEFAULT_MNEMONIC,
          },
      gasPrice: 225000000000,
      chainId: 43114,
    },
    arbitrum: {
      url: 'https://arb1.arbitrum.io/rpc',
      accounts: process.env.ARB_PROD_PKEY
        ? [process.env.ARB_PROD_PKEY]
        : {
            mnemonic: process.env.PROD_MNEMONIC || DEFAULT_MNEMONIC,
          },
      chainId: 42161,
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
} as HardhatUserConfig;
