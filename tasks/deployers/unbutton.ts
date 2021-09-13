import { task, types } from 'hardhat/config'
import { TaskArguments } from 'hardhat/types'

task('deploy:UnbuttonTokenFactory').setAction(async function (
  _args: TaskArguments,
  hre,
) {
  const TokenTemplate = await hre.ethers.getContractFactory('UnbuttonToken')
  const tokenTemplate = await TokenTemplate.deploy()
  await tokenTemplate.deployed()
  const templateAddress = tokenTemplate.address
  console.log(`UnbuttonToken template deployed to ${templateAddress}`)

  const Factory = await hre.ethers.getContractFactory('UnbuttonTokenFactory')
  const factory = await Factory.deploy(templateAddress)
  await factory.deployed()
  const factoryAddress = factory.address
  console.log(`UnbuttonTokenFactory deployed to ${factoryAddress}`)

  try {
    await hre.run('verify:UnbuttonToken', { address: templateAddress })
  } catch (e) {
    console.log('Unable to verify on etherscan', e)
  }

  try {
    await hre.run('verify:UnbuttonTokenFactory', {
      address: factoryAddress,
      template: templateAddress,
    })
  } catch (e) {
    console.log('Unable to verify on etherscan', e)
  }
})

task('verify:UnbuttonToken', 'Verifies on etherscan')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    const { address } = args

    await hre.run('verify:verify', {
      address,
      constructorArguments: [],
    })
  })

task('verify:UnbuttonTokenFactory', 'Verifies on etherscan')
  .addParam('address', 'the contract address', undefined, types.string, false)
  .addParam('template', 'the template address', undefined, types.string, false)
  .setAction(async function (args: TaskArguments, hre) {
    const { address, template } = args

    await hre.run('verify:verify', {
      address,
      constructorArguments: [template],
    })
  })
