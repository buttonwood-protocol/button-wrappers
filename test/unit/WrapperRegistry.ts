import { ethers } from 'hardhat'
import { Contract, Signer } from 'ethers'
import { Fixture, loadFixture } from 'ethereum-waffle'
import { expect } from 'chai'

interface TestContext {
  accounts: Signer[]
  deployer: Signer
  userA: Signer
  wrapperRegistry: Contract
  mockBTC: Contract
  mockAmpl: Contract
  buttonToken: Contract
  buttonToken2: Contract
  unbuttonToken: Contract
}

describe('WrapperRegistry', () => {
  const setupTestContext = async (): Promise<TestContext> => {
    const accounts: Signer[] = await ethers.getSigners()
    const [deployer, userA] = accounts

    const wrapperRegistryFactory = await ethers.getContractFactory(
      'WrapperRegistry',
    )
    const wrapperRegistry = await wrapperRegistryFactory
      .connect(deployer)
      .deploy()

    const erc20Factory = await ethers.getContractFactory('MockERC20')
    const mockBTC = await erc20Factory
      .connect(deployer)
      .deploy('Wood Bitcoin', 'WOOD-BTC')
    const oracleFactory = await ethers.getContractFactory('MockOracle')
    const mockOracle = await oracleFactory.connect(deployer).deploy()
    await mockOracle.setData('1000000000000', true)
    const buttonTokenFactory = await ethers.getContractFactory('ButtonToken')
    const buttonToken = await buttonTokenFactory.connect(deployer).deploy()
    buttonToken.initialize(
      mockBTC.address,
      'Button Bitcoin',
      'BTN-BTC',
      mockOracle.address,
    )
    const buttonToken2 = await buttonTokenFactory.connect(deployer).deploy()
    buttonToken2.initialize(
      mockBTC.address,
      'Button Bitcoin2',
      'BTN-BTC2',
      mockOracle.address,
    )

    const rebasingErc20Factory = await ethers.getContractFactory(
      'MockRebasingERC20',
    )
    const mockAmpl = await rebasingErc20Factory.deploy(
      'Ampleforth',
      'AMPL',
      10000,
      10000,
    )

    const unbuttonTokenFactory = await ethers.getContractFactory(
      'UnbuttonToken',
    )
    const unbuttonToken = await unbuttonTokenFactory.deploy()

    const initialDeposit = await unbuttonToken.INITIAL_DEPOSIT()
    const initialRate = '1000000'
    await mockAmpl.mint(await deployer.getAddress(), initialDeposit)
    await mockAmpl.approve(unbuttonToken.address, initialDeposit)
    await unbuttonToken.initialize(
      mockAmpl.address,
      'Unbutton Ampleforth',
      'UBTN-AMPL',
      initialRate,
    )

    return {
      accounts,
      deployer,
      userA,
      wrapperRegistry,
      mockBTC,
      mockAmpl,
      buttonToken,
      buttonToken2,
      unbuttonToken,
    }
  }

  const getFixture = (): Fixture<TestContext> => {
    return async () => await setupTestContext()
  }

  describe('Initialization', function () {
    it('Can successfully deploy BondConfigVault with proper arguments', async () => {
      const { wrapperRegistry } = await loadFixture(getFixture())
      expect(await wrapperRegistry.numWrappers()).to.eq(0)
      await expect(wrapperRegistry.wrapperAt(0)).to.be.reverted
    })
  })

  describe('Ownership', function () {
    it('Can transfer ownership', async () => {
      const { wrapperRegistry, deployer, userA } = await loadFixture(
        getFixture(),
      )
      const deployerAddress = await deployer.getAddress()
      const userAAddress = await userA.getAddress()

      expect(await wrapperRegistry.owner()).to.eq(deployerAddress)
      await wrapperRegistry.transferOwnership(userAAddress)
      expect(await wrapperRegistry.owner()).to.eq(userAAddress)
    })

    it('Only owner can call addWrapper', async () => {
      const { wrapperRegistry, userA, buttonToken } = await loadFixture(
        getFixture(),
      )

      await expect(
        wrapperRegistry.connect(userA).addWrapper(buttonToken.address),
      ).to.be.reverted
    })

    it('Only owner can call removeWrapper', async () => {
      const {
        wrapperRegistry,
        userA,
        mockBTC,
        buttonToken,
      } = await loadFixture(getFixture())

      // Adding wrapper to attempt removing
      await expect(wrapperRegistry.addWrapper(buttonToken.address))
        .to.emit(wrapperRegistry, 'WrapperAdded')
        .withArgs(mockBTC.address, buttonToken.address)

      await expect(
        wrapperRegistry.connect(userA).removeWrapper(buttonToken.address),
      ).to.be.reverted
    })

    it('Only owner can call removeUnderlying', async () => {
      const {
        wrapperRegistry,
        userA,
        mockBTC,
        buttonToken,
      } = await loadFixture(getFixture())

      // Adding wrapper to attempt removing
      await expect(wrapperRegistry.addWrapper(buttonToken.address))
        .to.emit(wrapperRegistry, 'WrapperAdded')
        .withArgs(mockBTC.address, buttonToken.address)

      await expect(
        wrapperRegistry.connect(userA).removeUnderlying(mockBTC.address),
      ).to.be.reverted
    })

    it('Non-owner can call numWrappers', async () => {
      const {
        wrapperRegistry,
        userA,
        mockBTC,
        buttonToken,
      } = await loadFixture(getFixture())

      // Adding wrapper to populate registry
      await expect(wrapperRegistry.addWrapper(buttonToken.address))
        .to.emit(wrapperRegistry, 'WrapperAdded')
        .withArgs(mockBTC.address, buttonToken.address)

      expect(await wrapperRegistry.connect(userA).numWrappers()).to.eq(1)
    })

    it('Non-owner can call wrapperAt', async () => {
      const {
        wrapperRegistry,
        userA,
        mockBTC,
        buttonToken,
      } = await loadFixture(getFixture())

      // Adding wrapper to populate registry
      await expect(wrapperRegistry.addWrapper(buttonToken.address))
        .to.emit(wrapperRegistry, 'WrapperAdded')
        .withArgs(mockBTC.address, buttonToken.address)

      const { 0: underlying, 1: wrapper } = await wrapperRegistry
        .connect(userA)
        .wrapperAt(0)
      expect(underlying).to.eq(mockBTC.address)
      expect(wrapper).to.eq(buttonToken.address)
    })

    it('Non-owner can call getWrapperFromUnderlying', async () => {
      const {
        wrapperRegistry,
        userA,
        mockBTC,
        buttonToken,
      } = await loadFixture(getFixture())

      // Adding wrapper to populate registry
      await expect(wrapperRegistry.addWrapper(buttonToken.address))
        .to.emit(wrapperRegistry, 'WrapperAdded')
        .withArgs(mockBTC.address, buttonToken.address)

      const wrapper = await wrapperRegistry
        .connect(userA)
        .getWrapperFromUnderlying(mockBTC.address)
      expect(wrapper).to.eq(buttonToken.address)
    })

    it('Non-owner can call getUnderlyingFromWrapper', async () => {
      const {
        wrapperRegistry,
        userA,
        mockBTC,
        buttonToken,
      } = await loadFixture(getFixture())

      // Adding wrapper to populate registry
      await expect(wrapperRegistry.addWrapper(buttonToken.address))
        .to.emit(wrapperRegistry, 'WrapperAdded')
        .withArgs(mockBTC.address, buttonToken.address)

      const wrapper = await wrapperRegistry
        .connect(userA)
        .getUnderlyingFromWrapper(buttonToken.address)
      expect(wrapper).to.eq(mockBTC.address)
    })
  })

  describe('Simple Updating Wrappers', function () {
    it('Can successfully add a wrapper', async () => {
      const { wrapperRegistry, mockBTC, buttonToken } = await loadFixture(
        getFixture(),
      )

      await expect(wrapperRegistry.addWrapper(buttonToken.address))
        .to.emit(wrapperRegistry, 'WrapperAdded')
        .withArgs(mockBTC.address, buttonToken.address)

      expect(await wrapperRegistry.numWrappers()).to.eq(1)
      const { 0: underlying, 1: wrapper } = await wrapperRegistry.wrapperAt(0)
      expect(underlying).to.eq(mockBTC.address)
      expect(wrapper).to.eq(buttonToken.address)
    })

    it('Can successfully remove a wrapper via underlyingToken address', async () => {
      const { wrapperRegistry, mockAmpl, unbuttonToken } = await loadFixture(
        getFixture(),
      )

      // Adding a config first (so that we can test removing it)
      await expect(wrapperRegistry.addWrapper(unbuttonToken.address))
        .to.emit(wrapperRegistry, 'WrapperAdded')
        .withArgs(mockAmpl.address, unbuttonToken.address)
      expect(await wrapperRegistry.numWrappers()).to.eq(1)

      await expect(wrapperRegistry.removeUnderlying(mockAmpl.address))
        .to.emit(wrapperRegistry, 'WrapperRemoved')
        .withArgs(mockAmpl.address, unbuttonToken.address)

      expect(await wrapperRegistry.numWrappers()).to.eq(0)
    })

    it('Can successfully remove a wrapper via wrapperToken address', async () => {
      const { wrapperRegistry, mockAmpl, unbuttonToken } = await loadFixture(
        getFixture(),
      )

      // Adding a config first (so that we can test removing it)
      await expect(wrapperRegistry.addWrapper(unbuttonToken.address))
        .to.emit(wrapperRegistry, 'WrapperAdded')
        .withArgs(mockAmpl.address, unbuttonToken.address)
      expect(await wrapperRegistry.numWrappers()).to.eq(1)

      await expect(wrapperRegistry.removeWrapper(unbuttonToken.address))
        .to.emit(wrapperRegistry, 'WrapperRemoved')
        .withArgs(mockAmpl.address, unbuttonToken.address)

      expect(await wrapperRegistry.numWrappers()).to.eq(0)
    })

    it('addWrapper() has correct return values', async () => {
      const {
        wrapperRegistry,
        mockBTC,
        buttonToken,
        buttonToken2,
      } = await loadFixture(getFixture())

      expect(await wrapperRegistry.callStatic.addWrapper(buttonToken.address))
        .to.be.true

      await expect(wrapperRegistry.addWrapper(buttonToken.address))
        .to.emit(wrapperRegistry, 'WrapperAdded')
        .withArgs(mockBTC.address, buttonToken.address)

      expect(await wrapperRegistry.callStatic.addWrapper(buttonToken2.address))
        .to.be.false
    })

    it('removeWrapper() has correct return values', async () => {
      const {
        wrapperRegistry,
        mockBTC,
        buttonToken,
        buttonToken2,
      } = await loadFixture(getFixture())

      // Adding a config first (so that we can test removing it)
      await expect(wrapperRegistry.addWrapper(buttonToken.address))
        .to.emit(wrapperRegistry, 'WrapperAdded')
        .withArgs(mockBTC.address, buttonToken.address)

      expect(
        await wrapperRegistry.callStatic.removeWrapper(buttonToken.address),
      ).to.be.true

      await expect(wrapperRegistry.removeWrapper(buttonToken.address))
        .to.emit(wrapperRegistry, 'WrapperRemoved')
        .withArgs(mockBTC.address, buttonToken.address)

      expect(
        await wrapperRegistry.callStatic.removeWrapper(buttonToken2.address),
      ).to.be.false
    })

    it('removeUnderlying() has correct return values', async () => {
      const {
        wrapperRegistry,
        mockBTC,
        mockAmpl,
        unbuttonToken,
      } = await loadFixture(getFixture())

      // Adding a config first (so that we can test removing it)
      await expect(wrapperRegistry.addWrapper(unbuttonToken.address))
        .to.emit(wrapperRegistry, 'WrapperAdded')
        .withArgs(mockAmpl.address, unbuttonToken.address)

      expect(
        await wrapperRegistry.callStatic.removeUnderlying(mockAmpl.address),
      ).to.be.true

      await expect(wrapperRegistry.removeUnderlying(mockAmpl.address))
        .to.emit(wrapperRegistry, 'WrapperRemoved')
        .withArgs(mockAmpl.address, unbuttonToken.address)

      expect(await wrapperRegistry.callStatic.removeUnderlying(mockBTC.address))
        .to.be.false
    })
  })

  describe('Updating Wrapper Edge Cases', function () {
    it("Adding the same underlying multiple times doesn't change number of configs", async () => {
      const {
        wrapperRegistry,
        mockBTC,
        buttonToken,
        buttonToken2,
      } = await loadFixture(getFixture())

      // Emits the first time
      await expect(wrapperRegistry.addWrapper(buttonToken.address))
        .to.emit(wrapperRegistry, 'WrapperAdded')
        .withArgs(mockBTC.address, buttonToken.address)
      expect(await wrapperRegistry.numWrappers()).to.eq(1)

      // Doesn't emit subsequent times.
      for (let i = 0; i < 5; i++) {
        await expect(
          wrapperRegistry.addWrapper(buttonToken.address),
        ).to.not.emit(wrapperRegistry, 'WrapperAdded')
        await expect(
          wrapperRegistry.addWrapper(buttonToken2.address),
        ).to.not.emit(wrapperRegistry, 'WrapperAdded')
      }

      // Confirming only original wrapper is in registry
      expect(await wrapperRegistry.numWrappers()).to.eq(1)
      const { 0: underlying, 1: wrapper } = await wrapperRegistry.wrapperAt(0)
      expect(underlying).to.eq(mockBTC.address)
      expect(wrapper).to.eq(buttonToken.address)
    })

    it('Removing non-existent wrapper throws error', async () => {
      const {
        wrapperRegistry,
        mockBTC,
        buttonToken,
        unbuttonToken,
      } = await loadFixture(getFixture())

      await expect(wrapperRegistry.addWrapper(buttonToken.address))
        .to.emit(wrapperRegistry, 'WrapperAdded')
        .withArgs(mockBTC.address, buttonToken.address)
      expect(await wrapperRegistry.numWrappers()).to.eq(1)

      // Removing non-existent bondConfig to test numConfigs not changing. Shouldn't emit
      await expect(
        wrapperRegistry.removeWrapper(unbuttonToken.address),
      ).to.not.emit(wrapperRegistry, 'WrapperRemoved')

      // Testing still only 1 config present
      expect(await wrapperRegistry.numWrappers()).to.eq(1)

      // Validating the 1 config present is the first one, not the latter
      const { 0: underlying, 1: wrapper } = await wrapperRegistry.wrapperAt(0)
      expect(underlying).to.eq(mockBTC.address)
      expect(wrapper).to.eq(buttonToken.address)
    })

    it('Removing non-existent underlying throws error', async () => {
      const {
        wrapperRegistry,
        mockBTC,
        mockAmpl,
        buttonToken,
      } = await loadFixture(getFixture())

      await expect(wrapperRegistry.addWrapper(buttonToken.address))
        .to.emit(wrapperRegistry, 'WrapperAdded')
        .withArgs(mockBTC.address, buttonToken.address)
      expect(await wrapperRegistry.numWrappers()).to.eq(1)

      // Removing non-existent bondConfig to test numConfigs not changing. Shouldn't emit
      await expect(
        wrapperRegistry.removeUnderlying(mockAmpl.address),
      ).to.not.emit(wrapperRegistry, 'WrapperRemoved')

      // Testing still only 1 config present
      expect(await wrapperRegistry.numWrappers()).to.eq(1)

      // Validating the 1 config present is the first one, not the latter
      const { 0: underlying, 1: wrapper } = await wrapperRegistry.wrapperAt(0)
      expect(underlying).to.eq(mockBTC.address)
      expect(wrapper).to.eq(buttonToken.address)
    })
  })

  describe('Querying', function () {
    it('Can successfully query wrapper from underlying', async () => {
      const {
        wrapperRegistry,
        mockBTC,
        mockAmpl,
        buttonToken,
        unbuttonToken,
      } = await loadFixture(getFixture())

      await expect(wrapperRegistry.addWrapper(buttonToken.address))
        .to.emit(wrapperRegistry, 'WrapperAdded')
        .withArgs(mockBTC.address, buttonToken.address)
      await expect(wrapperRegistry.addWrapper(unbuttonToken.address))
        .to.emit(wrapperRegistry, 'WrapperAdded')
        .withArgs(mockAmpl.address, unbuttonToken.address)

      expect(
        await wrapperRegistry.getWrapperFromUnderlying(mockBTC.address),
      ).to.eq(buttonToken.address)
      expect(
        await wrapperRegistry.getWrapperFromUnderlying(mockAmpl.address),
      ).to.eq(unbuttonToken.address)
    })

    it('Querying missing underlying returns 0-address', async () => {
      const {
        wrapperRegistry,
        mockBTC,
        mockAmpl,
        unbuttonToken,
      } = await loadFixture(getFixture())

      await expect(wrapperRegistry.addWrapper(unbuttonToken.address))
        .to.emit(wrapperRegistry, 'WrapperAdded')
        .withArgs(mockAmpl.address, unbuttonToken.address)

      expect(
        await wrapperRegistry.getWrapperFromUnderlying(mockBTC.address),
      ).to.eq(ethers.constants.AddressZero)
    })

    it('Can successfully query underlying from wrapper', async () => {
      const {
        wrapperRegistry,
        mockBTC,
        mockAmpl,
        buttonToken,
        unbuttonToken,
      } = await loadFixture(getFixture())

      await expect(wrapperRegistry.addWrapper(buttonToken.address))
        .to.emit(wrapperRegistry, 'WrapperAdded')
        .withArgs(mockBTC.address, buttonToken.address)
      await expect(wrapperRegistry.addWrapper(unbuttonToken.address))
        .to.emit(wrapperRegistry, 'WrapperAdded')
        .withArgs(mockAmpl.address, unbuttonToken.address)

      expect(
        await wrapperRegistry.getUnderlyingFromWrapper(buttonToken.address),
      ).to.eq(mockBTC.address)
      expect(
        await wrapperRegistry.getUnderlyingFromWrapper(unbuttonToken.address),
      ).to.eq(mockAmpl.address)
    })

    it('Querying missing wrapper returns 0-address', async () => {
      const {
        wrapperRegistry,
        mockBTC,
        buttonToken,
        buttonToken2,
      } = await loadFixture(getFixture())

      await expect(wrapperRegistry.addWrapper(buttonToken.address))
        .to.emit(wrapperRegistry, 'WrapperAdded')
        .withArgs(mockBTC.address, buttonToken.address)

      expect(
        await wrapperRegistry.getUnderlyingFromWrapper(buttonToken2.address),
      ).to.eq(ethers.constants.AddressZero)
    })
  })
})
