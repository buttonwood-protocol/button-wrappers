import { ethers, waffle } from 'hardhat';
import { Contract, Signer, BigNumber } from 'ethers';
import { expect } from 'chai';
const { loadFixture } = waffle;

const PRICE_DECIMALS = 8;
const NAME = 'Button WAMPL';
const SYMBOL = 'BTN-WAMPL';

const startingMultiplier = 10000;
const multiplierGranularity = 10000;
const AMPL_TOTAL_SUPPLY = '50000000000000000'; // 50m AMPL

interface TestContext {
  accounts: Signer[];
  buttonToken: Contract;
  mockOracle: Contract;
  ampl: Contract;
  wampl: Contract;
  router: Contract;
}

const toOracleValue = (v: string): BigNumber =>
  ethers.utils.parseUnits(v, PRICE_DECIMALS);

async function fixture(): Promise<TestContext> {
  const accounts = await ethers.getSigners();
  const deployer = accounts[0];
  const deployerAddress = await deployer.getAddress();

  const rebasingErc20ContractFactory = await ethers.getContractFactory(
    'MockRebasingERC20',
  );
  const ampl = await rebasingErc20ContractFactory
    .connect(deployer)
    .deploy('Ampleforth', 'AMPL', startingMultiplier, multiplierGranularity);
  await ampl.mint(deployerAddress, AMPL_TOTAL_SUPPLY);

  const wamplContractFactory = await ethers.getContractFactory('WAMPL');
  const wampl = await wamplContractFactory
    .connect(deployer)
    .deploy(ampl.address);

  const oracleFactory = await ethers.getContractFactory('MockOracle');
  const mockOracle = await oracleFactory.deploy();
  await mockOracle.setData(toOracleValue('10000'), true);

  const buttonTokenFactory = await ethers.getContractFactory('ButtonToken');
  const buttonToken = await buttonTokenFactory.deploy();

  buttonToken.initialize(wampl.address, NAME, SYMBOL, mockOracle.address);

  const routerFactory = await ethers.getContractFactory(
    'ButtonTokenWamplRouter',
  );
  const router = await routerFactory.deploy(wampl.address);

  return {
    accounts,
    buttonToken,
    mockOracle,
    ampl,
    wampl,
    router,
  };
}

describe('ButtonTokenWamplRouter', () => {
  it('should instantiate router', async function () {
    const { router } = await loadFixture(fixture);

    expect(router.address).to.exist;
  });

  it('should deposit AMPL', async function () {
    const { router, ampl, wampl, accounts, buttonToken } = await loadFixture(
      fixture,
    );
    const [user] = accounts;
    const userAddress = await user.getAddress();

    const depositAmount = ethers.utils.parseUnits('5', 9);
    const wamplAmount = depositAmount.mul(BigNumber.from(10).pow(9)).div(5);
    await ampl.connect(user).approve(router.address, depositAmount);

    await expect(router.wamplWrapAndDeposit(buttonToken.address, depositAmount))
      // 1. Transfer AMPL to router
      .to.emit(ampl, 'Transfer')
      .withArgs(userAddress, router.address, depositAmount)
      // 2. Router approves AMPL to WAMPL
      .to.emit(ampl, 'Approval')
      .withArgs(router.address, wampl.address, depositAmount)
      // 3. Router transfers AMPL to WAMPL contract
      .to.emit(ampl, 'Transfer')
      .withArgs(router.address, wampl.address, depositAmount)
      // 4. WAMPL contract mints (transfers) WAMPL balance to router (from 0-address)
      .to.emit(wampl, 'Transfer')
      .withArgs(ethers.constants.AddressZero, router.address, wamplAmount)
      // 5. Router approves wampl to buttonToken contract
      .to.emit(wampl, 'Approval')
      .withArgs(router.address, buttonToken.address, wamplAmount)
      // 6. Router transfers wampl to buttonToken contract
      .to.emit(wampl, 'Transfer')
      .withArgs(router.address, buttonToken, wamplAmount)
      // 7. buttonToken contract mints (transfers) buttonToken balance to user (from 0-address)
      .to.emit(buttonToken, 'Transfer')
      .withArgs(
        ethers.constants.AddressZero,
        userAddress,
        wamplAmount.mul('10000'),
      );

    expect(await buttonToken.balanceOf(await user.getAddress())).to.equal(
      wamplAmount.mul('10000'),
    );

    expect(await wampl.balanceOf(router.address)).to.equal('0');
    expect(await buttonToken.balanceOf(router.address)).to.equal('0');
    expect(await user.provider!.getBalance(router.address)).to.equal('0');
  });

  it('should fail to deposit if no ampl given', async function () {
    const { router, ampl, accounts, buttonToken } = await loadFixture(fixture);
    const [user] = accounts;

    const depositAmount = ethers.utils.parseUnits('0', 9);
    await expect(
      router.wamplWrapAndDeposit(buttonToken.address, depositAmount),
    ).to.be.revertedWith('ZeroAmount');

    expect(await ampl.balanceOf(router.address)).to.equal('0');
    expect(await buttonToken.balanceOf(router.address)).to.equal('0');
    expect(await user.provider!.getBalance(router.address)).to.equal('0');
  });

  it('should fail to deposit if no buttonToken underlying is not wampl', async function () {
    const { router, ampl, accounts, mockOracle } = await loadFixture(fixture);
    const [user] = accounts;

    const buttonTokenFactory = await ethers.getContractFactory('ButtonToken');
    const invalidButtonToken = await buttonTokenFactory.deploy();
    invalidButtonToken.initialize(
      ampl.address,
      'BAD-BUTTON',
      'BTTN-BAD',
      mockOracle.address,
    );

    const depositAmount = ethers.utils.parseUnits('10', 9);
    await expect(
      router.wamplWrapAndDeposit(invalidButtonToken.address, depositAmount),
    ).to.be.revertedWith('InvalidButtonAsset');

    expect(await ampl.balanceOf(router.address)).to.equal('0');
    expect(await invalidButtonToken.balanceOf(router.address)).to.equal('0');
    expect(await user.provider!.getBalance(router.address)).to.equal('0');
  });

  it('should burn button tokens', async function () {
    const { router, accounts, ampl, wampl, buttonToken } = await loadFixture(
      fixture,
    );
    const [user] = accounts;
    const userAddress = await user.getAddress();

    const depositAmount = ethers.utils.parseUnits('5', 9);
    await ampl.connect(user).approve(router.address, depositAmount);
    await router.wamplWrapAndDeposit(buttonToken.address, depositAmount);

    const userStartingBalance = await ampl.balanceOf(userAddress);
    await buttonToken.approve(
      router.address,
      ethers.utils.parseUnits('5000', 18),
    );

    const burnAmount = ethers.utils.parseUnits('5000', 18);
    const wamplAmount = burnAmount.div('10000').sub('1');
    const amplAmount = wamplAmount.mul(5).div(BigNumber.from(10).pow(9));
    await expect(router.wamplBurnAndUnwrap(buttonToken.address, burnAmount))
      // 1. Transfer buttonTokens from user to router
      .to.emit(buttonToken, 'Transfer')
      .withArgs(userAddress, router.address, burnAmount)
      // 2. Burn buttonTokens for wampl
      .to.emit(buttonToken, 'Transfer')
      .withArgs(router.address, ethers.constants.AddressZero, burnAmount)
      .to.emit(wampl, 'Transfer')
      .withArgs(buttonToken.address, router.address, wamplAmount)
      // 3. Burn wampl for ampl
      .to.emit(wampl, 'Transfer')
      .withArgs(router.address, ethers.constants.AddressZero, wamplAmount)
      // 4. Burnt wampl sends ampl directly to user
      .to.emit(ampl, 'Transfer')
      .withArgs(wampl.address, userAddress, amplAmount);

    const userEndingBalance = await ampl.balanceOf(userAddress);
    // make sure user balance increased by output amount minus some threshold for gas

    expect(
      userEndingBalance
        .sub(userStartingBalance)
        .gt(ethers.utils.parseUnits('0.24', 9)),
    ).to.be.true;

    expect(await wampl.balanceOf(router.address)).to.equal('0');
    expect(await buttonToken.balanceOf(router.address)).to.equal('0');
    expect(await ampl.balanceOf(router.address)).to.equal('0');
  });

  it('should burn all button tokens', async function () {
    const { router, accounts, ampl, wampl, buttonToken } = await loadFixture(
      fixture,
    );
    const [user] = accounts;
    const userAddress = await user.getAddress();

    const depositAmount = ethers.utils.parseUnits('5', 9);
    await ampl.connect(user).approve(router.address, depositAmount);
    await router.wamplWrapAndDeposit(buttonToken.address, depositAmount);

    const userStartingBalance = await ampl.balanceOf(userAddress);
    await buttonToken.approve(router.address, ethers.constants.MaxUint256);
    const userButtonTokenBalance = await buttonToken.balanceOf(userAddress);
    const wamplAmount = userButtonTokenBalance.div('10000');
    const amplAmount = wamplAmount.mul(5).div(BigNumber.from(10).pow(9));

    await expect(router.wamplBurnAndUnwrapAll(buttonToken.address))
      // 1. Transfer buttonTokens from user to router
      .to.emit(buttonToken, 'Transfer')
      .withArgs(userAddress, router.address, userButtonTokenBalance)
      // 2. Burn buttonTokens for wampl
      .to.emit(buttonToken, 'Transfer')
      .withArgs(
        router.address,
        ethers.constants.AddressZero,
        userButtonTokenBalance,
      )
      .to.emit(wampl, 'Transfer')
      .withArgs(buttonToken.address, router.address, wamplAmount)
      // 3. Burn wampl for ampl
      .to.emit(wampl, 'Transfer')
      .withArgs(router.address, ethers.constants.AddressZero, wamplAmount)
      // 4. Burnt wampl sends ampl directly to user
      .to.emit(ampl, 'Transfer')
      .withArgs(wampl.address, userAddress, amplAmount);

    const userEndingBalance = await ampl.balanceOf(userAddress);
    // make sure user balance increased by output amount minus some threshold for gas
    expect(
      userEndingBalance
        .sub(userStartingBalance)
        .gt(ethers.utils.parseUnits('4.99', 9)),
    ).to.be.true;

    expect(await wampl.balanceOf(router.address)).to.equal('0');
    expect(await buttonToken.balanceOf(router.address)).to.equal('0');
    expect(await ampl.balanceOf(router.address)).to.equal('0');
  });
  //
  it('should fail to burn all if not approved', async function () {
    const { router, ampl, wampl, accounts, buttonToken } = await loadFixture(
      fixture,
    );
    const [user] = accounts;

    const depositAmount = ethers.utils.parseUnits('5', 9);
    await ampl.connect(user).approve(router.address, depositAmount);
    await router.wamplWrapAndDeposit(buttonToken.address, depositAmount);

    await expect(router.wamplBurnAndUnwrapAll(buttonToken.address)).to.be
      .reverted;

    expect(await wampl.balanceOf(router.address)).to.equal('0');
    expect(await buttonToken.balanceOf(router.address)).to.equal('0');
    expect(await ampl.balanceOf(router.address)).to.equal('0');
  });

  it('should fail to burn if not approved', async function () {
    const { router, ampl, wampl, accounts, buttonToken } = await loadFixture(
      fixture,
    );
    const [user] = accounts;

    const depositAmount = ethers.utils.parseUnits('5', 9);
    await ampl.connect(user).approve(router.address, depositAmount);
    await router.wamplWrapAndDeposit(buttonToken.address, depositAmount);

    await expect(router.wamplBurnAndUnwrap(buttonToken.address, depositAmount))
      .to.be.reverted;

    expect(await wampl.balanceOf(router.address)).to.equal('0');
    expect(await buttonToken.balanceOf(router.address)).to.equal('0');
    expect(await ampl.balanceOf(router.address)).to.equal('0');
  });
});
