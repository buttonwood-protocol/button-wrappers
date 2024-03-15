import { task, types } from 'hardhat/config';
import { TaskArguments } from 'hardhat/types';

task('deploy:ButtonTokenWethRouter')
  .addParam('weth', 'the address of weth', undefined, types.string, false)
  .setAction(async function (_args: TaskArguments, hre) {
    const { weth } = _args;
    console.log(
      'Signer',
      await (await hre.ethers.getSigners())[0].getAddress(),
    );
    const ButtonTokenWethRouter = await hre.ethers.getContractFactory(
      'ButtonTokenWethRouter',
    );
    const buttonTokenWethRouter = await ButtonTokenWethRouter.deploy(weth);
    await buttonTokenWethRouter.deployed();
    const buttonTokenWethRouterAddress = buttonTokenWethRouter.address;
    console.log(
      `ButtonTokenWethRouter deployed to ${buttonTokenWethRouterAddress}`,
    );

    try {
      await hre.run('verify:ButtonTokenWethRouter', {
        address: buttonTokenWethRouterAddress,
        weth,
      });
    } catch (e) {
      console.log('Unable to verify on etherscan', e);
    }
  });

task('verify:ButtonTokenWethRouter', 'Verifies on etherscan')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .addParam('weth', 'the address of weth', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    const { address, weth } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [weth],
    });
  });
