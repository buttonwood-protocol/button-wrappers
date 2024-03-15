import { ethers, waffle } from 'hardhat';
import { Contract, Signer } from 'ethers';
import { expect } from 'chai';
import { TransactionResponse } from '@ethersproject/providers';

let oracle: Contract, mockDapiProxy: Contract, oracleFetcher: Contract;
let r: Promise<TransactionResponse>;
let deployer: Signer, user: Signer;

async function mockedOracle() {
  const [deployer, user] = await ethers.getSigners();
  // deploy mocks
  const mockDapiProxy = await (await ethers.getContractFactory('MockDapiProxy'))
    .connect(deployer)
    .deploy();
  const oracle = await (await ethers.getContractFactory('API3Oracle'))
    .connect(deployer)
    .deploy(mockDapiProxy.address, 60000);

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
    mockDapiProxy,
  };
}

describe('API3Oracle', function () {
  before('setup Orchestrator contract', async () => {
    ({ deployer, user, oracle, oracleFetcher, mockDapiProxy } =
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

      await expect(mockDapiProxy.connect(user).setLatestAnswer(data)).to.not.be
        .reverted;
      await expect(
        mockDapiProxy
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
      expect(receipt.gasUsed.toString()).to.equal('76533');
    });

    it('should fail with stale data', async function () {
      const data = ethers.BigNumber.from('18923491321');

      await expect(mockDapiProxy.connect(user).setLatestAnswer(data)).to.not.be
        .reverted;
      await expect(
        mockDapiProxy
          .connect(user)
          .setUpdatedAt(Math.floor(new Date().valueOf() / 1000) - 100000),
      ).to.not.be.reverted;

      const tx = await oracleFetcher.connect(user).fetch();
      const receipt = await tx.wait();
      const [res, success] = await oracleFetcher.getData();

      expect(res.toString()).to.eq(data.toString());
      expect(success).to.eq(false);
      expect(receipt.gasUsed.toString()).to.equal('34733');
    });
  });
});
