import { ethers, waffle } from 'hardhat'
import { Contract, Signer } from 'ethers'
import { increaseTime } from '../utils/utils'
import { expect } from 'chai'
import { TransactionResponse } from '@ethersproject/providers'

let oracle: Contract, mockAggregator: Contract, oracleFetcher: Contract
let r: Promise<TransactionResponse>
let deployer: Signer, user: Signer

async function mockedOracle() {
  const [deployer, user] = await ethers.getSigners()
  // deploy mocks
  const mockAggregator = await (
    await ethers.getContractFactory('MockChainlinkAggregator')
  )
    .connect(deployer)
    .deploy()
  const oracle = await (await ethers.getContractFactory('ChainlinkOracle'))
    .connect(deployer)
    .deploy(mockAggregator.address)

  const oracleFetcher = await (
    await ethers.getContractFactory('MockOracleDataFetcher')
  )
    .connect(deployer)
    .deploy(oracle.address)
  return {
    deployer,
    user,
    oracle,
    oracleFetcher,
    mockAggregator,
  }
}

describe('ChainlinkOracle', function () {
  before('setup Orchestrator contract', async () => {
    ;({
      deployer,
      user,
      oracle,
      oracleFetcher,
      mockAggregator,
    } = await waffle.loadFixture(mockedOracle))
  })

  describe('when sent ether', async function () {
    it('should reject', async function () {
      await expect(user.sendTransaction({ to: oracle.address, value: 1 })).to.be
        .reverted
    })
  })

  describe('Fetching data', async function () {
    it('should fetch data', async function () {
      const data = ethers.BigNumber.from('18923491321')

      await expect(mockAggregator.connect(user).setLatestAnswer(data)).to.not.be
        .reverted

      // we use an oracle fetcher contract because, since the IOracle
      // interface getData function is writable, we can't fetch the response directly
      await oracleFetcher.connect(user).fetch()

      const [res, success] = await oracleFetcher.getData()

      expect(res.toString()).to.eq(data.toString())
      expect(success).to.eq(true)
    })
  })
})
