import { ethers, upgrades, artifacts } from 'hardhat'
import { Contract, Signer, BigNumber, BigNumberish } from 'ethers'
import { expect } from 'chai'

const PRICE_DECIMALS = 8
const DECIMALS = 18
const NAME = 'Unbutton Ampleforth'
const SYMBOL = 'UBTN-AMPL'

const toFixedPtAmt = (a: string): BigNumber =>
  ethers.utils.parseUnits(a, DECIMALS)

const transferAmount = toFixedPtAmt('10')
const unitTokenAmount = toFixedPtAmt('1')

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
  })
})

describe('UnbuttonToken:createUnbuttonToken', () => {
  beforeEach('setup UnbuttonTokenFactory contract', setupContracts)

  it('Clone should have proper parameters set', async function () {
    const transaction = await unbuttonTokenFactory.createUnbuttonToken(
      mockAmpl.address,
      'UNBUTTON-Ampleforth',
      'UNBUTTON-AMPL',
    )

    const receipt = await transaction.wait()

    let unbuttonTokenClone: Contract
    if (
      receipt &&
      receipt.events &&
      receipt.events.length === 1 &&
      receipt.events[0].args
    ) {
      unbuttonTokenClone = await ethers.getContractAt(
        'UnbuttonToken',
        receipt.events[0].args.newUnbuttonTokenAddress,
      )
    } else {
      throw new Error('Unable to create new unbuttonToken clone')
    }

    expect(await unbuttonTokenClone.underlying()).to.eq(mockAmpl.address)
    expect(await unbuttonTokenClone.name()).to.eq('UNBUTTON-Ampleforth')
    expect(await unbuttonTokenClone.symbol()).to.eq('UNBUTTON-AMPL')
    expect(await unbuttonTokenClone.totalSupply()).to.eq('0')
    expect(await unbuttonTokenClone.totalUnderlying()).to.eq('0')
  })
})
