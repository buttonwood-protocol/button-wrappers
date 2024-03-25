import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment, TaskArguments } from 'hardhat/types';

const prefilledArgs: Record<string, TaskArguments> = {
  mainnet: {
    rockxstaking: '0x4beFa2aA9c305238AA3E0b5D17eB20C045269E9d',
  },
  goerli: {
    rockxstaking: '0xa6E1a466626Db4927C197468026fa0A54c092492',
  },
};

task('deploy:UniETHOracle:prefilled', 'Verifies on etherscan').setAction(
  async function (args: TaskArguments, hre) {
    console.log('chainId:', hre.network.config.chainId);
    console.log('Network:', hre.network.name);
    const prefilled = prefilledArgs[hre.network.name];
    if (!prefilled) {
      throw new Error('Network not supported');
    }

    const { rockxstaking } = prefilled;
    console.log('RockXStaking Address:', rockxstaking);
    await hre.run('deploy:UniETHOracle', { rockxstaking });
  },
);

task('deploy:UniETHOracle')
  .addParam(
    'rockxstaking',
    'the RockXStaking oracle address',
    undefined,
    types.string,
    false,
  )
  .setAction(async function (args: TaskArguments, hre) {
    const { rockxstaking } = args;
    console.log(
      'Signer',
      await (await hre.ethers.getSigners())[0].getAddress(),
    );
    const UniETHOracle = await hre.ethers.getContractFactory('UniETHOracle');
    const uniETHOracle = await UniETHOracle.deploy(rockxstaking);
    await uniETHOracle.deployed();
    console.log(`UniETHOracle deployed to ${uniETHOracle.address}`);

    try {
      await hre.run('verify:verify', {
        address: uniETHOracle.address,
        constructorArguments: [rockxstaking],
      });
    } catch (e) {
      console.log('Unable to verify on etherscan', e);
    }
  });

task('verify:UniETHOracle:prefilled', 'Verifies on etherscan')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    console.log('chainId:', hre.network.config.chainId);
    console.log('Network:', hre.network.name);

    const prefilled = prefilledArgs[hre.network.name];
    if (!prefilled) {
      throw new Error('Network not supported');
    }
    const { rockxstaking } = prefilled;

    const { address } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [rockxstaking],
    });
  });

task('verify:UniETHOracle', 'Verifies on etherscan')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .addParam(
    'rockxstaking',
    'the RockXStaking contract address',
    undefined,
    types.string,
    false,
  )
  .setAction(async function (args: TaskArguments, hre) {
    const { address, rockxstaking } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [rockxstaking],
    });
  });
