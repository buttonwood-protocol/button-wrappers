import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers, waffle } from 'hardhat';

async function mockedOracle() {
  const [deployer, user] = await ethers.getSigners();
  // deploy mocks
  const mockInceptionVault = await (
    await ethers.getContractFactory('MockInceptionVault')
  )
    .connect(deployer)
    .deploy();
  // deploy contract to test
  const oracle = await (await ethers.getContractFactory('InceptionTokenOracle'))
    .connect(deployer)
    .deploy(mockInceptionVault.address);
  // need a contract with a non-view method that calls oracle.getData so we can gas test
  const mockOracleDataFetcher = await (
    await ethers.getContractFactory('MockOracleDataFetcher')
  )
    .connect(deployer)
    .deploy(oracle.address);

  return {
    deployer,
    user,
    mockInceptionVault,
    oracle,
    mockOracleDataFetcher,
  };
}

describe('InceptionTokenOracle', function () {
  describe('when sent ether', async function () {
    it('should reject', async function () {
      const { user, oracle } = await waffle.loadFixture(mockedOracle);
      await expect(user.sendTransaction({ to: oracle.address, value: 1 })).to.be
        .reverted;
    });
  });

  describe('Fetching data', async function () {
    it('should succeed with fresh data', async function () {
      const { user, mockInceptionVault, mockOracleDataFetcher } =
        await waffle.loadFixture(mockedOracle);

      await expect(
        mockInceptionVault
          .connect(user)
          .setInceptionTokenSupply(BigNumber.from('6413278131285121422182816')),
      ).to.not.be.reverted;
      await expect(
        mockInceptionVault
          .connect(user)
          .setTotalDeposited(BigNumber.from('7091831834635293267033248')),
      ).to.not.be.reverted;

      const tx = await mockOracleDataFetcher.connect(user).fetch();
      const receipt = await tx.wait();
      const [value, valid] = await mockOracleDataFetcher.getData();

      // uniETH denominated in ETH should be ETHReserve/XETHAmount
      expect(value.toString()).to.be.closeTo(
        BigNumber.from('1105804502698871756'),
        BigNumber.from('1'),
      );
      expect(valid).to.eq(true);
      expect(receipt.gasUsed.toString()).to.equal('82168');
    });

    it('should return 1:1 when inceptionToken-eth is empty', async function () {
      const { user, mockInceptionVault, mockOracleDataFetcher } =
        await waffle.loadFixture(mockedOracle);

      await expect(
        mockInceptionVault
          .connect(user)
          .setInceptionTokenSupply(BigNumber.from('0')),
      ).to.not.be.reverted;
      await expect(
        mockInceptionVault.connect(user).setTotalDeposited(BigNumber.from('0')),
      ).to.not.be.reverted;

      const tx = await mockOracleDataFetcher.connect(user).fetch();
      const receipt = await tx.wait();
      const [value, valid] = await mockOracleDataFetcher.getData();

      // uniETH denominated in ETH should be ETHReserve/XETHAmount
      expect(value.toString()).to.eq('1000000000000000000');
      expect(valid).to.eq(true);
      expect(receipt.gasUsed.toString()).to.equal('79333');
    });
  });
});
