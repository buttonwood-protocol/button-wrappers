import { task, types } from 'hardhat/config';
import { TaskArguments } from 'hardhat/types';

task('deploy:ChainlinkOracle')
  .addParam('aggregator', 'the address of the backing chainlink aggregator')
  .addParam('stalenessthresholdsecs', 'the number of seconds before refresh')
  .setAction(async function (args: TaskArguments, hre) {
    const { aggregator, stalenessthresholdsecs } = args;
    const ChainlinkOracle = await hre.ethers.getContractFactory(
      'ChainlinkOracle',
    );
    const oracle = await ChainlinkOracle.deploy(
      aggregator,
      stalenessthresholdsecs,
    );
    await oracle.deployed();
    const oracleAddress = oracle.address;
    console.log(`Oracle deployed to ${oracleAddress}`);

    try {
      await hre.run('verify:ChainlinkOracle', {
        address: oracleAddress,
        aggregator,
        stalenessthresholdsecs,
      });
    } catch (e) {
      console.log('Unable to verify on etherscan', e);
    }
  });

task('verify:ChainlinkOracle')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .addParam('aggregator', 'the address of the backing chainlink aggregator')
  .addParam('stalenessthresholdsecs', 'the number of seconds before refresh')
  .setAction(async function (args: TaskArguments, hre) {
    const { address, aggregator, stalenessthresholdsecs } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [aggregator, stalenessthresholdsecs],
    });
  });
