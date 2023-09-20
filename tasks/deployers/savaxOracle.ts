import {task, types} from 'hardhat/config'
import {TaskArguments} from 'hardhat/types'

const argsAvalanche = {
  savax: '0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE',
}

const argsFuji = {
  savax: '0x0',
}

task('deploy:SavaxOracle:avalanche', 'Verifies on snowtrace').setAction(
  async function (args: TaskArguments, hre) {
    const {savax} = argsAvalanche
    await hre.run('deploy:SavaxOracle', {savax})
  },
)

task('deploy:SavaxOracle:fuji', 'Verifies on snowtrace').setAction(
  async function (args: TaskArguments, hre) {
    const {savax} = argsFuji
    await hre.run('deploy:SavaxOracle', {savax})
  },
)

task('deploy:SavaxOracle')
  .addParam('savax', 'the sAVAX token address', undefined, types.string, false)
  .setAction(async function (_args: TaskArguments, hre) {
    const {savax} = _args
    console.log('Signer', await (await hre.ethers.getSigners())[0].getAddress())
    const SavaxOracle = await hre.ethers.getContractFactory('SavaxOracle')
    const savaxOracle = await SavaxOracle.deploy(savax)
    await savaxOracle.deployed()
    console.log(`SavaxOracle deployed to ${savaxOracle.address}`)

    try {
      await hre.run('verify:verify', {
        address: savaxOracle.address,
        constructorArguments: [savax],
      })
    } catch (e) {
      console.log('Unable to verify on snowtrace', e)
    }
  })

task('verify:SavaxOracle:avalanche', 'Verifies on snowtrace')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    const {address} = args
    const {savax} = argsAvalanche

    await hre.run('verify:verify', {
      address,
      constructorArguments: [savax],
    })
  })

task('verify:SavaxOracle:fuji', 'Verifies on snowtrace')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    const {address} = args
    const {savax} = argsFuji

    await hre.run('verify:verify', {
      address,
      constructorArguments: [savax],
    })
  })

task('verify:SavaxOracle', 'Verifies on snowtrace')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .addParam('savax', 'the sAVAX token address', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    const {address, savax} = args

    await hre.run('verify:verify', {
      address,
      constructorArguments: [savax],
    })
  })
