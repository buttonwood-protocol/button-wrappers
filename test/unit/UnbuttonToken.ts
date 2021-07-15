import { ethers, upgrades } from 'hardhat'
import { Contract, Signer, BigNumber, BigNumberish } from 'ethers'
import { expect } from 'chai'

const PRICE_DECIMALS = 8
const DECIMALS = 18
const NAME = 'Unbutton Ampleforth'
const SYMBOL = 'UBTN-AMPL'

const toOracleValue = (v: string): BigNumber =>
  ethers.utils.parseUnits(v, PRICE_DECIMALS)

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
  unButtonToken: Contract

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

  const rebasingErc20Factory = await ethers.getContractFactory(
    'MockRebasingERC20',
  )
  mockAmpl = await rebasingErc20Factory
    .connect(deployer)
    .deploy('Ampleforth', 'AMPL', startingMultiplier, multiplierGranularity)

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
    await expect(user.sendTransaction({ to: unButtonToken.address, value: 1 }))
      .to.be.reverted
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

describe('UnbuttonToken Invalid Deposit', () => {
  beforeEach('setup UnbuttonToken contract', setupContracts)

  it('should fail to deposit negative amount', async function () {
    eqAprox(await unButtonToken.totalSupply(), '0')
    eqAprox(await unButtonToken.balanceOf(deployerAddress), '0')

    await mockAmpl.mint(deployerAddress, '1000')
    await mockAmpl.connect(deployer).approve(unButtonToken.address, '1000')
    await expect(
      unButtonToken.connect(deployer).deposit('-1')
    ).to.be.reverted
  })

  it('should fail to deposit below exactly min-deposit amount on first time', async function () {
    eqAprox(await unButtonToken.totalSupply(), '0')
    eqAprox(await unButtonToken.balanceOf(deployerAddress), '0')

    await mockAmpl.mint(deployerAddress, '1000')
    await mockAmpl.connect(deployer).approve(unButtonToken.address, '1000')
    await expect(
      unButtonToken.connect(deployer).deposit('1000')
    ).to.be.reverted
  })

  it('should fail to deposit below minimum deposit amount', async function () {
    eqAprox(await unButtonToken.totalSupply(), '0')
    eqAprox(await unButtonToken.balanceOf(deployerAddress), '0')

    await mockAmpl.mint(deployerAddress, '1000')
    await mockAmpl.connect(deployer).approve(unButtonToken.address, '1000')
    await expect(
      unButtonToken.connect(deployer).deposit('999')
    ).to.be.reverted
  })

  it('should fail to deposit more than balance', async function () {
    eqAprox(await unButtonToken.totalSupply(), '0')
    eqAprox(await unButtonToken.balanceOf(deployerAddress), '0')

    await mockAmpl.mint(deployerAddress, '500')
    await mockAmpl.connect(deployer).approve(unButtonToken.address, '1000')
    await expect(
      unButtonToken.connect(deployer).deposit('1000')
    ).to.be.reverted
  })

  it('should fail to deposit more than allowed', async function () {
    eqAprox(await unButtonToken.totalSupply(), '0')
    eqAprox(await unButtonToken.balanceOf(deployerAddress), '0')

    await mockAmpl.mint(deployerAddress, '1000')
    await mockAmpl.connect(deployer).approve(unButtonToken.address, '500')
    await expect(
      unButtonToken.connect(deployer).deposit('1000')
    ).to.be.reverted
  })
})

describe('UnbuttonToken Withdrawal', () => {
  beforeEach('setup UnbuttonToken contract', setupContracts)

  it('should fail to withdraw 0 tokens', async function () {
    eqAprox(await unButtonToken.totalSupply(), '0')
    eqAprox(await unButtonToken.balanceOf(deployerAddress), '0')

    await expect(
      unButtonToken.connect(userA).withdraw('0')
    ).to.be.reverted
  })

  it('should fail to withdraw more than deposited', async function () {
    eqAprox(await unButtonToken.totalSupply(), '0')
    eqAprox(await unButtonToken.balanceOf(deployerAddress), '0')


    await mockAmpl.mint(deployerAddress, '3000')
    await mockAmpl.connect(deployer).approve(unButtonToken.address, '3000')
    await unButtonToken.connect(deployer).deposit('3000')

    await expect(
      unButtonToken.connect(userA).withdraw('500000000')
    ).to.be.reverted
  })

  it('should withdraw correct amount of corresponding collateral', async function () {
    eqAprox(await unButtonToken.totalSupply(), '0')
    eqAprox(await unButtonToken.balanceOf(deployerAddress), '0')

    await mockAmpl.mint(deployerAddress, '3000')
    await mockAmpl.connect(deployer).approve(unButtonToken.address, '3000')
    await unButtonToken.connect(deployer).deposit('3000')
    eqAprox(await unButtonToken.totalSupply(), '3000000000')
    eqAprox(await unButtonToken.balanceOf(deployerAddress), '2000000000')
    eqAprox(await unButtonToken.totalDeposits(), '3000')
    eqAprox(await unButtonToken.balanceOfUnderlying(deployerAddress), '2000')

    await unButtonToken.connect(deployer).withdraw('500000000')
    eqAprox(await unButtonToken.totalSupply(), '2500000000')
    eqAprox(await unButtonToken.balanceOf(deployerAddress), '1500000000')
    eqAprox(await unButtonToken.totalDeposits(), '2500')
    eqAprox(await unButtonToken.balanceOfUnderlying(deployerAddress), '1500')
    eqAprox(await mockAmpl.balanceOf(deployerAddress), '500');
  })
});

describe('UnbuttonToken: Multiple Deposits', () => {
  beforeEach('setup UnbuttonToken contract', setupContracts)

  it('should see 2nd user able to deposit exactly min-deposit', async function() {
    eqAprox(await unButtonToken.totalSupply(), '0')
    eqAprox(await unButtonToken.balanceOf(deployerAddress), '0')

    await mockAmpl.mint(deployerAddress, '2000')
    await mockAmpl.connect(deployer).approve(unButtonToken.address, '2000')
    await unButtonToken.connect(deployer).deposit('2000')

    await mockAmpl.mint(userAAddress, '1000')
    await mockAmpl.connect(userA).approve(unButtonToken.address, '1000')
    await unButtonToken.connect(userA).deposit('1000')

    eqAprox(await unButtonToken.totalSupply(), '3000000000')
    eqAprox(await unButtonToken.balanceOf(deployerAddress), '1000000000')
    eqAprox(await unButtonToken.balanceOf(userAAddress), '1000000000')
    eqAprox(await unButtonToken.totalDeposits(), '3000')
    eqAprox(await unButtonToken.balanceOfUnderlying(deployerAddress), '1000')
    eqAprox(await unButtonToken.balanceOfUnderlying(userAAddress), '1000')
  })
})

describe('UnbuttonToken:Contraction', () => {
  beforeEach('setup UnbuttonToken contract', setupContracts)

  it('should see deposited erc20 balance shrink', async function() {
    eqAprox(await unButtonToken.totalSupply(), '0')
    eqAprox(await unButtonToken.balanceOf(deployerAddress), '0')

    await mockAmpl.mint(deployerAddress, '2000')
    await mockAmpl.connect(deployer).approve(unButtonToken.address, '2000')
    await unButtonToken.connect(deployer).deposit('2000')
    eqAprox(await unButtonToken.totalSupply(), '2000000000')
    eqAprox(await unButtonToken.balanceOf(deployerAddress), '1000000000')
    eqAprox(await unButtonToken.totalDeposits(), '2000')
    eqAprox(await unButtonToken.balanceOfUnderlying(deployerAddress), '1000')

    await mockAmpl.rebase(startingMultiplier / 2)
    eqAprox(await unButtonToken.totalSupply(), '2000000000')
    eqAprox(await unButtonToken.balanceOf(deployerAddress), '1000000000')
    eqAprox(await unButtonToken.totalDeposits(), '1000')
    eqAprox(await unButtonToken.balanceOfUnderlying(deployerAddress), '500')
  })
})

describe('UnbuttonToken:Expansion', () => {
  beforeEach('setup UnbuttonToken contract', setupContracts)

  it('should see deposited erc20 balance grow', async function () {
    eqAprox(await unButtonToken.totalSupply(), '0')
    eqAprox(await unButtonToken.balanceOf(deployerAddress), '0')

    await mockAmpl.mint(deployerAddress, '2000')
    await mockAmpl.connect(deployer).approve(unButtonToken.address, '2000')
    await unButtonToken.connect(deployer).deposit('2000')
    eqAprox(await unButtonToken.totalSupply(), '2000000000')
    eqAprox(await unButtonToken.balanceOf(deployerAddress), '1000000000')
    eqAprox(await unButtonToken.totalDeposits(), '2000')
    eqAprox(await unButtonToken.balanceOfUnderlying(deployerAddress), '1000')

    await mockAmpl.rebase(startingMultiplier*3)
    eqAprox(await unButtonToken.totalSupply(), '2000000000')
    eqAprox(await unButtonToken.balanceOf(deployerAddress), '1000000000')
    eqAprox(await unButtonToken.totalDeposits(), '6000')
    eqAprox(await unButtonToken.balanceOfUnderlying(deployerAddress), '3000')
  })
})
