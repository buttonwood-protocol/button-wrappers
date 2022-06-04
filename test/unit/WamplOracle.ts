import { ethers, waffle } from 'hardhat'
import { BigNumber, Contract, Signer } from 'ethers'
import { expect } from 'chai'

let mockAmplEthAggregator: Contract
let mockEthUsdAggregator: Contract
let mockAmpl: Contract
let mockWampl: Contract
let oracle: Contract
let deployer: Signer
let user: Signer

async function mockedOracle() {
  const [deployer, user] = await ethers.getSigners()
  // deploy mocks
  const mockAmplEthAggregator = await (
    await ethers.getContractFactory('MockChainlinkAggregator')
  )
    .connect(deployer)
    .deploy(18)
  const mockEthUsdAggregator = await (
    await ethers.getContractFactory('MockChainlinkAggregator')
  )
    .connect(deployer)
    .deploy(8)
  const mockAmpl = await (await ethers.getContractFactory('MockAMPL'))
    .connect(deployer)
    .deploy(9)
  const mockWampl = await (await ethers.getContractFactory('MockWAMPL'))
    .connect(deployer)
    .deploy(18, mockAmpl.address)
  // deploy contract to test
  const oracle = await (await ethers.getContractFactory('WamplOracle'))
    .connect(deployer)
    .deploy(
      mockAmplEthAggregator.address,
      mockEthUsdAggregator.address,
      mockWampl.address,
      60000,
    )

  return {
    deployer,
    user,
    mockAmplEthAggregator,
    mockEthUsdAggregator,
    mockAmpl,
    mockWampl,
    oracle,
  }
}

describe('WamplOracle', function () {
  before('setup Orchestrator contract', async () => {
    ;({
      deployer,
      user,
      mockAmplEthAggregator,
      mockEthUsdAggregator,
      mockAmpl,
      mockWampl,
      oracle,
    } = await waffle.loadFixture(mockedOracle))
  })

  describe('when sent ether', async function () {
    it('should reject', async function () {
      await expect(user.sendTransaction({ to: oracle.address, value: 1 })).to.be
        .reverted
    })
  })

  describe('Fetching data', async function () {
    it('should succeed with fresh data', async function () {
      // Set AMPL to be worth 0.0005 ETH
      await expect(
        mockAmplEthAggregator
          .connect(user)
          .setLatestAnswer(BigNumber.from('500000000000000')),
      ).to.not.be.reverted
      // Set ETH to be worth 2000 USD
      await expect(
        mockEthUsdAggregator
          .connect(user)
          .setLatestAnswer(BigNumber.from('200000000000')),
      ).to.not.be.reverted
      await expect(
        mockAmplEthAggregator
          .connect(user)
          .setUpdatedAt(Math.floor(new Date().valueOf() / 1000)),
      ).to.not.be.reverted
      await expect(
        mockEthUsdAggregator
          .connect(user)
          .setUpdatedAt(Math.floor(new Date().valueOf() / 1000)),
      ).to.not.be.reverted

      const [res, success] = await oracle.getData()

      // The oracles should combine to price AMPL at 1 USD
      // Thus 1 WAMPL = 1 USD * AMPL:WAMPL ratio, which is defined in MockWAMPL wrapperToUnderlying
      // 1 WAMPL = ~5.9 AMPL, thus WamplOracle should return ~5.9e8
      expect(res.toString()).to.eq('592916430')
      expect(success).to.eq(true)
    })

    it('should fail with stale data', async function () {
      // Set AMPL to be worth 0.0005 ETH
      await expect(
        mockAmplEthAggregator
          .connect(user)
          .setLatestAnswer(BigNumber.from('500000000000000')),
      ).to.not.be.reverted
      // Set ETH to be worth 2000 USD
      await expect(
        mockEthUsdAggregator
          .connect(user)
          .setLatestAnswer(BigNumber.from('200000000000')),
      ).to.not.be.reverted
      await expect(
        mockAmplEthAggregator
          .connect(user)
          .setUpdatedAt(Math.floor(new Date().valueOf() / 1000) - 100000),
      ).to.not.be.reverted
      await expect(
        mockEthUsdAggregator
          .connect(user)
          .setUpdatedAt(Math.floor(new Date().valueOf() / 1000) - 100000),
      ).to.not.be.reverted

      const [res, success] = await oracle.getData()

      expect(res.toString()).to.eq('592916430')
      expect(success).to.eq(false)
    })
  })
})
