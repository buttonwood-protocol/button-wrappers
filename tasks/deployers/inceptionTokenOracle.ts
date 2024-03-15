import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment, TaskArguments } from 'hardhat/types';

const prefilledArgs: Record<string, TaskArguments> = {
  mainnet: {
    steth: {
      inceptionvault: '0x814CC6B8fd2555845541FB843f37418b05977d8d',
    },
    ankreth: {
      inceptionvault: '0x36B429439AB227fAB170A4dFb3321741c8815e55',
    },
  },
  goerli: {
    steth: {
      inceptionvault: '0x',
    },
    ankreth: {
      inceptionvault: '0x',
    },
  },
};

task('deploy:InceptionTokenOracle:prefilled', 'Verifies on etherscan')
  .addParam(
    'underlying',
    'the underlying token name',
    undefined,
    types.string,
    false,
  )
  .setAction(async function (args: TaskArguments, hre) {
    const { underlying } = args;
    console.log('chainId:', hre.network.config.chainId);
    console.log('Network:', hre.network.name);
    console.log('Underlying:', underlying);
    const prefilled = prefilledArgs[hre.network.name][underlying];
    if (!prefilled) {
      throw new Error('Network not supported');
    }

    const { inceptionvault } = prefilled;
    console.log('InceptionVault Address:', inceptionvault);
    await hre.run('deploy:InceptionTokenOracle', { inceptionvault });
  });

task('deploy:InceptionTokenOracle')
  .addParam(
    'inceptionvault',
    'the InceptionVault address',
    undefined,
    types.string,
    false,
  )
  .setAction(async function (args: TaskArguments, hre) {
    const { inceptionvault } = args;
    console.log(
      'Signer',
      await (await hre.ethers.getSigners())[0].getAddress(),
    );
    const InceptionTokenOracle = await hre.ethers.getContractFactory(
      'InceptionTokenOracle',
    );
    const inceptionTokenOracle = await InceptionTokenOracle.deploy(
      inceptionvault,
    );
    await inceptionTokenOracle.deployed();
    console.log(
      `inceptionTokenOracle deployed to ${inceptionTokenOracle.address}`,
    );

    try {
      await hre.run('verify:verify', {
        address: inceptionTokenOracle.address,
        constructorArguments: [inceptionvault],
      });
    } catch (e) {
      console.log('Unable to verify on etherscan', e);
    }
  });

task('verify:InceptionTokenOracle:prefilled', 'Verifies on etherscan')
  .addParam(
    'underlying',
    'the underlying token name',
    undefined,
    types.string,
    false,
  )
  .addParam('address', 'the contract address', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    const { underlying, address } = args;
    console.log('chainId:', hre.network.config.chainId);
    console.log('Network:', hre.network.name);
    console.log('Underlying:', underlying);

    const prefilled = prefilledArgs[hre.network.name][underlying];
    if (!prefilled) {
      throw new Error('Network not supported');
    }
    const { inceptionVault } = prefilled;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [inceptionVault],
    });
  });

task('verify:InceptionTokenOracle', 'Verifies on etherscan')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .addParam(
    'inceptionvault',
    'the InceptionVault address',
    undefined,
    types.string,
    false,
  )
  .setAction(async function (args: TaskArguments, hre) {
    const { address, inceptionvault } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [inceptionvault],
    });
  });
