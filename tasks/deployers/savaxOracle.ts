import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment, TaskArguments } from 'hardhat/types';

const argsAvalanche = {
  savax: '0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE',
};

const argsFuji = {
  savax: '0x0',
};

task('deploy:SavaxOracle:prefilled', 'Verifies on snowtrace').setAction(
  async function (args: TaskArguments, hre) {
    console.log('chainId:', hre.network.config.chainId);
    console.log('Network:', hre.network.name);
    if (hre.network.name === 'fuji') {
      args = argsFuji;
    } else if (hre.network.name === 'avalanche') {
      args = argsAvalanche;
    } else {
      throw new Error('Network not supported');
    }
    const { savax } = args;
    console.log('Savax Address:', savax);
    await hre.run('deploy:SavaxOracle', { savax });
  },
);

task('deploy:SavaxOracle')
  .addParam('savax', 'the sAVAX token address', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    const { savax } = args;
    console.log(
      'Signer',
      await (await hre.ethers.getSigners())[0].getAddress(),
    );
    const SavaxOracle = await hre.ethers.getContractFactory('SavaxOracle');
    const savaxOracle = await SavaxOracle.deploy(savax);
    await savaxOracle.deployed();
    console.log(`SavaxOracle deployed to ${savaxOracle.address}`);

    try {
      await hre.run('verify:verify', {
        address: savaxOracle.address,
        constructorArguments: [savax],
      });
    } catch (e) {
      console.log('Unable to verify on snowtrace', e);
    }
  });

task('verify:SavaxOracle:prefilled', 'Verifies on snowtrace')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    console.log('chainId:', hre.network.config.chainId);
    console.log('Network:', hre.network.name);
    let savax;
    if (hre.network.name === 'fuji') {
      savax = argsFuji.savax;
    } else if (hre.network.name === 'avalanche') {
      savax = argsAvalanche.savax;
    } else {
      throw new Error('Network not supported');
    }
    const { address } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [savax],
    });
  });

task('verify:SavaxOracle', 'Verifies on snowtrace')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .addParam('savax', 'the sAVAX token address', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    const { address, savax } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [savax],
    });
  });
