import { task, types } from 'hardhat/config';
import { TaskArguments } from 'hardhat/types';

const argsMainnet = {
  amplEthOracle: '0x492575FDD11a0fCf2C6C719867890a7648d526eB',
  ethUsdOracle: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
  wampl: '0xEDB171C18cE90B633DB442f2A6F72874093b49Ef',
  stalenessThresholdSecs: 86400,
};

const argsKovan = {
  amplEthOracle: '0x562C092bEb3a6DF77aDf0BB604F52c018E4f2814',
  ethUsdOracle: '0x9326BFA02ADD2366b30bacB125260Af641031331',
  wampl: '0xD012092D13e5a4aa7A9032335B380C62Fc707232',
  stalenessThresholdSecs: 86400,
};

task('deploy:WamplOracle:mainnet', 'Verifies on etherscan').setAction(
  async function (args: TaskArguments, hre) {
    const { amplEthOracle, ethUsdOracle, wampl, stalenessThresholdSecs } =
      argsMainnet;
    await hre.run('deploy:WamplOracle', {
      amplEthOracle,
      ethUsdOracle,
      wampl,
      stalenessThresholdSecs,
    });
  },
);

task('deploy:WamplOracle:kovan', 'Verifies on etherscan').setAction(
  async function (args: TaskArguments, hre) {
    const { amplEthOracle, ethUsdOracle, wampl, stalenessThresholdSecs } =
      argsKovan;
    await hre.run('deploy:WamplOracle', {
      amplEthOracle,
      ethUsdOracle,
      wampl,
      stalenessThresholdSecs,
    });
  },
);

task('deploy:WamplOracle')
  .addParam(
    'amplEthOracle',
    'the AMPL/ETH oracle address',
    undefined,
    types.string,
    false,
  )
  .addParam(
    'ethUsdOracle',
    'the ETH/USD oracle address',
    undefined,
    types.string,
    false,
  )
  .addParam('wampl', 'the WAMPL token address', undefined, types.string, false)
  .addParam(
    'stalenessThresholdSecs',
    'the number of seconds before refresh',
    undefined,
    types.int,
    false,
  )
  .setAction(async function (_args: TaskArguments, hre) {
    const { amplEthOracle, ethUsdOracle, wampl, stalenessThresholdSecs } =
      _args;
    console.log(
      'Signer',
      await (await hre.ethers.getSigners())[0].getAddress(),
    );
    const WamplOracle = await hre.ethers.getContractFactory('WamplOracle');
    const wamplOracle = await WamplOracle.deploy(
      amplEthOracle,
      ethUsdOracle,
      wampl,
      stalenessThresholdSecs,
    );
    await wamplOracle.deployed();
    console.log(`WamplOracle deployed to ${wamplOracle.address}`);

    try {
      await hre.run('verify:verify', {
        address: wamplOracle.address,
        constructorArguments: [
          amplEthOracle,
          ethUsdOracle,
          wampl,
          stalenessThresholdSecs,
        ],
      });
    } catch (e) {
      console.log('Unable to verify on etherscan', e);
    }
  });

task('verify:WamplOracle:mainnet', 'Verifies on etherscan')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    const { address } = args;
    const { amplEthOracle, ethUsdOracle, wampl, stalenessThresholdSecs } =
      argsMainnet;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [
        amplEthOracle,
        ethUsdOracle,
        wampl,
        stalenessThresholdSecs,
      ],
    });
  });

task('verify:WamplOracle:kovan', 'Verifies on etherscan')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    const { address } = args;
    const { amplEthOracle, ethUsdOracle, wampl, stalenessThresholdSecs } =
      argsKovan;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [
        amplEthOracle,
        ethUsdOracle,
        wampl,
        stalenessThresholdSecs,
      ],
    });
  });

task('verify:WamplOracle', 'Verifies on etherscan')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .addParam(
    'amplEthOracle',
    'the AMPL/ETH oracle address',
    undefined,
    types.string,
    false,
  )
  .addParam(
    'ethUsdOracle',
    'the ETH/USD oracle address',
    undefined,
    types.string,
    false,
  )
  .addParam('wampl', 'the WAMPL token address', undefined, types.string, false)
  .addParam(
    'stalenessThresholdSecs',
    'the number of seconds before refresh',
    undefined,
    types.int,
    false,
  )
  .setAction(async function (args: TaskArguments, hre) {
    const {
      address,
      amplEthOracle,
      ethUsdOracle,
      wampl,
      stalenessThresholdSecs,
    } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [
        amplEthOracle,
        ethUsdOracle,
        wampl,
        stalenessThresholdSecs,
      ],
    });
  });
