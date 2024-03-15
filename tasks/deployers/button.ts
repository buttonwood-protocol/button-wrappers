import { Signer } from '@ethersproject/abstract-signer';
import { task, types } from 'hardhat/config';
import { TaskArguments } from 'hardhat/types';

task('deploy:ButtonTokenFactory').setAction(async function (
  _args: TaskArguments,
  hre,
) {
  console.log('Signer', await (await hre.ethers.getSigners())[0].getAddress());
  const TokenTemplate = await hre.ethers.getContractFactory('ButtonToken');
  const tokenTemplate = await TokenTemplate.deploy();
  await tokenTemplate.deployed();
  const templateAddress = tokenTemplate.address;
  console.log(`ButtonToken template deployed to ${templateAddress}`);

  const Factory = await hre.ethers.getContractFactory('ButtonTokenFactory');
  const factory = await Factory.deploy(templateAddress);
  await factory.deployed();
  const factoryAddress = factory.address;
  console.log(`ButtonTokenFactory deployed to ${factoryAddress}`);

  try {
    await hre.run('verify:ButtonToken', { address: templateAddress });
  } catch (e) {
    console.log('Unable to verify on etherscan', e);
  }

  try {
    await hre.run('verify:ButtonTokenFactory', {
      address: factoryAddress,
      template: templateAddress,
    });
  } catch (e) {
    console.log('Unable to verify on etherscan', e);
  }
});

task('verify:ButtonToken', 'Verifies on etherscan')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    const { address } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [],
    });
  });

task('verify:ButtonTokenFactory', 'Verifies on etherscan')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .addParam('template', 'the template address', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    const { address, template } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [template],
    });
  });

task('deploy:ButtonToken')
  .addParam('factory', 'the reference to the button token factory')
  .addParam('underlying', 'the underlying token')
  .addParam('name', 'the name of the button token')
  .addParam('symbol', 'the symbol of button token')
  .addParam('oracle', 'the oracle address. deploy with deploy:ChainlinkOracle')
  .setAction(async function (args: TaskArguments, hre) {
    const { factory, underlying, name, symbol, oracle } = args;
    const accounts: Signer[] = await hre.ethers.getSigners();
    const deployer = accounts[0];

    const bFactory = await hre.ethers.getContractAt(
      'ButtonTokenFactory',
      factory,
    );

    const deployedAddress = await bFactory.callStatic[
      'create(address,string,string,address)'
    ](underlying, name, symbol, oracle);
    const tx = await bFactory['create(address,string,string,address)'](
      underlying,
      name,
      symbol,
      oracle,
    );
    await tx.wait();
    console.log('Successfully created tx', tx.hash);
    console.log('Token will be deployed to', deployedAddress);

    try {
      await hre.run('verify:ButtonToken', { address: deployedAddress });
    } catch (e) {
      console.log('Unable to verify on etherscan', e);
    }
  });
