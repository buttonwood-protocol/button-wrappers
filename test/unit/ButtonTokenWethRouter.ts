import { ethers, waffle } from 'hardhat';
import { Contract, Signer, BigNumber } from 'ethers';
import { expect } from 'chai';
const { loadFixture } = waffle;

const PRICE_DECIMALS = 8;
const NAME = 'Button Bitcoin';
const SYMBOL = 'BTN-BTC';

interface TestContext {
  accounts: Signer[];
  buttonToken: Contract;
  mockOracle: Contract;
  weth: Contract;
  router: Contract;
}

const toOracleValue = (v: string): BigNumber =>
  ethers.utils.parseUnits(v, PRICE_DECIMALS);

async function fixture(): Promise<TestContext> {
  const accounts = await ethers.getSigners();

  const wethFactory = await ethers.getContractFactory('WETH9');
  const weth = await wethFactory.deploy();

  const oracleFactory = await ethers.getContractFactory('MockOracle');
  const mockOracle = await oracleFactory.deploy();
  await mockOracle.setData(toOracleValue('10000'), true);

  const buttonTokenFactory = await ethers.getContractFactory('ButtonToken');
  const buttonToken = await buttonTokenFactory.deploy();

  buttonToken.initialize(weth.address, NAME, SYMBOL, mockOracle.address);

  const routerFactory = await ethers.getContractFactory(
    'ButtonTokenWethRouter',
  );
  const router = await routerFactory.deploy(weth.address);

  return {
    accounts,
    buttonToken,
    mockOracle,
    weth,
    router,
  };
}

describe('ButtonTokenWethRouter', () => {
  it('should instantiate router', async function () {
    const { router } = await loadFixture(fixture);

    expect(router.address).to.exist;
  });

  it('should deposit ETH', async function () {
    const { router, weth, accounts, buttonToken } = await loadFixture(fixture);
    const [user] = accounts;

    const depositAmount = ethers.utils.parseEther('5');
    await expect(router.deposit(buttonToken.address, { value: depositAmount }))
      .to.emit(weth, 'Deposit')
      .withArgs(router.address, depositAmount)
      .to.emit(buttonToken, 'Transfer')
      .withArgs(
        ethers.constants.AddressZero,
        await user.getAddress(),
        depositAmount.mul('10000'),
      );

    expect(await buttonToken.balanceOf(await user.getAddress())).to.equal(
      depositAmount.mul('10000'),
    );

    expect(await weth.balanceOf(router.address)).to.equal('0');
    expect(await buttonToken.balanceOf(router.address)).to.equal('0');
    expect(await user.provider!.getBalance(router.address)).to.equal('0');
  });

  it('should fail to deposit if no eth given', async function () {
    const { router, weth, accounts, buttonToken } = await loadFixture(fixture);
    const [user] = accounts;

    const depositAmount = ethers.utils.parseEther('0');
    await expect(
      router.deposit(buttonToken.address, { value: depositAmount }),
    ).to.be.revertedWith('ButtonTokenWethRouter: No ETH supplied');

    expect(await weth.balanceOf(router.address)).to.equal('0');
    expect(await buttonToken.balanceOf(router.address)).to.equal('0');
    expect(await user.provider!.getBalance(router.address)).to.equal('0');
  });

  it('should burn button tokens', async function () {
    const { router, accounts, weth, buttonToken } = await loadFixture(fixture);
    const [user] = accounts;

    const depositAmount = ethers.utils.parseEther('5');
    await router.deposit(buttonToken.address, { value: depositAmount });

    const userStartingBalance = await user.getBalance();
    await buttonToken.approve(router.address, ethers.utils.parseEther('2500'));

    const burnAmount = ethers.utils.parseEther('2500');
    await expect(router.burn(buttonToken.address, burnAmount))
      .to.emit(buttonToken, 'Transfer')
      .withArgs(await user.getAddress(), router.address, burnAmount)
      .to.emit(buttonToken, 'Transfer')
      .withArgs(router.address, ethers.constants.AddressZero, burnAmount);

    const userEndingBalance = await user.getBalance();
    // make sure user balance increased by output amount minus some threshold for gas
    expect(
      userEndingBalance
        .sub(userStartingBalance)
        .gt(ethers.utils.parseEther('0.24')),
    ).to.be.true;

    expect(await weth.balanceOf(router.address)).to.equal('0');
    expect(await buttonToken.balanceOf(router.address)).to.equal('0');
    expect(await user.provider!.getBalance(router.address)).to.equal('0');
  });

  it('should burn all button tokens', async function () {
    const { router, accounts, weth, buttonToken } = await loadFixture(fixture);
    const [user] = accounts;

    const depositAmount = ethers.utils.parseEther('5');
    await router.deposit(buttonToken.address, { value: depositAmount });

    const userStartingBalance = await ethers.provider.getBalance(
      await user.getAddress(),
    );
    await buttonToken.approve(router.address, ethers.constants.MaxUint256);
    const userBalance = await buttonToken.balanceOf(await user.getAddress());

    await expect(router.burnAll(buttonToken.address))
      .to.emit(buttonToken, 'Transfer')
      .withArgs(await user.getAddress(), router.address, userBalance)
      .to.emit(buttonToken, 'Transfer')
      .withArgs(router.address, ethers.constants.AddressZero, userBalance);

    const userEndingBalance = await ethers.provider.getBalance(
      await user.getAddress(),
    );
    // make sure user balance increased by output amount minus some threshold for gas
    expect(
      userEndingBalance
        .sub(userStartingBalance)
        .gt(ethers.utils.parseEther('4.99')),
    ).to.be.true;

    expect(await weth.balanceOf(router.address)).to.equal('0');
    expect(await buttonToken.balanceOf(router.address)).to.equal('0');
    expect(await user.provider!.getBalance(router.address)).to.equal('0');
  });

  it('should fail to burn all if not approved', async function () {
    const { router, weth, accounts, buttonToken } = await loadFixture(fixture);
    const [user] = accounts;

    const depositAmount = ethers.utils.parseEther('5');
    await router.deposit(buttonToken.address, { value: depositAmount });

    await expect(router.burnAll(buttonToken.address)).to.be.reverted;

    expect(await weth.balanceOf(router.address)).to.equal('0');
    expect(await buttonToken.balanceOf(router.address)).to.equal('0');
    expect(await user.provider!.getBalance(router.address)).to.equal('0');
  });

  it('should fail to burn if not approved', async function () {
    const { router, weth, accounts, buttonToken } = await loadFixture(fixture);
    const [user] = accounts;

    const depositAmount = ethers.utils.parseEther('5');
    await router.deposit(buttonToken.address, { value: depositAmount });

    await expect(router.burn(buttonToken.address, depositAmount)).to.be
      .reverted;

    expect(await weth.balanceOf(router.address)).to.equal('0');
    expect(await buttonToken.balanceOf(router.address)).to.equal('0');
    expect(await user.provider!.getBalance(router.address)).to.equal('0');
  });

  it('should send ETH directly to the router', async function () {
    const { router, accounts } = await loadFixture(fixture);
    const [user] = accounts;

    const depositAmount = ethers.utils.parseEther('5');
    await expect(
      user.sendTransaction({ to: router.address, value: depositAmount }),
    ).to.be.revertedWith('ButtonTokenWethRouter: unexpected receive');

    expect(await user.provider!.getBalance(router.address)).to.equal('0');
  });
});
