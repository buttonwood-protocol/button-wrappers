import { task, types } from 'hardhat/config';
import { TaskArguments } from 'hardhat/types';

task('deploy:MockERC20')
  .addParam('name', 'the token name', undefined, types.string, false)
  .addParam('symbol', 'the token symbol', undefined, types.string, false)
  .setAction(async function (_args: TaskArguments, hre) {
    const { name, symbol } = _args;
    console.log(
      'Signer',
      await (await hre.ethers.getSigners())[0].getAddress(),
    );
    const MockERC20 = await hre.ethers.getContractFactory('MockERC20');
    const mockERC20 = await MockERC20.deploy(name, symbol);
    await mockERC20.deployed();
    const mockERC20Address = mockERC20.address;
    console.log(`MockERC20 deployed to ${mockERC20Address}`);

    try {
      await hre.run('verify:MockERC20', {
        address: mockERC20Address,
        name,
        symbol,
      });
    } catch (e) {
      console.log('Unable to verify on etherscan', e);
    }
  });

task('verify:MockERC20', 'Verifies on etherscan')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .addParam('name', 'the token name', undefined, types.string, false)
  .addParam('symbol', 'the token symbol', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    const { address, name, symbol } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [name, symbol],
    });
  });
