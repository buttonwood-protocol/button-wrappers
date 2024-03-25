import { ethers, waffle } from 'hardhat';
import { Contract, Signer } from 'ethers';
import { expect } from 'chai';
import { TransactionResponse } from '@ethersproject/providers';

let oracle: Contract, mockAggregator: Contract, oracleFetcher: Contract;
let r: Promise<TransactionResponse>;
let deployer: Signer, user: Signer;

async function mockedOracle() {
  const [deployer, user] = await ethers.getSigners();
  // deploy mocks
  const mockAggregator = await (
    await ethers.getContractFactory('MockChainlinkAggregator')
  )
    .connect(deployer)
    .deploy(8);
  const oracle = await (await ethers.getContractFactory('ChainlinkOracle'))
    .connect(deployer)
    .deploy(mockAggregator.address, 60000);

  const oracleFetcher = await (
    await ethers.getContractFactory('MockOracleDataFetcher')
  )
    .connect(deployer)
    .deploy(oracle.address);
  return {
    deployer,
    user,
    oracle,
    oracleFetcher,
    mockAggregator,
  };
}

describe('ChainlinkOracle', function () {
  before('setup Orchestrator contract', async () => {
    ({ deployer, user, oracle, oracleFetcher, mockAggregator } =
      await waffle.loadFixture(mockedOracle));
  });

  describe('when sent ether', async function () {
    it('should reject', async function () {
      await expect(user.sendTransaction({ to: oracle.address, value: 1 })).to.be
        .reverted;
    });
  });

  describe('Fetching data', async function () {
    it('should fetch data', async function () {
      const data = ethers.BigNumber.from('18923491321');

      await expect(mockAggregator.connect(user).setLatestAnswer(data)).to.not.be
        .reverted;
      await expect(
        mockAggregator
          .connect(user)
          .setUpdatedAt(Math.floor(new Date().valueOf() / 1000)),
      ).to.not.be.reverted;

      // we use an oracle fetcher contract because, since the IOracle
      // interface getData function is writable, we can't fetch the response directly
      const tx = await oracleFetcher.connect(user).fetch();
      const receipt = await tx.wait();
      const [res, success] = await oracleFetcher.getData();

      expect(res.toString()).to.eq(data.toString());
      expect(success).to.eq(true);
      expect(receipt.gasUsed.toString()).to.equal('78860');
    });

    it('should fail with stale data', async function () {
      const data = ethers.BigNumber.from('18923491321');

      await expect(mockAggregator.connect(user).setLatestAnswer(data)).to.not.be
        .reverted;
      await expect(
        mockAggregator
          .connect(user)
          .setUpdatedAt(Math.floor(new Date().valueOf() / 1000) - 100000),
      ).to.not.be.reverted;

      const tx = await oracleFetcher.connect(user).fetch();
      const receipt = await tx.wait();
      const [res, success] = await oracleFetcher.getData();

      expect(res.toString()).to.eq(data.toString());
      expect(success).to.eq(false);
      expect(receipt.gasUsed.toString()).to.equal('37060');
    });
  });
});
