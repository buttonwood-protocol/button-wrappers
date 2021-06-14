import { ethers, upgrades } from 'hardhat'
import { Contract, Signer, BigNumber } from 'ethers'
import { expect } from 'chai'

const PRICE_DECIMALS = 8
const DECIMALS = 18
const NAME = 'Button Bitcoin'
const SYMBOL = 'BTN-BTC'

const toOracleValue = (v: string): BigNumber =>
  ethers.utils.parseUnits(v, PRICE_DECIMALS)

const toFixedPtAmt = (a: string): BigNumber =>
  ethers.utils.parseUnits(a, DECIMALS)

let accounts: Signer[],
  deployer: Signer,
  deployerAddress: string,
  userA: Signer,
  userAAddress: string,
  mockBTC: Contract,
  mockOracle: Contract,
  buttonToken: Contract,
  cAmount: BigNumber,
  depositedCAmount: BigNumber,
  mintAmt: BigNumber,
  burnAmt: BigNumber

async function setupContracts() {
  accounts = await ethers.getSigners()
  deployer = accounts[0]
  userA = accounts[1]

  deployerAddress = await deployer.getAddress()
  userAAddress = await userA.getAddress()

  const erc20Factory = await ethers.getContractFactory('MockERC20')
  mockBTC = await erc20Factory
    .connect(deployer)
    .deploy('Wood Bitcoin', 'WOOD-BTC')

  const oracleFactory = await ethers.getContractFactory('MockOracle')
  mockOracle = await oracleFactory.connect(deployer).deploy()
  await mockOracle.setData(toOracleValue('10000'), true)

  const buttonTokenFactory = await ethers.getContractFactory('ButtonToken')
  buttonToken = await buttonTokenFactory
    .connect(deployer)
    .deploy(mockBTC.address, NAME, SYMBOL, mockOracle.address)
}

describe('ButtonToken:mint', async () => {
  describe('without sufficient approval', async function () {
    it('should revert', async function () {
      await setupContracts()

      await mockBTC.connect(deployer).mint(userAAddress, toFixedPtAmt('1'))

      await mockBTC
        .connect(userA)
        .approve(buttonToken.address, toFixedPtAmt('0.99'))

      await expect(
        buttonToken
          .connect(userA)
          .mint(await buttonToken.exchangeRate(toFixedPtAmt('1'))),
      ).to.be.reverted
    })
  })

  describe('without sufficient balance', async function () {
    it('should revert', async function () {
      await setupContracts()

      await mockBTC.connect(deployer).mint(userAAddress, toFixedPtAmt('2'))

      await mockBTC
        .connect(userA)
        .approve(buttonToken.address, toFixedPtAmt('1'))

      await expect(
        buttonToken
          .connect(userA)
          .mint(await buttonToken.exchangeRate(toFixedPtAmt('2'))),
      ).to.be.reverted
    })
  })

  describe('When mint amount is > MAX_COLLATERAL', async function () {
    it('should not be reverted', async function () {
      await setupContracts()

      cAmount = (await buttonToken.MAX_COLLATERAL()).add(1)

      mintAmt = cAmount
        .mul(await buttonToken.currentPrice())
        .div(BigNumber.from(10).pow(PRICE_DECIMALS))

      await mockBTC.connect(deployer).mint(userAAddress, cAmount)

      await mockBTC.connect(userA).approve(buttonToken.address, cAmount)

      await expect(buttonToken.connect(userA).mint(mintAmt)).to.be.reverted
    })
  })

  describe('When mint amount < MAX_COLLATERAL', async function () {
    it('should not be reverted', async function () {
      await setupContracts()

      const MAX_COLLATERAL = await buttonToken.MAX_COLLATERAL()
      const cAmount = MAX_COLLATERAL.sub(1)

      await mockBTC.connect(deployer).mint(userAAddress, cAmount)

      await mockBTC.connect(userA).approve(buttonToken.address, cAmount)

      const mintAmt = await buttonToken.exchangeRate(cAmount)

      await expect(buttonToken.connect(userA).mint(mintAmt)).not.to.be.reverted
    })
  })

  describe('When mint amount zero', async function () {
    it('should be reverted', async function () {
      await setupContracts()

      cAmount = BigNumber.from('1')

      await mockBTC.connect(deployer).mint(userAAddress, cAmount)
      await mockBTC.connect(userA).approve(buttonToken.address, cAmount)

      await expect(buttonToken.connect(userA).mint('0')).to.be.reverted
    })
  })

  describe('When mint amount < unit amount', async function () {
    it('should be reverted', async function () {
      await setupContracts()

      cAmount = BigNumber.from('1')

      await mockBTC.connect(deployer).mint(userAAddress, cAmount)
      await mockBTC.connect(userA).approve(buttonToken.address, cAmount)

      await expect(buttonToken.connect(userA).mint('1')).to.be.reverted
    })
  })

  describe('When mint amount is a small amount', async function () {
    beforeEach('setup ButtonToken contract', async () => {
      await setupContracts()

      cAmount = BigNumber.from('2')
      mintAmt = await buttonToken.exchangeRate(cAmount)

      await mockBTC.connect(deployer).mint(userAAddress, cAmount)
      await mockBTC.connect(userA).approve(buttonToken.address, cAmount)
    })

    it('should transfer collateral from the user', async function () {
      expect(await mockBTC.balanceOf(userAAddress)).to.eq(cAmount)
      expect(await mockBTC.balanceOf(buttonToken.address)).to.eq('0')

      depositedCAmount = await buttonToken
        .connect(userA)
        .callStatic.mint(mintAmt)
      await expect(buttonToken.connect(userA).mint(mintAmt))
        .to.emit(mockBTC, 'Transfer')
        .withArgs(userAAddress, buttonToken.address, depositedCAmount)

      expect(await mockBTC.balanceOf(userAAddress)).to.eq(
        cAmount.sub(depositedCAmount),
      )
      expect(await mockBTC.balanceOf(buttonToken.address)).to.eq(
        depositedCAmount,
      )
    })

    it('should mint button tokens', async function () {
      expect(await buttonToken.balanceOf(userAAddress)).to.eq('0')

      await buttonToken.connect(userA).mint(mintAmt)

      expect(await buttonToken.balanceOf(userAAddress)).to.eq(mintAmt)
    })

    it('should emit transfer log', async function () {
      await expect(buttonToken.connect(userA).mint(mintAmt))
        .to.emit(buttonToken, 'Transfer')
        .withArgs(ethers.constants.AddressZero, userAAddress, mintAmt)
    })
  })

  describe('with sufficient approval', async function () {
    beforeEach('setup ButtonToken contract', async () => {
      await setupContracts()

      cAmount = toFixedPtAmt('1')
      await mockBTC.connect(deployer).mint(userAAddress, cAmount)

      await mockBTC.connect(userA).approve(buttonToken.address, cAmount)

      mintAmt = await buttonToken.exchangeRate(cAmount)
    })

    it('should transfer collateral from the user', async function () {
      expect(await mockBTC.balanceOf(userAAddress)).to.eq(cAmount)
      expect(await mockBTC.balanceOf(buttonToken.address)).to.eq('0')

      depositedCAmount = await buttonToken
        .connect(userA)
        .callStatic.mint(mintAmt)
      await expect(buttonToken.connect(userA).mint(mintAmt))
        .to.emit(mockBTC, 'Transfer')
        .withArgs(userAAddress, buttonToken.address, depositedCAmount)

      expect(await mockBTC.balanceOf(userAAddress)).to.eq(
        cAmount.sub(depositedCAmount),
      )
      expect(await mockBTC.balanceOf(buttonToken.address)).to.eq(
        depositedCAmount,
      )
    })

    it('should mint button tokens', async function () {
      expect(await buttonToken.balanceOf(userAAddress)).to.eq('0')

      await buttonToken.connect(userA).mint(mintAmt)

      expect(await buttonToken.balanceOf(userAAddress)).to.eq(
        toFixedPtAmt('10000'),
      )
    })

    it('should emit transfer log', async function () {
      await expect(buttonToken.connect(userA).mint(mintAmt))
        .to.emit(buttonToken, 'Transfer')
        .withArgs(
          ethers.constants.AddressZero,
          userAAddress,
          toFixedPtAmt('10000'),
        )
    })
  })
})

describe('ButtonToken:burn', async () => {
  describe('When burn amount zero', async function () {
    it('should be reverted', async function () {
      await setupContracts()

      cAmount = toFixedPtAmt('1')
      mintAmt = await buttonToken.exchangeRate(cAmount)
      burnAmt = BigNumber.from('0')

      await mockBTC.connect(deployer).mint(userAAddress, cAmount)
      await mockBTC.connect(userA).approve(buttonToken.address, cAmount)
      await buttonToken.connect(userA).mint(mintAmt)

      await expect(buttonToken.connect(userA).burn(burnAmt)).to.be.reverted
    })
  })

  describe('When burn amount < unit amount', async function () {
    it('should be reverted', async function () {
      await setupContracts()

      cAmount = toFixedPtAmt('1')
      mintAmt = await buttonToken.exchangeRate(cAmount)
      burnAmt = BigNumber.from('1')

      await mockBTC.connect(deployer).mint(userAAddress, cAmount)
      await mockBTC.connect(userA).approve(buttonToken.address, cAmount)
      await buttonToken.connect(userA).mint(mintAmt)

      await expect(buttonToken.connect(userA).burn(burnAmt)).to.be.reverted
    })
  })

  describe('When burn amount small amount', async function () {
    it('should be reverted', async function () {
      await setupContracts()

      cAmount = BigNumber.from('2')
      mintAmt = await buttonToken.exchangeRate(cAmount)
      burnAmt = mintAmt

      await mockBTC.connect(deployer).mint(userAAddress, cAmount)
      await mockBTC.connect(userA).approve(buttonToken.address, cAmount)
      await buttonToken.connect(userA).mint(mintAmt)

      await expect(buttonToken.connect(userA).burn(burnAmt)).not.to.be.reverted
    })
  })

  describe('When burn amount > balance', async function () {
    it('should be reverted', async function () {
      await setupContracts()

      cAmount = toFixedPtAmt('1')
      mintAmt = await buttonToken.exchangeRate(cAmount)
      burnAmt = mintAmt

      await mockBTC.connect(deployer).mint(userAAddress, cAmount)
      await mockBTC.connect(userA).approve(buttonToken.address, cAmount)
      await buttonToken.connect(userA).mint(mintAmt)

      await expect(buttonToken.connect(userA).burn(mintAmt.add(1))).to.be
        .reverted
    })
  })

  describe('When burn amount equal to the balance', async function () {
    beforeEach(async function () {
      await setupContracts()

      cAmount = toFixedPtAmt('1')
      mintAmt = await buttonToken.exchangeRate(cAmount)
      burnAmt = mintAmt

      await mockBTC.connect(deployer).mint(userAAddress, cAmount)
      await mockBTC.connect(userA).approve(buttonToken.address, cAmount)

      depositedCAmount = await buttonToken
        .connect(userA)
        .callStatic.mint(mintAmt)
      await buttonToken.connect(userA).mint(mintAmt)
    })

    it('should transfer collateral to the user', async function () {
      expect(await mockBTC.balanceOf(userAAddress)).to.eq(
        cAmount.sub(depositedCAmount),
      )
      expect(await mockBTC.balanceOf(buttonToken.address)).to.eq(
        depositedCAmount,
      )

      const withdrawCAmount = await buttonToken
        .connect(userA)
        .callStatic.burn(burnAmt)
      await expect(buttonToken.connect(userA).burn(burnAmt))
        .to.emit(mockBTC, 'Transfer')
        .withArgs(buttonToken.address, userAAddress, withdrawCAmount)

      expect(await mockBTC.balanceOf(userAAddress)).to.eq(cAmount)
      expect(await mockBTC.balanceOf(buttonToken.address)).to.eq('0')
    })

    it('should mint button tokens', async function () {
      expect(await buttonToken.balanceOf(userAAddress)).to.eq(
        toFixedPtAmt('10000'),
      )

      await buttonToken.connect(userA).burn(burnAmt)

      expect(await buttonToken.balanceOf(userAAddress)).to.eq('0')
    })

    it('should emit transfer log', async function () {
      await expect(buttonToken.connect(userA).burn(burnAmt))
        .to.emit(buttonToken, 'Transfer')
        .withArgs(
          userAAddress,
          ethers.constants.AddressZero,
          toFixedPtAmt('10000'),
        )
    })
  })

  describe('When burn amount less than the balance', async function () {
    let cBurnAmount: BigNumber

    beforeEach(async function () {
      await setupContracts()

      cAmount = toFixedPtAmt('2')
      cBurnAmount = toFixedPtAmt('1')
      mintAmt = await buttonToken.exchangeRate(cAmount)
      burnAmt = await buttonToken.exchangeRate(cBurnAmount)

      await mockBTC.connect(deployer).mint(userAAddress, cAmount)
      await mockBTC.connect(userA).approve(buttonToken.address, cAmount)

      depositedCAmount = await buttonToken
        .connect(userA)
        .callStatic.mint(mintAmt)
      await buttonToken.connect(userA).mint(mintAmt)
    })

    it('should transfer collateral to the user', async function () {
      expect(await mockBTC.balanceOf(userAAddress)).to.eq(
        cAmount.sub(depositedCAmount),
      )
      expect(await mockBTC.balanceOf(buttonToken.address)).to.eq(
        depositedCAmount,
      )

      const withdrawCAmount = await buttonToken
        .connect(userA)
        .callStatic.burn(burnAmt)
      await expect(buttonToken.connect(userA).burn(burnAmt))
        .to.emit(mockBTC, 'Transfer')
        .withArgs(buttonToken.address, userAAddress, withdrawCAmount)

      expect(await mockBTC.balanceOf(userAAddress)).to.eq(toFixedPtAmt('1'))
      expect(await mockBTC.balanceOf(buttonToken.address)).to.eq(
        toFixedPtAmt('1'),
      )
    })

    it('should mint button tokens', async function () {
      expect(await buttonToken.balanceOf(userAAddress)).to.eq(
        toFixedPtAmt('20000'),
      )

      await buttonToken.connect(userA).burn(burnAmt)

      expect(await buttonToken.balanceOf(userAAddress)).to.eq(
        toFixedPtAmt('10000'),
      )
    })

    it('should emit transfer log', async function () {
      await expect(buttonToken.connect(userA).burn(burnAmt))
        .to.emit(buttonToken, 'Transfer')
        .withArgs(
          userAAddress,
          ethers.constants.AddressZero,
          toFixedPtAmt('10000'),
        )
    })
  })
})

describe('ButtonToken:burnAll', async () => {
  beforeEach(async function () {
    await setupContracts()

    cAmount = toFixedPtAmt('1')
    mintAmt = await buttonToken.exchangeRate(cAmount)
    burnAmt = mintAmt

    await mockBTC.connect(deployer).mint(userAAddress, cAmount)
    await mockBTC.connect(userA).approve(buttonToken.address, cAmount)

    depositedCAmount = await buttonToken.connect(userA).callStatic.mint(mintAmt)
    await buttonToken.connect(userA).mint(mintAmt)
  })

  it('should transfer collateral to the user', async function () {
    expect(await mockBTC.balanceOf(userAAddress)).to.eq(
      cAmount.sub(depositedCAmount),
    )
    expect(await mockBTC.balanceOf(buttonToken.address)).to.eq(depositedCAmount)

    const withdrawCAmount = await buttonToken
      .connect(userA)
      .callStatic.burnAll()
    await expect(buttonToken.connect(userA).burnAll())
      .to.emit(mockBTC, 'Transfer')
      .withArgs(buttonToken.address, userAAddress, withdrawCAmount)

    expect(await mockBTC.balanceOf(userAAddress)).to.eq(cAmount)
    expect(await mockBTC.balanceOf(buttonToken.address)).to.eq('0')
  })

  it('should mint button tokens', async function () {
    expect(await buttonToken.balanceOf(userAAddress)).to.eq(
      toFixedPtAmt('10000'),
    )

    await buttonToken.connect(userA).burnAll()

    expect(await buttonToken.balanceOf(userAAddress)).to.eq('0')
  })

  it('should emit transfer log', async function () {
    await expect(buttonToken.connect(userA).burnAll())
      .to.emit(buttonToken, 'Transfer')
      .withArgs(
        userAAddress,
        ethers.constants.AddressZero,
        toFixedPtAmt('10000'),
      )
  })
})
