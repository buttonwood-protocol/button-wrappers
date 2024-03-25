import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment, TaskArguments } from 'hardhat/types';

const prefilledArgs: Record<string, TaskArguments> = {
  mainnet: {
    sweth: '0xf951E335afb289353dc249e82926178EaC7DEd78',
  },
  goerli: {
    sweth: '0x8bb383A752Ff3c1d510625C6F536E3332327068F',
  },
};

task('deploy:SwETHOracle:prefilled', 'Verifies on etherscan').setAction(
  async function (args: TaskArguments, hre) {
    console.log('chainId:', hre.network.config.chainId);
    console.log('Network:', hre.network.name);
    const prefilled = prefilledArgs[hre.network.name];
    if (!prefilled) {
      throw new Error('Network not supported');
    }

    const { sweth } = prefilled;
    console.log('swETH Address:', sweth);
    await hre.run('deploy:SwETHOracle', { sweth });
  },
);

task('deploy:SwETHOracle')
  .addParam('sweth', 'the swETH token address', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    const { sweth } = args;
    console.log(
      'Signer',
      await (await hre.ethers.getSigners())[0].getAddress(),
    );
    const SwETHOracle = await hre.ethers.getContractFactory('SwETHOracle');
    const swETHOracle = await SwETHOracle.deploy(sweth);
    await swETHOracle.deployed();
    console.log(`SwETHOracle deployed to ${swETHOracle.address}`);

    try {
      await hre.run('verify:verify', {
        address: swETHOracle.address,
        constructorArguments: [sweth],
      });
    } catch (e) {
      console.log('Unable to verify on etherscan', e);
    }
  });

task('verify:SwETHOracle:prefilled', 'Verifies on etherscan')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    console.log('chainId:', hre.network.config.chainId);
    console.log('Network:', hre.network.name);

    const prefilled = prefilledArgs[hre.network.name];
    if (!prefilled) {
      throw new Error('Network not supported');
    }
    const { sweth } = prefilled;

    const { address } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [sweth],
    });
  });

task('verify:SwETHOracle', 'Verifies on etherscan')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .addParam('sweth', 'the swETH token address', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    const { address, sweth } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [sweth],
    });
  });
