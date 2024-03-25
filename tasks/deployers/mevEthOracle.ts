import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment, TaskArguments } from 'hardhat/types';

const prefilledArgs: Record<string, TaskArguments> = {
  mainnet: {
    meveth: '0x24Ae2dA0f361AA4BE46b48EB19C91e02c5e4f27E',
  },
  goerli: {
    meveth: '0x',
  },
};

task('deploy:MevEthOracle:prefilled', 'Verifies on etherscan').setAction(
  async function (args: TaskArguments, hre) {
    console.log('chainId:', hre.network.config.chainId);
    console.log('Network:', hre.network.name);
    const prefilled = prefilledArgs[hre.network.name];
    if (!prefilled) {
      throw new Error('Network not supported');
    }

    const { meveth } = prefilled;
    console.log('MevEth Address:', meveth);
    await hre.run('deploy:MevEthOracle', { meveth });
  },
);

task('deploy:MevEthOracle')
  .addParam(
    'meveth',
    'the mevETH token address',
    undefined,
    types.string,
    false,
  )
  .setAction(async function (args: TaskArguments, hre) {
    const { meveth } = args;
    console.log(
      'Signer',
      await (await hre.ethers.getSigners())[0].getAddress(),
    );
    const MevETHOracle = await hre.ethers.getContractFactory('MevEthOracle');
    const mevETHOracle = await MevETHOracle.deploy(meveth);
    await mevETHOracle.deployed();
    console.log(`MevEthOracle deployed to ${mevETHOracle.address}`);

    try {
      await hre.run('verify:verify', {
        address: mevETHOracle.address,
        constructorArguments: [meveth],
      });
    } catch (e) {
      console.log('Unable to verify on etherscan', e);
    }
  });

task('verify:MevEthOracle:prefilled', 'Verifies on etherscan')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    console.log('chainId:', hre.network.config.chainId);
    console.log('Network:', hre.network.name);

    const prefilled = prefilledArgs[hre.network.name];
    if (!prefilled) {
      throw new Error('Network not supported');
    }
    const { meveth } = prefilled;

    const { address } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [meveth],
    });
  });

task('verify:MevEthOracle', 'Verifies on etherscan')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .addParam(
    'meveth',
    'the mevETH token address',
    undefined,
    types.string,
    false,
  )
  .setAction(async function (args: TaskArguments, hre) {
    const { address, meveth } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [meveth],
    });
  });
