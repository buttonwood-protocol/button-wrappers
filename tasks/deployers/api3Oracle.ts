import { task, types } from 'hardhat/config';
import { TaskArguments } from 'hardhat/types';

task('deploy:API3Oracle')
  .addParam('dapiproxy', 'the address of the underlying DapiProxy contract')
  .addParam('stalenessthresholdsecs', 'the number of seconds before refresh')
  .setAction(async function (args: TaskArguments, hre) {
    const { dapiproxy, stalenessthresholdsecs } = args;
    const API3Oracle = await hre.ethers.getContractFactory('API3Oracle');
    const oracle = await API3Oracle.deploy(dapiproxy, stalenessthresholdsecs);
    await oracle.deployed();
    const oracleAddress = oracle.address;
    console.log(`Oracle deployed to ${oracleAddress}`);

    try {
      await hre.run('verify:API3Oracle', {
        address: oracleAddress,
        dapiproxy,
        stalenessthresholdsecs,
      });
    } catch (e) {
      console.log('Unable to verify on etherscan', e);
    }
  });

task('verify:API3Oracle')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .addParam('dapiproxy', 'the address of the underlying DapiProxy contract')
  .addParam('stalenessthresholdsecs', 'the number of seconds before refresh')
  .setAction(async function (args: TaskArguments, hre) {
    const { address, dapiproxy, stalenessthresholdsecs } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [dapiproxy, stalenessthresholdsecs],
    });
  });
