import { ethers, waffle } from 'hardhat';
import { BigNumber } from 'ethers';
import { expect } from 'chai';

async function mockedOracle() {
  const [deployer, user] = await ethers.getSigners();
  // deploy mocks
  const mockAmplEthAggregator = await (
    await ethers.getContractFactory('MockChainlinkAggregator')
  )
    .connect(deployer)
    .deploy(18);
  const mockEthUsdAggregator = await (
    await ethers.getContractFactory('MockChainlinkAggregator')
  )
    .connect(deployer)
    .deploy(8);
  const mockAmpl = await (await ethers.getContractFactory('MockAMPL'))
    .connect(deployer)
    .deploy(9);
  const mockWampl = await (await ethers.getContractFactory('MockWAMPL'))
    .connect(deployer)
    .deploy(18, mockAmpl.address);
  // deploy contract to test
  const oracle = await (await ethers.getContractFactory('WamplOracle'))
    .connect(deployer)
    .deploy(
      mockAmplEthAggregator.address,
      mockEthUsdAggregator.address,
      mockWampl.address,
      60000,
    );
  // need a contract with a non-view method that calls oracle.getData so we can gas test
  const mockOracleDataFetcher = await (
    await ethers.getContractFactory('MockOracleDataFetcher')
  )
    .connect(deployer)
    .deploy(oracle.address);

  return {
    deployer,
    user,
    mockAmplEthAggregator,
    mockEthUsdAggregator,
    mockAmpl,
    mockWampl,
    oracle,
    mockOracleDataFetcher,
  };
}

describe('WamplOracle', function () {
  describe('when sent ether', async function () {
    it('should reject', async function () {
      const { user, oracle } = await waffle.loadFixture(mockedOracle);
      await expect(user.sendTransaction({ to: oracle.address, value: 1 })).to.be
        .reverted;
    });
  });

  describe('Fetching data', async function () {
    it('should succeed with fresh data', async function () {
      const {
        user,
        mockAmplEthAggregator,
        mockEthUsdAggregator,
        mockOracleDataFetcher,
      } = await waffle.loadFixture(mockedOracle);

      // Set AMPL to be worth 0.0005 ETH
      await expect(
        mockAmplEthAggregator
          .connect(user)
          .setLatestAnswer(BigNumber.from('500000000000000')),
      ).to.not.be.reverted;
      // Set ETH to be worth 2000 USD
      await expect(
        mockEthUsdAggregator
          .connect(user)
          .setLatestAnswer(BigNumber.from('200000000000')),
      ).to.not.be.reverted;
      await expect(
        mockAmplEthAggregator
          .connect(user)
          .setUpdatedAt(Math.floor(new Date().valueOf() / 1000)),
      ).to.not.be.reverted;
      await expect(
        mockEthUsdAggregator
          .connect(user)
          .setUpdatedAt(Math.floor(new Date().valueOf() / 1000)),
      ).to.not.be.reverted;

      const tx = await mockOracleDataFetcher.connect(user).fetch();
      const receipt = await tx.wait();
      const [res, success] = await mockOracleDataFetcher.getData();

      // The oracles should combine to price AMPL at 1 USD
      // Thus 1 WAMPL = 1 USD * AMPL:WAMPL ratio, which is defined in MockWAMPL wrapperToUnderlying
      // 1 WAMPL = ~5.9 AMPL, thus WamplOracle should return ~5.9e8
      expect(res.toString()).to.eq('592916430');
      expect(success).to.eq(true);
      expect(receipt.gasUsed.toString()).to.equal('95845');
    });

    it('should fail with stale data', async function () {
      const {
        user,
        mockAmplEthAggregator,
        mockEthUsdAggregator,
        mockOracleDataFetcher,
      } = await waffle.loadFixture(mockedOracle);

      // Set AMPL to be worth 0.0005 ETH
      await expect(
        mockAmplEthAggregator
          .connect(user)
          .setLatestAnswer(BigNumber.from('500000000000000')),
      ).to.not.be.reverted;
      // Set ETH to be worth 2000 USD
      await expect(
        mockEthUsdAggregator
          .connect(user)
          .setLatestAnswer(BigNumber.from('200000000000')),
      ).to.not.be.reverted;
      await expect(
        mockAmplEthAggregator
          .connect(user)
          .setUpdatedAt(Math.floor(new Date().valueOf() / 1000) - 100000),
      ).to.not.be.reverted;
      await expect(
        mockEthUsdAggregator
          .connect(user)
          .setUpdatedAt(Math.floor(new Date().valueOf() / 1000) - 100000),
      ).to.not.be.reverted;

      const tx = await mockOracleDataFetcher.connect(user).fetch();
      const receipt = await tx.wait();
      const [res, success] = await mockOracleDataFetcher.getData();

      expect(res.toString()).to.eq('592916430');
      expect(success).to.eq(false);
      expect(receipt.gasUsed.toString()).to.equal('75931');
    });

    it('handles different AMPL<->WAMPL conversion rates', async function () {
      const {
        user,
        mockAmplEthAggregator,
        mockEthUsdAggregator,
        mockWampl,
        mockOracleDataFetcher,
      } = await waffle.loadFixture(mockedOracle);

      // Set AMPL to be worth 0.0005 ETH
      await expect(
        mockAmplEthAggregator
          .connect(user)
          .setLatestAnswer(BigNumber.from('500000000000000')),
      ).to.not.be.reverted;
      // Set ETH to be worth 2000 USD
      await expect(
        mockEthUsdAggregator
          .connect(user)
          .setLatestAnswer(BigNumber.from('200000000000')),
      ).to.not.be.reverted;
      await expect(
        mockAmplEthAggregator
          .connect(user)
          .setUpdatedAt(Math.floor(new Date().valueOf() / 1000)),
      ).to.not.be.reverted;
      await expect(
        mockEthUsdAggregator
          .connect(user)
          .setUpdatedAt(Math.floor(new Date().valueOf() / 1000)),
      ).to.not.be.reverted;
      await expect(
        mockWampl.connect(user).setTotalAMPLSupply('59291643044413257999'),
      ).to.not.be.reverted;

      const tx = await mockOracleDataFetcher.connect(user).fetch();
      const receipt = await tx.wait();
      const [res, success] = await mockOracleDataFetcher.getData();

      // The oracles should combine to price AMPL at 1 USD
      // Thus 1 WAMPL = 1 USD * AMPL:WAMPL ratio, which we set above
      // 1 WAMPL = ~5929 AMPL, thus WamplOracle should return ~5.9e11
      expect(res.toString()).to.eq('592916430444');
      expect(success).to.eq(true);
      expect(receipt.gasUsed.toString()).to.equal('95845');
    });

    it('handles extreme oracle values', async function () {
      const {
        user,
        mockAmplEthAggregator,
        mockEthUsdAggregator,
        mockOracleDataFetcher,
      } = await waffle.loadFixture(mockedOracle);

      // Set AMPL to be worth 5e-18 ETH
      await expect(
        mockAmplEthAggregator
          .connect(user)
          .setLatestAnswer(BigNumber.from('5')),
      ).to.not.be.reverted;
      // Set ETH to be worth 2000 USD
      await expect(
        mockEthUsdAggregator
          .connect(user)
          .setLatestAnswer(BigNumber.from('200000000000')),
      ).to.not.be.reverted;
      await expect(
        mockAmplEthAggregator
          .connect(user)
          .setUpdatedAt(Math.floor(new Date().valueOf() / 1000)),
      ).to.not.be.reverted;
      await expect(
        mockEthUsdAggregator
          .connect(user)
          .setUpdatedAt(Math.floor(new Date().valueOf() / 1000)),
      ).to.not.be.reverted;

      const tx = await mockOracleDataFetcher.connect(user).fetch();
      const receipt = await tx.wait();
      const [res, success] = await mockOracleDataFetcher.getData();

      // The oracles should combine to price AMPL at 0 USD
      // The amplEth feed is non-zero but too small to remain so after scaled to 8 decimals
      expect(res.toString()).to.eq('0');
      expect(success).to.eq(true);
      expect(receipt.gasUsed.toString()).to.equal('75945');

      // Set AMPL to be worth 1 ETH
      await expect(
        mockAmplEthAggregator
          .connect(user)
          .setLatestAnswer(BigNumber.from('1000000000000000000')),
      ).to.not.be.reverted;
      // Set ETH to be worth 1e-8 USD
      await expect(
        mockEthUsdAggregator.connect(user).setLatestAnswer(BigNumber.from('1')),
      ).to.not.be.reverted;

      const tx2 = await mockOracleDataFetcher.connect(user).fetch();
      const receipt2 = await tx2.wait();
      const [res2, success2] = await mockOracleDataFetcher.getData();

      // The oracles should combine to price AMPL at 1e-8 USD
      // There's just enough decimals to capture a non-zero value
      expect(res2.toString()).to.eq('5');
      expect(success2).to.eq(true);
      expect(receipt2.gasUsed.toString()).to.equal('75945');
    });
  });

  it('behaves correctly with negative convertPriceByDecimals', async function () {
    const { deployer, user } = await waffle.loadFixture(mockedOracle);

    // deploy fresh mocks with different configurations
    const mockAmplEthAggregator = await (
      await ethers.getContractFactory('MockChainlinkAggregator')
    )
      .connect(deployer)
      .deploy(4);
    const mockEthUsdAggregator = await (
      await ethers.getContractFactory('MockChainlinkAggregator')
    )
      .connect(deployer)
      .deploy(1);
    const mockAmpl = await (await ethers.getContractFactory('MockAMPL'))
      .connect(deployer)
      .deploy(9);
    const mockWampl = await (await ethers.getContractFactory('MockWAMPL'))
      .connect(deployer)
      .deploy(18, mockAmpl.address);
    // deploy contract to test
    const oracle = await (await ethers.getContractFactory('WamplOracle'))
      .connect(deployer)
      .deploy(
        mockAmplEthAggregator.address,
        mockEthUsdAggregator.address,
        mockWampl.address,
        60000,
      );
    // need a contract with a non-view method that calls oracle.getData so we can gas test
    const mockOracleDataFetcher = await (
      await ethers.getContractFactory('MockOracleDataFetcher')
    )
      .connect(deployer)
      .deploy(oracle.address);

    // Set AMPL to be worth 0.0005 ETH
    await expect(
      mockAmplEthAggregator.connect(user).setLatestAnswer(BigNumber.from('5')),
    ).to.not.be.reverted;
    // Set ETH to be worth 2000 USD
    await expect(
      mockEthUsdAggregator
        .connect(user)
        .setLatestAnswer(BigNumber.from('20000')),
    ).to.not.be.reverted;
    await expect(
      mockAmplEthAggregator
        .connect(user)
        .setUpdatedAt(Math.floor(new Date().valueOf() / 1000)),
    ).to.not.be.reverted;
    await expect(
      mockEthUsdAggregator
        .connect(user)
        .setUpdatedAt(Math.floor(new Date().valueOf() / 1000)),
    ).to.not.be.reverted;

    const tx = await mockOracleDataFetcher.connect(user).fetch();
    const receipt = await tx.wait();
    const [res, success] = await mockOracleDataFetcher.getData();

    // The oracles should combine to price AMPL at 1 USD
    // Thus 1 WAMPL = 1 USD * AMPL:WAMPL ratio, which is defined in MockWAMPL wrapperToUnderlying
    // 1 WAMPL = ~5.9 AMPL, thus WamplOracle should return ~5.9e8
    expect(res.toString()).to.eq('592916430');
    expect(success).to.eq(true);
    expect(receipt.gasUsed.toString()).to.equal('95960');
  });
});
