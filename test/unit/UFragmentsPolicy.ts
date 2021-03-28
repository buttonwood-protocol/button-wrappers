import { ethers, upgrades, waffle } from 'hardhat'
import { Contract, Signer, BigNumber, BigNumberish, Event } from 'ethers'
import { TransactionResponse } from '@ethersproject/providers'
import { expect } from 'chai'
import { Result } from 'ethers/lib/utils'
import { imul } from '../utils/utils'

let uFragmentsPolicy: Contract,
  mockUFragments: Contract,
  mockCollateralToken: Contract,
  mockMarketOracle: Contract
let deployer: Signer, user: Signer

const INITIAL_COLLATERAL_BALANCE = ethers.utils.parseUnits('1', 18)
const INITIAL_RATE = ethers.utils.parseUnits('1', 8)
const INITIAL_RATE_30P_MORE = imul(INITIAL_RATE, '1.3', 1)
const INITIAL_RATE_30P_LESS = imul(INITIAL_RATE, '0.7', 1)
const INITIAL_RATE_5P_MORE = imul(INITIAL_RATE, '1.05', 1)
const INITIAL_RATE_5P_LESS = imul(INITIAL_RATE, '0.95', 1)
const INITIAL_RATE_60P_MORE = imul(INITIAL_RATE, '1.6', 1)
const INITIAL_RATE_2X = INITIAL_RATE.mul(2)

async function mockedUpgradablePolicy() {
  // get signers
  const [deployer, user] = await ethers.getSigners()
  // deploy mocks
  const mockUFragments = await (
    await ethers.getContractFactory('MockUFragments')
  )
    .connect(deployer)
    .deploy()

  const mockCollateralToken = await (
    await ethers.getContractFactory('MockERC20Token')
  )
    .connect(deployer)
    .deploy()
  const mockMarketOracle = await (await ethers.getContractFactory('MockOracle'))
    .connect(deployer)
    .deploy('MarketOracle')
  // deploy upgradable contract
  const uFragmentsPolicy = await upgrades.deployProxy(
    (await ethers.getContractFactory('UFragmentsPolicy')).connect(deployer),
    [
      await deployer.getAddress(),
      mockUFragments.address,
      mockCollateralToken.address,
    ],
    {
      initializer: 'initialize(address,address,address)',
    },
  )
  // setup oracles
  await uFragmentsPolicy
    .connect(deployer)
    .setMarketOracle(mockMarketOracle.address)
  // return entities
  return {
    deployer,
    user,
    mockUFragments,
    mockMarketOracle,
    mockCollateralToken,
    uFragmentsPolicy,
  }
}

async function mockExternalData(
  rate: BigNumberish,
  collateralBalance: BigNumberish,
  uFragSupply: BigNumberish,
  rateValidity = true,
) {
  await mockMarketOracle.connect(deployer).storeData(rate)
  await mockMarketOracle.connect(deployer).storeValidity(rateValidity)
  await mockCollateralToken.connect(deployer).storeBalance(collateralBalance)
  await mockUFragments.connect(deployer).storeSupply(uFragSupply)
}

async function parseRebaseLog(response: Promise<TransactionResponse>) {
  const receipt = (await (await response).wait()) as any
  const logs = receipt.events.filter(
    (event: Event) => event.event === 'LogRebase',
  )
  return logs[0].args
}

describe('UFragmentsPolicy', function () {
  before('setup UFragmentsPolicy contract', async () => {
    ;({
      deployer,
      user,
      mockCollateralToken,
      mockUFragments,
      mockMarketOracle,
      uFragmentsPolicy,
    } = await waffle.loadFixture(mockedUpgradablePolicy))
  })

  it('should reject any ether sent to it', async function () {
    await expect(
      user.sendTransaction({ to: uFragmentsPolicy.address, value: 1 }),
    ).to.be.reverted
  })
})

describe('UFragmentsPolicy:initialize', async function () {
  describe('initial values set correctly', function () {
    before('setup UFragmentsPolicy contract', async () => {
      ;({
        deployer,
        user,
        mockCollateralToken,
        mockUFragments,
        mockMarketOracle,
        uFragmentsPolicy,
      } = await waffle.loadFixture(mockedUpgradablePolicy))
    })

    it('should set owner', async function () {
      expect(await uFragmentsPolicy.owner()).to.eq(await deployer.getAddress())
    })

    it('should set reference to uFragments', async function () {
      expect(await uFragmentsPolicy.uFrags()).to.eq(mockUFragments.address)
    })

    it('should set reference to collateralToken', async function () {
      expect(await uFragmentsPolicy.collateralToken()).to.eq(
        mockCollateralToken.address,
      )
    })
  })
})

describe('UFragmentsPolicy:setMarketOracle', async function () {
  before('setup UFragmentsPolicy contract', async () => {
    ;({
      deployer,
      user,
      mockCollateralToken,
      mockUFragments,
      mockMarketOracle,
      uFragmentsPolicy,
    } = await waffle.loadFixture(mockedUpgradablePolicy))
  })

  it('should set marketOracle', async function () {
    await uFragmentsPolicy
      .connect(deployer)
      .setMarketOracle(await deployer.getAddress())
    expect(await uFragmentsPolicy.marketOracle()).to.eq(
      await deployer.getAddress(),
    )
  })
})

describe('UFragments:setMarketOracle:accessControl', function () {
  before('setup UFragmentsPolicy contract', async () => {
    ;({
      deployer,
      user,
      mockCollateralToken,
      mockUFragments,
      mockMarketOracle,
      uFragmentsPolicy,
    } = await waffle.loadFixture(mockedUpgradablePolicy))
  })

  it('should be callable by owner', async function () {
    await expect(
      uFragmentsPolicy
        .connect(deployer)
        .setMarketOracle(await deployer.getAddress()),
    ).to.not.be.reverted
  })

  it('should NOT be callable by non-owner', async function () {
    await expect(
      uFragmentsPolicy
        .connect(user)
        .setMarketOracle(await deployer.getAddress()),
    ).to.be.reverted
  })
})

describe('UFragmentsPolicy:Rebase:accessControl', async function () {
  beforeEach('setup UFragmentsPolicy contract', async function () {
    ;({
      deployer,
      user,
      mockCollateralToken,
      mockUFragments,
      mockMarketOracle,
      uFragmentsPolicy,
    } = await waffle.loadFixture(mockedUpgradablePolicy))
    await mockExternalData(
      INITIAL_RATE_30P_MORE,
      INITIAL_COLLATERAL_BALANCE,
      1000,
      true,
    )
  })

  describe('when rebase called by anybody', function () {
    it('should succeed', async function () {
      await expect(uFragmentsPolicy.connect(user).rebase()).not.to.be.reverted
    })
  })
})

describe('UFragmentsPolicy:Rebase', async function () {
  before('setup UFragmentsPolicy contract', async () => {
    ;({
      deployer,
      user,
      mockCollateralToken,
      mockUFragments,
      mockMarketOracle,
      uFragmentsPolicy,
    } = await waffle.loadFixture(mockedUpgradablePolicy))
  })

  describe('when the market oracle returns invalid data', function () {
    it('should fail', async function () {
      await mockExternalData(
        INITIAL_RATE_30P_MORE,
        INITIAL_COLLATERAL_BALANCE,
        1000,
        false,
      )
      await expect(uFragmentsPolicy.connect(user).rebase()).to.be.reverted
    })
  })

  describe('when the market oracle returns valid data', function () {
    it('should NOT fail', async function () {
      await mockExternalData(
        INITIAL_RATE_30P_MORE,
        INITIAL_COLLATERAL_BALANCE,
        1000,
        true,
      )
      await expect(uFragmentsPolicy.connect(user).rebase()).to.not.be.reverted
    })
  })
})

describe('UFragmentsPolicy:Rebase', async function () {
  beforeEach('setup UFragmentsPolicy contract', async function () {
    ;({
      deployer,
      user,
      mockCollateralToken,
      mockUFragments,
      mockMarketOracle,
      uFragmentsPolicy,
    } = await waffle.loadFixture(mockedUpgradablePolicy))
    await mockExternalData(
      INITIAL_RATE_30P_MORE,
      INITIAL_COLLATERAL_BALANCE,
      1000,
      true,
    )
  })

  describe('rate increases', function () {
    it('should increase supply', async function () {
      const r = uFragmentsPolicy.connect(user).rebase()
      await expect(r)
        .to.emit(uFragmentsPolicy, 'LogRebase')
        .withArgs(
          INITIAL_RATE_30P_MORE,
          imul(INITIAL_COLLATERAL_BALANCE, 1.3, 1),
        )
    })

    it('should call getData from the market oracle', async function () {
      await expect(uFragmentsPolicy.connect(user).rebase())
        .to.emit(mockMarketOracle, 'FunctionCalled')
        .withArgs('MarketOracle', 'getData', uFragmentsPolicy.address)
    })

    it('should call uFrag Rebase', async function () {
      const r = uFragmentsPolicy.connect(user).rebase()
      await expect(r)
        .to.emit(mockUFragments, 'FunctionCalled')
        .withArgs('UFragments', 'rebase', uFragmentsPolicy.address)
      await expect(r)
        .to.emit(mockUFragments, 'FunctionArguments')
        .withArgs([imul(INITIAL_COLLATERAL_BALANCE, 1.3, 1)], [])
    })
  })
})

describe('UFragmentsPolicy:Rebase', async function () {
  beforeEach('setup UFragmentsPolicy contract', async function () {
    ;({
      deployer,
      user,
      mockCollateralToken,
      mockUFragments,
      mockMarketOracle,
      uFragmentsPolicy,
    } = await waffle.loadFixture(mockedUpgradablePolicy))
    await mockExternalData(
      INITIAL_RATE_30P_LESS,
      INITIAL_COLLATERAL_BALANCE,
      1000,
      true,
    )
  })

  describe('rate decreases', function () {
    it('should decrease supply', async function () {
      const r = uFragmentsPolicy.connect(user).rebase()
      await expect(r)
        .to.emit(uFragmentsPolicy, 'LogRebase')
        .withArgs(
          INITIAL_RATE_30P_LESS,
          imul(INITIAL_COLLATERAL_BALANCE, 0.7, 1),
        )
    })

    it('should call getData from the market oracle', async function () {
      await expect(uFragmentsPolicy.connect(user).rebase())
        .to.emit(mockMarketOracle, 'FunctionCalled')
        .withArgs('MarketOracle', 'getData', uFragmentsPolicy.address)
    })

    it('should call uFrag Rebase', async function () {
      const r = uFragmentsPolicy.connect(user).rebase()
      await expect(r)
        .to.emit(mockUFragments, 'FunctionCalled')
        .withArgs('UFragments', 'rebase', uFragmentsPolicy.address)
      await expect(r)
        .to.emit(mockUFragments, 'FunctionArguments')
        .withArgs([imul(INITIAL_COLLATERAL_BALANCE, 0.7, 1)], [])
    })
  })
})

describe('UFragmentsPolicy:Rebase', async function () {
  beforeEach('setup UFragmentsPolicy contract', async function () {
    ;({
      deployer,
      user,
      mockCollateralToken,
      mockUFragments,
      mockMarketOracle,
      uFragmentsPolicy,
    } = await waffle.loadFixture(mockedUpgradablePolicy))
    await mockExternalData(
      INITIAL_RATE,
      INITIAL_COLLATERAL_BALANCE.mul(2),
      1000,
      true,
    )
  })

  describe('collateral balance increases', function () {
    it('should increase supply', async function () {
      const r = uFragmentsPolicy.connect(user).rebase()
      await expect(r)
        .to.emit(uFragmentsPolicy, 'LogRebase')
        .withArgs(INITIAL_RATE, INITIAL_COLLATERAL_BALANCE.mul(2))
    })

    it('should call getData from the market oracle', async function () {
      await expect(uFragmentsPolicy.connect(user).rebase())
        .to.emit(mockMarketOracle, 'FunctionCalled')
        .withArgs('MarketOracle', 'getData', uFragmentsPolicy.address)
    })

    it('should call uFrag Rebase', async function () {
      const r = uFragmentsPolicy.connect(user).rebase()
      await expect(r)
        .to.emit(mockUFragments, 'FunctionCalled')
        .withArgs('UFragments', 'rebase', uFragmentsPolicy.address)
      await expect(r)
        .to.emit(mockUFragments, 'FunctionArguments')
        .withArgs([imul(INITIAL_COLLATERAL_BALANCE, 2, 1)], [])
    })
  })
})

describe('UFragmentsPolicy:Rebase', async function () {
  beforeEach('setup UFragmentsPolicy contract', async function () {
    ;({
      deployer,
      user,
      mockCollateralToken,
      mockUFragments,
      mockMarketOracle,
      uFragmentsPolicy,
    } = await waffle.loadFixture(mockedUpgradablePolicy))
    await mockExternalData(
      INITIAL_RATE,
      imul(INITIAL_COLLATERAL_BALANCE, 0.5, 1),
      1000,
      true,
    )
  })

  describe('collateral balance decreases', function () {
    it('should decrease supply', async function () {
      const r = uFragmentsPolicy.connect(user).rebase()
      await expect(r)
        .to.emit(uFragmentsPolicy, 'LogRebase')
        .withArgs(INITIAL_RATE, imul(INITIAL_COLLATERAL_BALANCE, 0.5, 1))
    })

    it('should call getData from the market oracle', async function () {
      await expect(uFragmentsPolicy.connect(user).rebase())
        .to.emit(mockMarketOracle, 'FunctionCalled')
        .withArgs('MarketOracle', 'getData', uFragmentsPolicy.address)
    })

    it('should call uFrag Rebase', async function () {
      const r = uFragmentsPolicy.connect(user).rebase()
      await expect(r)
        .to.emit(mockUFragments, 'FunctionCalled')
        .withArgs('UFragments', 'rebase', uFragmentsPolicy.address)
      await expect(r)
        .to.emit(mockUFragments, 'FunctionArguments')
        .withArgs([imul(INITIAL_COLLATERAL_BALANCE, 0.5, 1)], [])
    })
  })
})

describe('UFragmentsPolicy:Rebase', async function () {
  beforeEach('setup UFragmentsPolicy contract', async function () {
    ;({
      deployer,
      user,
      mockCollateralToken,
      mockUFragments,
      mockMarketOracle,
      uFragmentsPolicy,
    } = await waffle.loadFixture(mockedUpgradablePolicy))
  })

  describe('both rate and collateral balance change', function () {
    it('should rebase properly', async function () {
      // test 100 random combinations of rate and balance
      for (let i = 0; i < 100; i++) {
        const max = 10000
        const min = 0.0001
        const rate = imul(INITIAL_RATE, Math.random() * (max - min) + min, 1)
        const balance = imul(
          INITIAL_COLLATERAL_BALANCE,
          Math.random() * (max - min) + min,
          1,
        )
        const expectedSupply = rate.mul(balance).div(10 ** 8)
        await mockExternalData(rate, balance, 1000, true)

        const r = uFragmentsPolicy.connect(user).rebase()
        await expect(r)
          .to.emit(uFragmentsPolicy, 'LogRebase')
          .withArgs(rate, expectedSupply)

        await expect(r)
          .to.emit(mockUFragments, 'FunctionCalled')
          .withArgs('UFragments', 'rebase', uFragmentsPolicy.address)
        await expect(r)
          .to.emit(mockUFragments, 'FunctionArguments')
          .withArgs([expectedSupply], [])
      }
    })
  })
})
