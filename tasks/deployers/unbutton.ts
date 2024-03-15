import { Signer } from '@ethersproject/abstract-signer';
import { task, types } from 'hardhat/config';
import { TaskArguments } from 'hardhat/types';

task('deploy:UnbuttonTokenFactory').setAction(async function (
  _args: TaskArguments,
  hre,
) {
  const TokenTemplate = await hre.ethers.getContractFactory('UnbuttonToken');
  const tokenTemplate = await TokenTemplate.deploy();
  await tokenTemplate.deployed();
  const templateAddress = tokenTemplate.address;
  console.log(`UnbuttonToken template deployed to ${templateAddress}`);

  const Factory = await hre.ethers.getContractFactory('UnbuttonTokenFactory');
  const factory = await Factory.deploy(templateAddress);
  await factory.deployed();
  const factoryAddress = factory.address;
  console.log(`UnbuttonTokenFactory deployed to ${factoryAddress}`);

  try {
    await hre.run('verify:UnbuttonToken', { address: templateAddress });
  } catch (e) {
    console.log('Unable to verify on etherscan', e);
  }

  try {
    await hre.run('verify:UnbuttonTokenFactory', {
      address: factoryAddress,
      template: templateAddress,
    });
  } catch (e) {
    console.log('Unable to verify on etherscan', e);
  }
});

task('verify:UnbuttonToken', 'Verifies on etherscan')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    const { address } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [],
    });
  });

task('verify:UnbuttonTokenFactory', 'Verifies on etherscan')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .addParam('template', 'the template address', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    const { address, template } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [template],
    });
  });

task('deploy:UnbuttonToken')
  .addParam('factory', 'the reference to the unbutton token factory')
  .addParam('underlying', 'the underlying token')
  .addParam('name', 'the name of the unbutton token')
  .addParam('symbol', 'the symbol of unbutton token')
  .addParam('initialRate', 'the initial exchange rate')
  .setAction(async function (args: TaskArguments, hre) {
    const { ethers } = hre;
    const { factory, underlying, name, symbol, initialRate } = args;
    const accounts: Signer[] = await hre.ethers.getSigners();
    const deployer = accounts[0];
    const deployerAddress = await deployer.getAddress();

    const ubFactory = await hre.ethers.getContractAt(
      'UnbuttonTokenFactory',
      factory,
    );
    const byteArgs = ethers.utils.defaultAbiCoder.encode(
      ['address', 'string', 'string', 'uint256'],
      [underlying, name, symbol, initialRate],
    );

    const ubTemplate = await hre.ethers.getContractAt(
      'UnbuttonToken',
      await ubFactory.template(),
    );

    const underlyingToken = await hre.ethers.getContractAt(
      'IRebasingERC20',
      underlying,
    );
    const initialAllowance = await underlyingToken.allowance(
      deployerAddress,
      ubFactory.address,
    );
    const expectedAllowance = await ubTemplate.INITIAL_DEPOSIT();

    if (initialAllowance.lt(expectedAllowance)) {
      console.log('Setting allowance for initial deposit');
      await (
        await underlyingToken.approve(ubFactory.address, expectedAllowance)
      ).wait(2);
    }

    const deployedAddress = await ubFactory.callStatic.create(byteArgs);
    const tx = await ubFactory.create(byteArgs);
    console.log('Successfully created tx', tx.hash);
    console.log('Token will be deployed to', deployedAddress);
    await tx.wait(5);

    try {
      await hre.run('verify:UnbuttonToken', { address: deployedAddress });
    } catch (e) {
      console.log('Unable to verify on etherscan', e);
    }
  });
