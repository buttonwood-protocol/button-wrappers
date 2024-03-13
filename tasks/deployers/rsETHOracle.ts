import { task, types } from 'hardhat/config'
import { HardhatRuntimeEnvironment, TaskArguments } from 'hardhat/types'

const prefilledArgs: Record<string, TaskArguments> = {
  'arbitrum': {
    rseth: '0x24Ae2dA0f361AA4BE46b48EB19C91e02c5e4f27E',
  },
  'goerli': {
    rseth: '0x',
  }
}

task('deploy:RsETHOracle:prefilled', 'Verifies on etherscan').setAction(
  async function (args: TaskArguments, hre) {
    console.log('chainId:', hre.network.config.chainId);
    console.log('Network:', hre.network.name);
    const prefilled = prefilledArgs[hre.network.name];
    if (!prefilled) {
      throw new Error('Network not supported')
    }

    const { rseth } = prefilled;
    console.log('Rseth Address:', rseth)
    await hre.run('deploy:RsETHOracle', { rseth })
  },
)

task('deploy:RsETHOracle')
  .addParam('rseth', 'the rsETH token address', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    const { rseth } = args;
    console.log('Signer', await (await hre.ethers.getSigners())[0].getAddress());
    const RsETHOracle = await hre.ethers.getContractFactory('RsETHOracle');
    const rsETHOracle = await RsETHOracle.deploy(rseth);
    await rsETHOracle.deployed();
    console.log(`RsETHOracle deployed to ${rsETHOracle.address}`);

    try {
      await hre.run('verify:verify', {
        address: rsETHOracle.address,
        constructorArguments: [rseth],
      })
    } catch (e) {
      console.log('Unable to verify on etherscan', e)
    }
  })

task('verify:RsETHOracle:prefilled', 'Verifies on etherscan')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    console.log('chainId:', hre.network.config.chainId);
    console.log('Network:', hre.network.name);

    const prefilled = prefilledArgs[hre.network.name];
    if (!prefilled) {
      throw new Error('Network not supported');
    }
    const { rseth } = prefilled;

    const { address } = args;

    await hre.run('verify:verify', {
      address,
      constructorArguments: [rseth],
    })
  },
)

task('verify:RsETHOracle', 'Verifies on etherscan')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .addParam('rseth', 'the rsETH token address', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    const { address, rseth } = args

    await hre.run('verify:verify', {
      address,
      constructorArguments: [rseth],
    })
  })
