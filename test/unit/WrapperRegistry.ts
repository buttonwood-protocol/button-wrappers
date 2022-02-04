import { ethers } from 'hardhat'
import { BigNumber, Contract, Signer } from 'ethers'
import { expect } from 'chai'

interface TestContext {
  accounts: Signer[]
  deployer: Signer
  userA: Signer
  wrapperRegistry: Contract
  underlyingTokenAddressA: string
  underlyingTokenAddressB: string
  wrapperTokenAddressA: string
  wrapperTokenAddressB: string
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

    const underlyingTokenAddressA: string =
      '0x000000000000000000000000000000000000000A'
    const underlyingTokenAddressB: string =
      '0x000000000000000000000000000000000000000b'
    const wrapperTokenAddressA: string =
      '0x0000000000000000000000000000000000000001'
    const wrapperTokenAddressB: string =
      '0x0000000000000000000000000000000000000002'

    return {
      accounts,
      deployer,
      userA,
      wrapperRegistry,
      underlyingTokenAddressA,
      underlyingTokenAddressB,
      wrapperTokenAddressA,
      wrapperTokenAddressB,
    }
  }

  describe('Initialization', function () {
    it('Can successfully deploy BondConfigVault with proper arguments', async () => {
      const { wrapperRegistry } = await setupTestContext()
      expect(await wrapperRegistry.numWrappers()).to.eq(0)
      await expect(wrapperRegistry.wrapperAt(0)).to.be.reverted
    })
  })

  describe('Ownership', function () {
    it('Can transfer ownership', async () => {
      const { wrapperRegistry, deployer, userA } = await setupTestContext()
      const deployerAddress = await deployer.getAddress()
      const userAAddress = await userA.getAddress()

      expect(await wrapperRegistry.owner()).to.eq(deployerAddress)
      await wrapperRegistry.transferOwnership(userAAddress)
      expect(await wrapperRegistry.owner()).to.eq(userAAddress)
    })
  })

  describe('Simple Updating Wrappers', function () {
    it('Can successfully add a wrapper', async () => {
      const {
        wrapperRegistry,
        underlyingTokenAddressA,
        wrapperTokenAddressA,
      } = await setupTestContext()

      await expect(
        wrapperRegistry.addWrapper(
          underlyingTokenAddressA,
          wrapperTokenAddressA,
        ),
      )
        .to.emit(wrapperRegistry, 'WrapperAdded')
        .withArgs(underlyingTokenAddressA, wrapperTokenAddressA)

      expect(await wrapperRegistry.numWrappers()).to.eq(1)
      const { 0: underlying, 1: wrapper } = await wrapperRegistry.wrapperAt(0)
      expect(underlying).to.eq(underlyingTokenAddressA)
      expect(wrapper).to.eq(wrapperTokenAddressA)
    })

    it('Can successfully remove a wrapper', async () => {
      const {
        wrapperRegistry,
        underlyingTokenAddressA,
        wrapperTokenAddressA,
      } = await setupTestContext()

      // Adding a config first (so that we can test removing it)
      await expect(
        wrapperRegistry.addWrapper(
          underlyingTokenAddressA,
          wrapperTokenAddressA,
        ),
      )
        .to.emit(wrapperRegistry, 'WrapperAdded')
        .withArgs(underlyingTokenAddressA, wrapperTokenAddressA)
      expect(await wrapperRegistry.numWrappers()).to.eq(1)

      await expect(wrapperRegistry.removeWrapper(underlyingTokenAddressA))
        .to.emit(wrapperRegistry, 'WrapperRemoved')
        .withArgs(underlyingTokenAddressA, wrapperTokenAddressA)

      expect(await wrapperRegistry.numWrappers()).to.eq(0)
    })
  })

  describe('Updating Wrapper Edge Cases', function () {
    it("Adding the same underlying multiple times doesn't change number of configs", async () => {
      const {
        wrapperRegistry,
        underlyingTokenAddressA,
        wrapperTokenAddressA,
        wrapperTokenAddressB,
      } = await setupTestContext()

      // Emits the first time
      await expect(
        wrapperRegistry.addWrapper(
          underlyingTokenAddressA,
          wrapperTokenAddressA,
        ),
      )
        .to.emit(wrapperRegistry, 'WrapperAdded')
        .withArgs(underlyingTokenAddressA, wrapperTokenAddressA)
      expect(await wrapperRegistry.numWrappers()).to.eq(1)

      // Doesn't emit subsequent times.
      for (let i = 0; i < 5; i++) {
        await expect(
          wrapperRegistry.addWrapper(
            underlyingTokenAddressA,
            wrapperTokenAddressA,
          ),
        ).to.not.emit(wrapperRegistry, 'WrapperAdded')
        await expect(
          wrapperRegistry.addWrapper(
            underlyingTokenAddressA,
            wrapperTokenAddressB,
          ),
        ).to.not.emit(wrapperRegistry, 'WrapperAdded')
      }

      expect(await wrapperRegistry.numWrappers()).to.eq(1)
    })

    it('Removing non-existent underlying throws error', async () => {
      const {
        wrapperRegistry,
        underlyingTokenAddressA,
        underlyingTokenAddressB,
        wrapperTokenAddressA,
      } = await setupTestContext()

      await expect(
        wrapperRegistry.addWrapper(
          underlyingTokenAddressA,
          wrapperTokenAddressA,
        ),
      )
        .to.emit(wrapperRegistry, 'WrapperAdded')
        .withArgs(underlyingTokenAddressA, wrapperTokenAddressA)
      expect(await wrapperRegistry.numWrappers()).to.eq(1)

      // Removing non-existent bondConfig to test numConfigs not changing. Shouldn't emit
      await expect(
        wrapperRegistry.removeWrapper(underlyingTokenAddressB),
      ).to.not.emit(wrapperRegistry, 'WrapperRemoved')

      // Testing still only 1 config present
      expect(await wrapperRegistry.numWrappers()).to.eq(1)

      // Validating the 1 config present is the first one, not the latter
      const { 0: underlying, 1: wrapper } = await wrapperRegistry.wrapperAt(0)
      expect(underlying).to.eq(underlyingTokenAddressA)
      expect(wrapper).to.eq(wrapperTokenAddressA)
    })
  })

  describe('Querying', function () {
    it('Can successfully query wrapper from underlying', async () => {
      const {
        wrapperRegistry,
        underlyingTokenAddressA,
        underlyingTokenAddressB,
        wrapperTokenAddressA,
        wrapperTokenAddressB,
      } = await setupTestContext()

      await expect(
        wrapperRegistry.addWrapper(
          underlyingTokenAddressA,
          wrapperTokenAddressA,
        ),
      )
        .to.emit(wrapperRegistry, 'WrapperAdded')
        .withArgs(underlyingTokenAddressA, wrapperTokenAddressA)
      await expect(
        wrapperRegistry.addWrapper(
          underlyingTokenAddressB,
          wrapperTokenAddressB,
        ),
      )
        .to.emit(wrapperRegistry, 'WrapperAdded')
        .withArgs(underlyingTokenAddressB, wrapperTokenAddressB)

      expect(
        await wrapperRegistry.getWrapperFromUnderlying(underlyingTokenAddressA),
      ).to.eq(wrapperTokenAddressA)
      expect(
        await wrapperRegistry.getWrapperFromUnderlying(underlyingTokenAddressB),
      ).to.eq(wrapperTokenAddressB)
    })

    it('Querying missing underlying returns 0-address', async () => {
      const {
        wrapperRegistry,
        underlyingTokenAddressA,
        underlyingTokenAddressB,
        wrapperTokenAddressA,
      } = await setupTestContext()

      await expect(
        wrapperRegistry.addWrapper(
          underlyingTokenAddressA,
          wrapperTokenAddressA,
        ),
      )
        .to.emit(wrapperRegistry, 'WrapperAdded')
        .withArgs(underlyingTokenAddressA, wrapperTokenAddressA)

      expect(
        await wrapperRegistry.getWrapperFromUnderlying(underlyingTokenAddressB),
      ).to.eq(ethers.constants.AddressZero)
    })

    it('Can successfully query underlying from wrapper', async () => {
      const {
        wrapperRegistry,
        underlyingTokenAddressA,
        underlyingTokenAddressB,
        wrapperTokenAddressA,
        wrapperTokenAddressB,
      } = await setupTestContext()

      await expect(
        wrapperRegistry.addWrapper(
          underlyingTokenAddressA,
          wrapperTokenAddressA,
        ),
      )
        .to.emit(wrapperRegistry, 'WrapperAdded')
        .withArgs(underlyingTokenAddressA, wrapperTokenAddressA)
      await expect(
        wrapperRegistry.addWrapper(
          underlyingTokenAddressB,
          wrapperTokenAddressB,
        ),
      )
        .to.emit(wrapperRegistry, 'WrapperAdded')
        .withArgs(underlyingTokenAddressB, wrapperTokenAddressB)

      expect(
        await wrapperRegistry.getUnderlyingFromWrapper(wrapperTokenAddressA),
      ).to.eq(underlyingTokenAddressA)
      expect(
        await wrapperRegistry.getUnderlyingFromWrapper(wrapperTokenAddressB),
      ).to.eq(underlyingTokenAddressB)
    })

    it('Querying missing wrapper returns 0-address', async () => {
      const {
        wrapperRegistry,
        underlyingTokenAddressA,
        wrapperTokenAddressA,
        wrapperTokenAddressB,
      } = await setupTestContext()

      await expect(
        wrapperRegistry.addWrapper(
          underlyingTokenAddressA,
          wrapperTokenAddressA,
        ),
      )
        .to.emit(wrapperRegistry, 'WrapperAdded')
        .withArgs(underlyingTokenAddressA, wrapperTokenAddressA)

      expect(
        await wrapperRegistry.getUnderlyingFromWrapper(wrapperTokenAddressB),
      ).to.eq(ethers.constants.AddressZero)
    })
  })
})
