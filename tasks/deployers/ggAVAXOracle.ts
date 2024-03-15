import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment, TaskArguments } from 'hardhat/types';

const prefilledArgs: Record<string, TaskArguments> = {
  avalanche: {
    ggavax: '0xA25EaF2906FA1a3a13EdAc9B9657108Af7B703e3',
  },
  fuji: {
    ggavax: '0x',
  },
};

task('deploy:GgAVAXOracle:prefilled', 'Verifies on snowtrace').setAction(
  async function (args: TaskArguments, hre) {
    console.log('chainId:', hre.network.config.chainId);
    console.log('Network:', hre.network.name);
    const prefilled = prefilledArgs[hre.network.name];
    if (!prefilled) {
      throw new Error('Network not supported');
    }

    const { ggavax } = prefilled;
    console.log('ggAVAX Address:', ggavax);
    await hre.run('deploy:GgAVAXOracle', { ggavax });
  },
);

task('deploy:GgAVAXOracle')
  .addParam(
    'ggavax',
    'the ggAVAX token address',
    undefined,
    types.string,
    false,
  )
  .setAction(async function (args: TaskArguments, hre) {
    const { ggavax } = args;
    console.log(
      'Signer',
      await (await hre.ethers.getSigners())[0].getAddress(),
    );
    const GgAVAXOracle = await hre.ethers.getContractFactory('GgAVAXOracle');
    const ggAVAXOracle = await GgAVAXOracle.deploy(ggavax);
    await ggAVAXOracle.deployed();
    console.log(`GgAVAXOracle deployed to ${ggAVAXOracle.address}`);

    try {
      await hre.run('verify:verify', {
        address: ggAVAXOracle.address,
        constructorArguments: [ggavax],
      });
    } catch (e) {
      console.log('Unable to verify on snowtrace', e);
    }
  });

task('verify:GgAVAXOracle:prefilled', 'Verifies on snowtrace')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    console.log('chainId:', hre.network.config.chainId);
    console.log('Network:', hre.network.name);

    const prefilled = prefilledArgs[hre.network.name];
    if (!prefilled) {
      throw new Error('Network not supported');
    }
    const { ggavax } = prefilled;

    const { address } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [ggavax],
    });
  });

task('verify:GgAVAXOracle', 'Verifies on snowtrace')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .addParam(
    'ggavax',
    'the ggAVAX token address',
    undefined,
    types.string,
    false,
  )
  .setAction(async function (args: TaskArguments, hre) {
    const { address, ggavax } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [ggavax],
    });
  });
