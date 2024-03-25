import { task, types } from 'hardhat/config';
import { TaskArguments } from 'hardhat/types';

task('deploy:MockOracle').setAction(async function (_args: TaskArguments, hre) {
  const { name, symbol } = _args;
  console.log('Signer', await (await hre.ethers.getSigners())[0].getAddress());
  const MockOracle = await hre.ethers.getContractFactory('MockOracle');
  const mockOracle = await MockOracle.deploy();
  await mockOracle.deployed();
  const mockOracleAddress = mockOracle.address;
  console.log(`MockOracle deployed to ${mockOracleAddress}`);

  try {
    await hre.run('verify:MockOracle', { address: mockOracleAddress });
  } catch (e) {
    console.log('Unable to verify on etherscan', e);
  }
});

task('verify:MockOracle', 'Verifies on etherscan')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    const { address } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [],
    });
  });
