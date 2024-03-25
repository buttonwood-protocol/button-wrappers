import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment, TaskArguments } from 'hardhat/types';

const prefilledArgs: Record<string, TaskArguments> = {
  mainnet: {
    staderoracle: '0xF64bAe65f6f2a5277571143A24FaaFDFC0C2a737',
  },
  goerli: {
    staderoracle: '0x22F8E700ff3912f3Caba5e039F6dfF1a24390E80',
  },
};

task('deploy:ETHxOracle:prefilled', 'Verifies on etherscan').setAction(
  async function (args: TaskArguments, hre) {
    console.log('chainId:', hre.network.config.chainId);
    console.log('Network:', hre.network.name);
    const prefilled = prefilledArgs[hre.network.name];
    if (!prefilled) {
      throw new Error('Network not supported');
    }

    const { staderoracle } = prefilled;
    console.log('staderOracle Address:', staderoracle);
    await hre.run('deploy:ETHxOracle', { staderoracle });
  },
);

task('deploy:ETHxOracle')
  .addParam(
    'staderoracle',
    'the stader oracle address',
    undefined,
    types.string,
    false,
  )
  .setAction(async function (args: TaskArguments, hre) {
    const { staderoracle } = args;
    console.log(
      'Signer',
      await (await hre.ethers.getSigners())[0].getAddress(),
    );
    const ETHxOracle = await hre.ethers.getContractFactory('ETHxOracle');
    const eTHxOracle = await ETHxOracle.deploy(staderoracle);
    await eTHxOracle.deployed();
    console.log(`ETHxOracle deployed to ${eTHxOracle.address}`);

    try {
      await hre.run('verify:verify', {
        address: eTHxOracle.address,
        constructorArguments: [staderoracle],
      });
    } catch (e) {
      console.log('Unable to verify on etherscan', e);
    }
  });

task('verify:ETHxOracle:prefilled', 'Verifies on etherscan')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    console.log('chainId:', hre.network.config.chainId);
    console.log('Network:', hre.network.name);

    const prefilled = prefilledArgs[hre.network.name];
    if (!prefilled) {
      throw new Error('Network not supported');
    }
    const { staderoracle } = prefilled;

    const { address } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [staderoracle],
    });
  });

task('verify:ETHxOracle', 'Verifies on etherscan')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .addParam(
    'staderoracle',
    'the stader oracle address',
    undefined,
    types.string,
    false,
  )
  .setAction(async function (args: TaskArguments, hre) {
    const { address, staderoracle } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [staderoracle],
    });
  });
