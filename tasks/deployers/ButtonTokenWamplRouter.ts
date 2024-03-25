import { task, types } from 'hardhat/config';
import { TaskArguments } from 'hardhat/types';

task('deploy:ButtonTokenWamplRouter')
  .addParam('wampl', 'the address of wampl', undefined, types.string, false)
  .setAction(async function (_args: TaskArguments, hre) {
    const { wampl } = _args;
    console.log(
      'Signer',
      await (await hre.ethers.getSigners())[0].getAddress(),
    );
    const ButtonTokenWamplRouter = await hre.ethers.getContractFactory(
      'ButtonTokenWamplRouter',
    );
    const buttonTokenWamplRouter = await ButtonTokenWamplRouter.deploy(wampl);
    await buttonTokenWamplRouter.deployed();
    const buttonTokenWamplRouterAddress = buttonTokenWamplRouter.address;
    console.log(
      `ButtonTokenWamplRouter deployed to ${buttonTokenWamplRouterAddress}`,
    );

    try {
      await hre.run('verify:ButtonTokenWamplRouter', {
        address: buttonTokenWamplRouterAddress,
        wampl,
      });
    } catch (e) {
      console.log('Unable to verify on etherscan', e);
    }
  });

task('verify:ButtonTokenWamplRouter', 'Verifies on etherscan')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .addParam('wampl', 'the address of wampl', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    const { address, wampl } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [wampl],
    });
  });
