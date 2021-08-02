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
  unbuttonToken: Contract

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
  unbuttonToken = await unbuttonTokenFactory.connect(deployer).deploy()
  unbuttonToken['init(address,string,string)'](mockAmpl.address, NAME, SYMBOL)
}

describe('UnbuttonToken', () => {
  before('setup UnbuttonToken contract', setupContracts)

  it('should reject any ether sent to it', async function () {
    const user = accounts[1]
    await expect(user.sendTransaction({ to: unbuttonToken.address, value: 1 }))
      .to.be.reverted
  })
})

describe('UnbuttonToken:Initialization', () => {
  beforeEach('setup UnbuttonToken contract', setupContracts)

  it('should set the underlying reference', async function () {
    expect(await unbuttonToken.underlying()).to.eq(mockAmpl.address)
  })

  it('should set detailed erc20 info parameters', async function () {
    expect(await unbuttonToken.name()).to.eq(NAME)
    expect(await unbuttonToken.symbol()).to.eq(SYMBOL)
    expect(await unbuttonToken.decimals()).to.eq(18)
  })

  it('should set the erc20 balance and supply', async function () {
    expect(await unbuttonToken.totalSupply()).to.eq('0')
    expect(await unbuttonToken.balanceOf(deployerAddress)).to.eq('0')
  })

  it('should set the underlying balance and supply', async function () {
    expect(await unbuttonToken.totalUnderlying()).to.eq('0')
    expect(await unbuttonToken.balanceOfUnderlying(deployerAddress)).to.eq('0')
  })
})

describe('UnbuttonToken Invalid Deposit', () => {
  beforeEach('setup UnbuttonToken contract', setupContracts)

  it('should fail to deposit negative amount', async function () {
    await mockAmpl.mint(deployerAddress, '1000')
    await mockAmpl.connect(deployer).approve(unbuttonToken.address, '1000')
    await expect(unbuttonToken.connect(deployer).deposit('-1')).to.be.reverted
  })

  it('should fail to deposit below exactly min-deposit amount on first time', async function () {
    await mockAmpl.mint(deployerAddress, '1000')
    await mockAmpl.connect(deployer).approve(unbuttonToken.address, '1000')
    await expect(unbuttonToken.connect(deployer).deposit('1000')).to.be.reverted
  })

  it('should fail to deposit below minimum deposit amount', async function () {
    await mockAmpl.mint(deployerAddress, '1000')
    await mockAmpl.connect(deployer).approve(unbuttonToken.address, '1000')
    await expect(unbuttonToken.connect(deployer).deposit('999')).to.be.reverted
  })

  it('should fail to deposit more than balance', async function () {
    await mockAmpl.mint(deployerAddress, '500')
    await mockAmpl.connect(deployer).approve(unbuttonToken.address, '1000')
    await expect(unbuttonToken.connect(deployer).deposit('1000')).to.be.reverted
  })

  it('should fail to deposit more than allowed', async function () {
    await mockAmpl.mint(deployerAddress, '1000')
    await mockAmpl.connect(deployer).approve(unbuttonToken.address, '500')
    await expect(unbuttonToken.connect(deployer).deposit('1000')).to.be.reverted
  })

  it('should fail to deposit more than max_amount', async function () {
    const maxUAmount = (await unbuttonToken.MAX_UNDERLYING()).sub(1)
    await mockAmpl.mint(deployerAddress, maxUAmount)
    await mockAmpl.connect(deployer).approve(unbuttonToken.address, maxUAmount)

    await unbuttonToken.connect(deployer).deposit(maxUAmount)
    expect(await unbuttonToken.totalUnderlying()).eq(maxUAmount)
    await expect(
      unbuttonToken.connect(deployer).deposit('1'),
    ).to.be.revertedWith('UnbuttonToken: too many unbutton tokens to mint')
  })
})

describe('UnbuttonToken: Initial Deposit', () => {
  beforeEach('setup UnbuttonToken contract', setupContracts)

  describe('when the user deposits the smallest allowed deposit', async function () {
    let r: any
    beforeEach(async function () {
      await mockAmpl.mint(deployerAddress, '1001')
      await mockAmpl.connect(deployer).approve(unbuttonToken.address, '1001')
      r = unbuttonToken.connect(deployer).deposit('1001')
      await r
    })

    it('should mint the first tokens to itself and rest to the user', async function () {
      expect(await unbuttonToken.totalSupply()).to.eq('1001000000')
      expect(await unbuttonToken.balanceOf(unbuttonToken.address)).to.eq(
        '1000000000',
      )
      expect(await unbuttonToken.balanceOf(deployerAddress)).to.eq('1000000')

      expect(await unbuttonToken.totalUnderlying()).to.eq('1001')
      expect(
        await unbuttonToken.balanceOfUnderlying(unbuttonToken.address),
      ).to.eq('1000')
      expect(await unbuttonToken.balanceOfUnderlying(deployerAddress)).to.eq(
        '1',
      )
    })

    it('should log transfer', async function () {
      await expect(r)
        .to.emit(mockAmpl, 'Transfer')
        .withArgs(deployerAddress, unbuttonToken.address, '1000')

      await expect(r)
        .to.emit(mockAmpl, 'Transfer')
        .withArgs(deployerAddress, unbuttonToken.address, '1')
    })

    it('should log mint', async function () {
      await expect(r)
        .to.emit(unbuttonToken, 'Transfer')
        .withArgs(
          ethers.constants.AddressZero,
          unbuttonToken.address,
          '1000000000',
        )

      await expect(r)
        .to.emit(unbuttonToken, 'Transfer')
        .withArgs(ethers.constants.AddressZero, deployerAddress, '1000000')
    })
  })

  describe('when the 2nd user deposits min-deposit', async function () {
    it('should see 2nd user able to deposit exactly min-deposit', async function () {
      await mockAmpl.mint(deployerAddress, '2000')
      await mockAmpl.connect(deployer).approve(unbuttonToken.address, '2000')
      await unbuttonToken.connect(deployer).deposit('2000')

      await mockAmpl.mint(userAAddress, '1000')
      await mockAmpl.connect(userA).approve(unbuttonToken.address, '1000')
      await unbuttonToken.connect(userA).deposit('1000')

      expect(await unbuttonToken.totalSupply()).eq('3000000000')
      expect(await unbuttonToken.balanceOf(deployerAddress)).eq('1000000000')
      expect(await unbuttonToken.balanceOf(userAAddress)).eq('1000000000')
      expect(await unbuttonToken.totalUnderlying()).eq('3000')
      expect(await unbuttonToken.balanceOfUnderlying(deployerAddress)).eq(
        '1000',
      )
      expect(await unbuttonToken.balanceOfUnderlying(userAAddress)).eq('1000')
    })
  })

  describe('when the user deposits a reasonable amount', async function () {
    let r: any
    beforeEach(async function () {
      await mockAmpl.mint(deployerAddress, '1000000000000') // 1000 AMPL
      await mockAmpl
        .connect(deployer)
        .approve(unbuttonToken.address, '1000000000000')
      r = unbuttonToken.connect(deployer).deposit('1000000000000')
      await r
    })

    it('should mint the first tokens to itself and rest to the user', async function () {
      expect(await unbuttonToken.totalSupply()).to.eq('1000000000000000000')
      expect(await unbuttonToken.balanceOf(unbuttonToken.address)).to.eq(
        '1000000000',
      )
      expect(await unbuttonToken.balanceOf(deployerAddress)).to.eq(
        '999999999000000000',
      )

      expect(await unbuttonToken.totalUnderlying()).to.eq('1000000000000')
      expect(
        await unbuttonToken.balanceOfUnderlying(unbuttonToken.address),
      ).to.eq('1000')
      expect(await unbuttonToken.balanceOfUnderlying(deployerAddress)).to.eq(
        '999999999000',
      )
    })

    it('should log transfer', async function () {
      await expect(r)
        .to.emit(mockAmpl, 'Transfer')
        .withArgs(deployerAddress, unbuttonToken.address, '1000')

      await expect(r)
        .to.emit(mockAmpl, 'Transfer')
        .withArgs(deployerAddress, unbuttonToken.address, '999999999000')
    })

    it('should log mint', async function () {
      await expect(r)
        .to.emit(unbuttonToken, 'Transfer')
        .withArgs(
          ethers.constants.AddressZero,
          unbuttonToken.address,
          '1000000000',
        )

      await expect(r)
        .to.emit(unbuttonToken, 'Transfer')
        .withArgs(
          ethers.constants.AddressZero,
          deployerAddress,
          '999999999000000000',
        )
    })
  })
})

describe('UnbuttonToken Withdrawal', () => {
  beforeEach('setup UnbuttonToken contract', setupContracts)

  it('should fail to withdraw 0 tokens', async function () {
    await expect(unbuttonToken.connect(userA).withdraw('0')).to.be.reverted
  })

  it('should fail to withdraw more than deposited', async function () {
    await mockAmpl.mint(deployerAddress, '3000')
    await mockAmpl.connect(deployer).approve(unbuttonToken.address, '3000')
    await unbuttonToken.connect(deployer).deposit('3000')

    await expect(unbuttonToken.connect(userA).withdraw('3001')).to.be.reverted
  })

  describe('correct amount', () => {
    let r: any
    beforeEach(async function () {
      await mockAmpl.mint(deployerAddress, '3000')
      await mockAmpl.connect(deployer).approve(unbuttonToken.address, '3000')
      await unbuttonToken.connect(deployer).deposit('3000')
      r = unbuttonToken.connect(deployer).withdraw('500')
      await r
    })
    it('should withdraw correct amount of corresponding collateral', async function () {
      expect(await unbuttonToken.totalSupply()).to.eq('2500000000')
      expect(await unbuttonToken.balanceOf(deployerAddress)).to.eq('1500000000')
      expect(await unbuttonToken.totalUnderlying()).to.eq('2500')
      expect(await unbuttonToken.balanceOfUnderlying(deployerAddress)).to.eq(
        '1500',
      )
      expect(await mockAmpl.balanceOf(deployerAddress)).to.eq('500')
    })
    it('should log transfer', async function () {
      await expect(r)
        .to.emit(mockAmpl, 'Transfer')
        .withArgs(unbuttonToken.address, deployerAddress, '500')
    })
    it('should log mint', async function () {
      await expect(r)
        .to.emit(unbuttonToken, 'Transfer')
        .withArgs(deployerAddress, ethers.constants.AddressZero, '500000000')
    })
  })
})

describe('UnbuttonToken WithdrawalAll', () => {
  let r: any
  beforeEach('setup UnbuttonToken contract', async function () {
    await setupContracts()

    await mockAmpl.mint(deployerAddress, '3000')
    await mockAmpl.connect(deployer).approve(unbuttonToken.address, '3000')
    await unbuttonToken.connect(deployer).deposit('3000')
    r = unbuttonToken.connect(deployer).withdrawAll()
    await r
  })

  it('should fail to withdraw if balance is 0', async function () {
    expect(await unbuttonToken.balanceOf(userBAddress)).to.eq('0')
    await expect(unbuttonToken.connect(userB).withdrawAll()).to.be.reverted
  })

  it('should withdraw correct amount of corresponding collateral', async function () {
    expect(await unbuttonToken.totalSupply()).to.eq('1000000000')
    expect(await unbuttonToken.balanceOf(deployerAddress)).to.eq('0')
    expect(await unbuttonToken.totalUnderlying()).to.eq('1000')
    expect(await unbuttonToken.balanceOfUnderlying(deployerAddress)).to.eq('0')
    expect(await mockAmpl.balanceOf(deployerAddress)).to.eq('2000')
  })
  it('should log transfer', async function () {
    await expect(r)
      .to.emit(mockAmpl, 'Transfer')
      .withArgs(unbuttonToken.address, deployerAddress, '2000')
  })
  it('should log mint', async function () {
    await expect(r)
      .to.emit(unbuttonToken, 'Transfer')
      .withArgs(deployerAddress, ethers.constants.AddressZero, '2000000000')
  })
})

describe('UnbuttonToken:Contraction', () => {
  beforeEach('setup UnbuttonToken contract', setupContracts)

  it('should see deposited erc20 balance shrink', async function () {
    await mockAmpl.mint(deployerAddress, '2000')
    await mockAmpl.connect(deployer).approve(unbuttonToken.address, '2000')
    await unbuttonToken.connect(deployer).deposit('2000')
    expect(await unbuttonToken.totalSupply()).to.eq('2000000000')
    expect(await unbuttonToken.balanceOf(deployerAddress)).to.eq('1000000000')
    expect(await unbuttonToken.totalUnderlying()).to.eq('2000')
    expect(await unbuttonToken.balanceOfUnderlying(deployerAddress)).to.eq(
      '1000',
    )

    await mockAmpl.rebase(startingMultiplier / 2)
    expect(await unbuttonToken.totalSupply()).to.eq('2000000000')
    expect(await unbuttonToken.balanceOf(deployerAddress)).to.eq('1000000000')
    expect(await unbuttonToken.totalUnderlying()).to.eq('1000')
    expect(await unbuttonToken.balanceOfUnderlying(deployerAddress)).to.eq(
      '500',
    )
  })
})

describe('UnbuttonToken:Expansion', () => {
  beforeEach('setup UnbuttonToken contract', setupContracts)

  it('should see deposited erc20 balance grow', async function () {
    await mockAmpl.mint(deployerAddress, '2000')
    await mockAmpl.connect(deployer).approve(unbuttonToken.address, '2000')
    await unbuttonToken.connect(deployer).deposit('2000')
    expect(await unbuttonToken.totalSupply()).to.eq('2000000000')
    expect(await unbuttonToken.balanceOf(deployerAddress)).to.eq('1000000000')
    expect(await unbuttonToken.totalUnderlying()).to.eq('2000')
    expect(await unbuttonToken.balanceOfUnderlying(deployerAddress)).to.eq(
      '1000',
    )

    await mockAmpl.rebase(startingMultiplier * 3)
    expect(await unbuttonToken.totalSupply()).to.eq('2000000000')
    expect(await unbuttonToken.balanceOf(deployerAddress)).to.eq('1000000000')
    expect(await unbuttonToken.totalUnderlying()).to.eq('6000')
    expect(await unbuttonToken.balanceOfUnderlying(deployerAddress)).to.eq(
      '3000',
    )
  })
})
