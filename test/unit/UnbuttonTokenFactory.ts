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
  unbuttonToken: Contract,
  unbuttonTokenFactory: Contract

async function cloneUnbutton(
  unbuttonTokenFactory: Contract,
  targetAddress: String,
  name: String,
  symbol: String,
) {
  const transaction = await unbuttonTokenFactory.createUnbuttonToken(
    targetAddress,
    name,
    symbol,
  )
  const receipt = await transaction.wait()
  if (
    receipt &&
    receipt.events &&
    receipt.events.length === 1 &&
    receipt.events[0].args
  ) {
    return await ethers.getContractAt(
      'UnbuttonToken',
      receipt.events[0].args.newUnbuttonTokenAddress,
    )
  } else {
    throw new Error('Unable to create new unbuttonToken clone')
  }
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

  const unbuttonTokenContractFactory = await ethers.getContractFactory(
    'UnbuttonToken',
  )
  unbuttonToken = await unbuttonTokenContractFactory.connect(deployer).deploy()
  // unbuttonToken.init(mockAmpl.address, NAME, SYMBOL)

  const unbuttonTokenFactoryContractFactory = await ethers.getContractFactory(
    'UnbuttonTokenFactory',
  )
  unbuttonTokenFactory = await unbuttonTokenFactoryContractFactory
    .connect(deployer)
    .deploy(unbuttonToken.address)
}

describe('UnbuttonTokenFactory', () => {
  before('setup UnbuttonTokenFactory contract', setupContracts)

  it('should reject any ether sent to it', async function () {
    const user = accounts[1]
    await expect(
      user.sendTransaction({ to: unbuttonTokenFactory.address, value: 1 }),
    ).to.be.reverted
  })
})

describe('UnbuttonToken:Initialization', () => {
  beforeEach('setup UnbuttonTokenFactory contract', setupContracts)

  it('should set the correct target reference', async function () {
    expect(await unbuttonTokenFactory.target()).to.eq(unbuttonToken.address)
    expect(await unbuttonTokenFactory.instanceCount()).to.eq(0)
    expect(
      await unbuttonTokenFactory['containsInstance(address,string,string)'](
        mockAmpl.address,
        'UNBUTTON-Ampleforth',
        'UNBUTTON-AMPL',
      ),
    ).to.eq(false)
  })
})

describe('UnbuttonToken:createUnbuttonToken', () => {
  beforeEach('setup UnbuttonTokenFactory contract', setupContracts)

  it('Clone should have proper parameters set', async function () {
    let unbuttonTokenClone: Contract = await cloneUnbutton(
      unbuttonTokenFactory,
      mockAmpl.address,
      'UNBUTTON-Ampleforth',
      'UNBUTTON-AMPL',
    )

    expect(await unbuttonTokenClone.underlying()).to.eq(mockAmpl.address)
    expect(await unbuttonTokenClone.name()).to.eq('UNBUTTON-Ampleforth')
    expect(await unbuttonTokenClone.symbol()).to.eq('UNBUTTON-AMPL')
    expect(await unbuttonTokenClone.totalSupply()).to.eq('0')
    expect(await unbuttonTokenClone.totalUnderlying()).to.eq('0')
  })

  it('Instance should register into instanceSet', async function () {
    let unbuttonTokenClone: Contract = await cloneUnbutton(
      unbuttonTokenFactory,
      mockAmpl.address,
      'UNBUTTON-Ampleforth',
      'UNBUTTON-AMPL',
    )

    expect(await unbuttonTokenFactory.instanceCount()).to.eq(1)
    expect(await unbuttonTokenFactory.instanceAt(0)).to.eq(
      unbuttonTokenClone.address,
    )
    expect(
      await unbuttonTokenFactory['containsInstance(address)'](
        unbuttonTokenClone.address,
      ),
    ).to.eq(true)
    expect(
      await unbuttonTokenFactory['containsInstance(address,string,string)'](
        mockAmpl.address,
        'UNBUTTON-Ampleforth',
        'UNBUTTON-AMPL',
      ),
    ).to.eq(true)
  })

  it('Instance should fail to register same parameters into instanceSet twice', async function () {
    let unbuttonTokenClone1: Contract = await cloneUnbutton(
      unbuttonTokenFactory,
      mockAmpl.address,
      'UNBUTTON-Ampleforth',
      'UNBUTTON-AMPL',
    )

    expect(
      await unbuttonTokenFactory['containsInstance(address,string,string)'](
        mockAmpl.address,
        'UNBUTTON-Ampleforth',
        'UNBUTTON-AMPL',
      ),
    ).to.eq(true)

    await expect(
      cloneUnbutton(
        unbuttonTokenFactory,
        mockAmpl.address,
        'UNBUTTON-Ampleforth',
        'UNBUTTON-AMPL',
      ),
    ).to.be.reverted
  })
})
