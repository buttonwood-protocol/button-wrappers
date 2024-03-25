import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment, TaskArguments } from 'hardhat/types';

const prefilledArgs: Record<string, TaskArguments> = {
  mainnet: {
    sdai: '0x83F20F44975D03b1b09e64809B757c47f942BEeA',
  },
  goerli: {
    sdai: '0xD8134205b0328F5676aaeFb3B2a0DC15f4029d8C',
  },
};

task('deploy:SDaiOracle:prefilled', 'Verifies on etherscan').setAction(
  async function (args: TaskArguments, hre) {
    console.log('chainId:', hre.network.config.chainId);
    console.log('Network:', hre.network.name);
    const prefilled = prefilledArgs[hre.network.name];
    if (!prefilled) {
      throw new Error('Network not supported');
    }

    const { sdai } = prefilled;
    console.log('sDAI Address:', sdai);
    await hre.run('deploy:SDaiOracle', { sdai });
  },
);

task('deploy:SDaiOracle')
  .addParam('sdai', 'the sDAI token address', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    const { sdai } = args;
    console.log(
      'Signer',
      await (await hre.ethers.getSigners())[0].getAddress(),
    );
    const SDaiOracle = await hre.ethers.getContractFactory('SDaiOracle');
    const sDaiOracle = await SDaiOracle.deploy(sdai);
    await sDaiOracle.deployed();
    console.log(`SDaiOracle deployed to ${sDaiOracle.address}`);

    try {
      await hre.run('verify:verify', {
        address: sDaiOracle.address,
        constructorArguments: [sdai],
      });
    } catch (e) {
      console.log('Unable to verify on etherscan', e);
    }
  });

task('verify:SDaiOracle:prefilled', 'Verifies on etherscan')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    console.log('chainId:', hre.network.config.chainId);
    console.log('Network:', hre.network.name);

    const prefilled = prefilledArgs[hre.network.name];
    if (!prefilled) {
      throw new Error('Network not supported');
    }
    const { sdai } = prefilled;

    const { address } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [sdai],
    });
  });

task('verify:SDaiOracle', 'Verifies on etherscan')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .addParam('sdai', 'the sDAI token address', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    const { address, sdai } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [sdai],
    });
  });
