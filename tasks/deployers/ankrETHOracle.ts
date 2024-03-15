import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment, TaskArguments } from 'hardhat/types';

// ToDo: Change these
const prefilledArgs: Record<string, TaskArguments> = {
  mainnet: {
    ankreth: '0xE95A203B1a91a908F9B9CE46459d101078c2c3cb',
  },
  goerli: {
    ankreth: '0x63dC5749fa134fF3B752813388a7215460a8aB01',
  },
};

task('deploy:AnkrETHOracle:prefilled', 'Verifies on etherscan').setAction(
  async function (args: TaskArguments, hre) {
    console.log('chainId:', hre.network.config.chainId);
    console.log('Network:', hre.network.name);
    const prefilled = prefilledArgs[hre.network.name];
    if (!prefilled) {
      throw new Error('Network not supported');
    }

    const { ankreth } = prefilled;
    console.log('ankrETH Address:', ankreth);
    await hre.run('deploy:AnkrETHOracle', { ankreth });
  },
);

task('deploy:AnkrETHOracle')
  .addParam(
    'ankreth',
    'the ankrETH token address',
    undefined,
    types.string,
    false,
  )
  .setAction(async function (args: TaskArguments, hre) {
    const { ankreth } = args;
    console.log(
      'Signer',
      await (await hre.ethers.getSigners())[0].getAddress(),
    );
    const AnkrETHOracle = await hre.ethers.getContractFactory('AnkrETHOracle');
    const ankrETHOracle = await AnkrETHOracle.deploy(ankreth);
    await ankrETHOracle.deployed();
    console.log(`AnkrETHOracle deployed to ${ankrETHOracle.address}`);

    try {
      await hre.run('verify:verify', {
        address: ankrETHOracle.address,
        constructorArguments: [ankreth],
      });
    } catch (e) {
      console.log('Unable to verify on etherscan', e);
    }
  });

task('verify:AnkrETHOracle:prefilled', 'Verifies on etherscan')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    console.log('chainId:', hre.network.config.chainId);
    console.log('Network:', hre.network.name);

    const prefilled = prefilledArgs[hre.network.name];
    if (!prefilled) {
      throw new Error('Network not supported');
    }
    const { ankreth } = prefilled;

    const { address } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [ankreth],
    });
  });

task('verify:AnkrETHOracle', 'Verifies on etherscan')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .addParam(
    'ankreth',
    'the ankrETH token address',
    undefined,
    types.string,
    false,
  )
  .setAction(async function (args: TaskArguments, hre) {
    const { address, ankreth } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [ankreth],
    });
  });
