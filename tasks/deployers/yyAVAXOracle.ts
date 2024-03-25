import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment, TaskArguments } from 'hardhat/types';

const prefilledArgs: Record<string, TaskArguments> = {
  avalanche: {
    yyavax: '0xF7D9281e8e363584973F946201b82ba72C965D27',
  },
  fuji: {
    yyavax: '0x',
  },
};

task('deploy:YyAVAXOracle:prefilled', 'Verifies on snowtrace').setAction(
  async function (args: TaskArguments, hre) {
    console.log('chainId:', hre.network.config.chainId);
    console.log('Network:', hre.network.name);
    const prefilled = prefilledArgs[hre.network.name];
    if (!prefilled) {
      throw new Error('Network not supported');
    }

    const { yyavax } = prefilled;
    console.log('yyAVAX Address:', yyavax);
    await hre.run('deploy:YyAVAXOracle', { yyavax });
  },
);

task('deploy:YyAVAXOracle')
  .addParam(
    'yyavax',
    'the yyAVAX token address',
    undefined,
    types.string,
    false,
  )
  .setAction(async function (args: TaskArguments, hre) {
    const { yyavax } = args;
    console.log(
      'Signer',
      await (await hre.ethers.getSigners())[0].getAddress(),
    );
    const YyAVAXOracle = await hre.ethers.getContractFactory('YyAVAXOracle');
    const yyAVAXOracle = await YyAVAXOracle.deploy(yyavax);
    await yyAVAXOracle.deployed();
    console.log(`YyAVAXOracle deployed to ${yyAVAXOracle.address}`);

    try {
      await hre.run('verify:verify', {
        address: yyAVAXOracle.address,
        constructorArguments: [yyavax],
      });
    } catch (e) {
      console.log('Unable to verify on snowtrace', e);
    }
  });

task('verify:YyAVAXOracle:prefilled', 'Verifies on snowtrace')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    console.log('chainId:', hre.network.config.chainId);
    console.log('Network:', hre.network.name);

    const prefilled = prefilledArgs[hre.network.name];
    if (!prefilled) {
      throw new Error('Network not supported');
    }
    const { yyavax } = prefilled;

    const { address } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [yyavax],
    });
  });

task('verify:YyAVAXOracle', 'Verifies on snowtrace')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .addParam(
    'yyavax',
    'the yyAVAX token address',
    undefined,
    types.string,
    false,
  )
  .setAction(async function (args: TaskArguments, hre) {
    const { address, yyavax } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [yyavax],
    });
  });
