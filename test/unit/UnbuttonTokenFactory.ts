import { ethers } from 'hardhat'
import { Contract, Signer, BigNumber } from 'ethers'
import { expect } from 'chai'

const startingMultiplier = 10000
const multiplierGranularity = 10000

let accounts: Signer[],
  deployer: Signer,
  deployerAddress: string,
  userA: Signer,
  userAAddress: string,
  userB: Signer,
  userBAddress: string,
  userC: Signer,
  userCAddress: string,
  mockAmpl: Contract,
  template: Contract,
  factory: Contract

async function createInstance(
  factory: Contract,
  underlying: String,
  name: String,
  symbol: String,
) {
  const args = ethers.utils.defaultAbiCoder.encode(
    ['address', 'string', 'string'],
    [underlying, name, symbol],
  )
  const instanceAddress = await factory.callStatic['create(bytes)'](args)
  await factory.create(args)

  const instance = (await ethers.getContractFactory('UnbuttonToken'))
    .connect(deployer)
    .attach(instanceAddress)
  return instance
}

async function setupContracts() {
  accounts = await ethers.getSigners()
  deployer = accounts[0]
  userA = accounts[1]
  userB = accounts[2]
  userC = accounts[3]

  deployerAddress = await deployer.getAddress()
  userAAddress = await userA.getAddress()
  userBAddress = await userB.getAddress()
  userCAddress = await userC.getAddress()

  const rebasingErc20ContractFactory = await ethers.getContractFactory(
    'MockRebasingERC20',
  )
  mockAmpl = await rebasingErc20ContractFactory
    .connect(deployer)
    .deploy('Ampleforth', 'AMPL', startingMultiplier, multiplierGranularity)
  await mockAmpl.mint(deployerAddress, '100000')

  const unbuttonTokenContractFactory = await ethers.getContractFactory(
    'UnbuttonToken',
  )
  template = await unbuttonTokenContractFactory.connect(deployer).deploy()

  factory = await (await ethers.getContractFactory('UnbuttonTokenFactory'))
    .connect(deployer)
    .deploy(template.address)
}

describe('UnbuttonTokenFactory', () => {
  before('setup UnbuttonTokenFactory contract', setupContracts)

  it('should reject any ether sent to it', async function () {
    const user = accounts[1]
    await expect(user.sendTransaction({ to: factory.address, value: 1 })).to.be
      .reverted
  })
})

describe('UnbuttonToken:Initialization', () => {
  beforeEach('setup UnbuttonTokenFactory contract', setupContracts)

  it('should set the correct template reference', async function () {
    expect(await factory.template()).to.eq(template.address)
    expect(await factory.instanceCount()).to.eq(0)
  })
})

describe('UnbuttonToken:create', () => {
  beforeEach('setup UnbuttonTokenFactory contract', setupContracts)

  it('Clone should have proper parameters set', async function () {
    await mockAmpl.approve(factory.address, await template.MINIMUM_DEPOSIT())
    const ubToken = await createInstance(
      factory,
      mockAmpl.address,
      'UNBUTTON-Ampleforth',
      'UNBUTTON-AMPL',
    )

    expect(await ubToken.underlying()).to.eq(mockAmpl.address)
    expect(await ubToken.name()).to.eq('UNBUTTON-Ampleforth')
    expect(await ubToken.symbol()).to.eq('UNBUTTON-AMPL')
    expect(await ubToken.totalSupply()).to.eq('1000000000')
    expect(await ubToken.totalUnderlying()).to.eq('1000')
  })

  it('Instance should register into instanceSet', async function () {
    await mockAmpl.approve(factory.address, await template.MINIMUM_DEPOSIT())
    const ubToken = await createInstance(
      factory,
      mockAmpl.address,
      'UNBUTTON-Ampleforth',
      'UNBUTTON-AMPL',
    )

    expect(await factory.instanceCount()).to.eq(1)
    expect(await factory.instanceAt(0)).to.eq(ubToken.address)
    expect(await factory.isInstance(ubToken.address)).to.eq(true)
  })
})
