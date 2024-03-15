import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment, TaskArguments } from 'hardhat/types';

const prefilledArgs: Record<string, TaskArguments> = {
  arbitrum: {
    rsethratereceiver: '0x24Ae2dA0f361AA4BE46b48EB19C91e02c5e4f27E',
  },
  goerli: {
    rsethratereceiver: '0x',
  },
};

task(
  'deploy:RSETHRateReceiverOracle:prefilled',
  'Verifies on etherscan',
).setAction(async function (args: TaskArguments, hre) {
  console.log('chainId:', hre.network.config.chainId);
  console.log('Network:', hre.network.name);
  const prefilled = prefilledArgs[hre.network.name];
  if (!prefilled) {
    throw new Error('Network not supported');
  }

  const { rsethratereceiver } = prefilled;
  console.log('RSETHRateReceiver Address:', rsethratereceiver);
  await hre.run('deploy:RSETHRateReceiverOracle', { rsethratereceiver });
});

task('deploy:RSETHRateReceiverOracle')
  .addParam(
    'rsethratereceiver',
    'the RSETHRateReceiver address',
    undefined,
    types.string,
    false,
  )
  .setAction(async function (args: TaskArguments, hre) {
    const { rsethratereceiver } = args;
    console.log(
      'Signer',
      await (await hre.ethers.getSigners())[0].getAddress(),
    );
    const RSETHRateReceiverOracle = await hre.ethers.getContractFactory(
      'RSETHRateReceiverOracle',
    );
    const rSETHRateReceiverOracle = await RSETHRateReceiverOracle.deploy(
      rsethratereceiver,
    );
    await rSETHRateReceiverOracle.deployed();
    console.log(
      `RSETHRateReceiverOracle deployed to ${rSETHRateReceiverOracle.address}`,
    );

    try {
      await hre.run('verify:verify', {
        address: rSETHRateReceiverOracle.address,
        constructorArguments: [rsethratereceiver],
      });
    } catch (e) {
      console.log('Unable to verify on etherscan', e);
    }
  });

task('verify:RSETHRateReceiverOracle:prefilled', 'Verifies on etherscan')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    console.log('chainId:', hre.network.config.chainId);
    console.log('Network:', hre.network.name);

    const prefilled = prefilledArgs[hre.network.name];
    if (!prefilled) {
      throw new Error('Network not supported');
    }
    const { rsethratereceiver } = prefilled;

    const { address } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [rsethratereceiver],
    });
  });

task('verify:RSETHRateReceiverOracle', 'Verifies on etherscan')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .addParam(
    'rsethratereceiver',
    'the RSETHRateReceiver address',
    undefined,
    types.string,
    false,
  )
  .setAction(async function (args: TaskArguments, hre) {
    const { address, rsethratereceiver } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [rsethratereceiver],
    });
  });
