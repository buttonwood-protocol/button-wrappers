import { ethers, upgrades } from 'hardhat'
import { Contract, Signer, BigNumber, BigNumberish } from 'ethers'
import { expect } from 'chai'

const PRICE_DECIMALS = 8
const DECIMALS = 18
const NAME = 'Button Bitcoin'
const SYMBOL = 'BTN-BTC'

const toOracleValue = (v: string): BigNumber =>
  ethers.utils.parseUnits(v, PRICE_DECIMALS)

const toFixedPtAmt = (a: string): BigNumber =>
  ethers.utils.parseUnits(a, DECIMALS)

const transferAmount = toFixedPtAmt('10')
const unitTokenAmount = toFixedPtAmt('1')

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
  // mockOracle: Contract,
  unButtonToken: Contract,
  collateralSupply: BigNumber,
  cbA: BigNumber,
  cbB: BigNumber

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

  const rebasingErc20Factory = await ethers.getContractFactory('MockRebasingERC20')
  mockAmpl = await rebasingErc20Factory
    .connect(deployer)
    .deploy('Ampleforth', 'AMPL', 10000, 10000);

  // const oracleFactory = await ethers.getContractFactory('MockOracle')
  // mockOracle = await oracleFactory.connect(deployer).deploy()
  // await mockOracle.setData(toOracleValue('10000'), true)

  const unbuttonTokenFactory = await ethers.getContractFactory('UnbuttonToken')
  unButtonToken = await unbuttonTokenFactory
    .connect(deployer)
    .deploy(NAME, SYMBOL, mockAmpl.address)
}

function eqAprox(x: BigNumber, y: BigNumberish, diff: BigNumberish = '1') {
  expect(x.sub(y).abs()).lte(diff).gte('0')
}

describe('UnbuttonToken', () => {
  before('setup UnbuttonToken contract', setupContracts)

  it('should reject any ether sent to it', async function () {
    const user = accounts[1]
    await expect(user.sendTransaction({ to: unButtonToken.address, value: 1 })).to
      .be.reverted
  })
})


describe('UnbuttonToken:Initialization', () => {
  beforeEach('setup UnbuttonToken contract', setupContracts)

  it('should set the asset reference', async function () {
    expect(await unButtonToken.asset()).to.eq(mockAmpl.address)
  })

  it('should set detailed erc20 info parameters', async function () {
    expect(await unButtonToken.name()).to.eq(NAME)
    expect(await unButtonToken.symbol()).to.eq(SYMBOL)
    expect(await unButtonToken.decimals()).to.eq(await mockAmpl.decimals())
  })

  it('should set the erc20 balance and supply parameters', async function () {
    eqAprox(await unButtonToken.totalSupply(), '0')
    eqAprox(await unButtonToken.balanceOf(deployerAddress), '0')
  })
})

describe('UnbuttonToken:Contraction', () => {
  beforeEach('setup UnbuttonToken contract', setupContracts)

  it('should see deposited erc20 balance shrink', async function () {
    eqAprox(await unButtonToken.totalSupply(), '0')
    eqAprox(await unButtonToken.balanceOf(deployerAddress), '0')

    await mockAmpl.mint(deployerAddress, '2000');
    await mockAmpl.connect(deployer).approve(unButtonToken.address, '1000');
    await unButtonToken.connect(deployer).deposit('1000');
    console.log((await unButtonToken.totalSupply()).toString())
    console.log((await unButtonToken.balanceOf(deployerAddress)).toString())
    // eqAprox(await unButtonToken.totalSupply(), '100')
    // eqAprox(await unButtonToken.balanceOf(deployerAddress), '100')

    // await mockAmpl.rebase(5000)
    // eqAprox(await unButtonToken.totalSupply(), '50')
    // eqAprox(await unButtonToken.balanceOf(deployerAddress), '50')
  })
})