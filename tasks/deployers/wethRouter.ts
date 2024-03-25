import { task, types } from 'hardhat/config';
import { TaskArguments } from 'hardhat/types';

const WETH_ADDRESS: string = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

task('deploy:WethRouter').setAction(async function (_args: TaskArguments, hre) {
  console.log('Signer', await (await hre.ethers.getSigners())[0].getAddress());
  const factory = await hre.ethers.getContractFactory('ButtonTokenWethRouter');
  const router = await factory.deploy(WETH_ADDRESS);
  await router.deployed();
  const routerAddress = router.address;
  console.log(`ButtonTokenWethRouter deployed to ${routerAddress}`);

  try {
    await hre.run('verify:WethRouter', {
      address: routerAddress,
      wethAddress: WETH_ADDRESS,
    });
  } catch (e) {
    console.log('Unable to verify on etherscan', e);
  }
});

task('verify:WethRouter', 'Verifies on etherscan')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .addParam('wethAddress', 'the weth address', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    const { address, wethAddress } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [wethAddress],
    });
  });
