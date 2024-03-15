import { ethers } from 'hardhat';
import { Contract, Signer, BigNumber, BigNumberish } from 'ethers';
import { expect } from 'chai';

const PRICE_DECIMALS = 8;
const DECIMALS = 18;
const NAME = 'Bitcoin';
const SYMBOL = 'BTC';

const toOracleValue = (v: string): BigNumber =>
  ethers.utils.parseUnits(v, PRICE_DECIMALS);

let accounts: Signer[],
  deployer: Signer,
  deployerAddress: string,
  userA: Signer,
  userAAddress: string,
  userB: Signer,
  userBAddress: string,
  userC: Signer,
  userCAddress: string,
  mockBTC: Contract,
  mockOracle: Contract,
  template: Contract,
  factory: Contract;

async function createInstance(
  factory: Contract,
  underlying: String,
  name: String,
  symbol: String,
  oracle: string,
) {
  const args = ethers.utils.defaultAbiCoder.encode(
    ['address', 'string', 'string', 'address'],
    [underlying, name, symbol, oracle],
  );
  const instanceAddress = await factory.callStatic['create(bytes)'](args);
  await factory['create(bytes)'](args);

  const instance = (await ethers.getContractFactory('ButtonToken'))
    .connect(deployer)
    .attach(instanceAddress);
  return instance;
}

async function setupContracts() {
  accounts = await ethers.getSigners();
  deployer = accounts[0];
  userA = accounts[1];
  userB = accounts[2];
  userC = accounts[3];

  deployerAddress = await deployer.getAddress();
  userAAddress = await userA.getAddress();
  userBAddress = await userB.getAddress();
  userCAddress = await userC.getAddress();

  const erc20Factory = await ethers.getContractFactory('MockERC20');
  mockBTC = await erc20Factory
    .connect(deployer)
    .deploy('Wood Bitcoin', 'WOOD-BTC');
  await mockBTC.mint(deployerAddress, '10000000000000000000');

  const oracleFactory = await ethers.getContractFactory('MockOracle');
  mockOracle = await oracleFactory.connect(deployer).deploy();
  await mockOracle.setData(toOracleValue('10000'), true);

  const buttonTokenContractFactory = await ethers.getContractFactory(
    'ButtonToken',
  );
  template = await buttonTokenContractFactory.connect(deployer).deploy();

  factory = await (await ethers.getContractFactory('ButtonTokenFactory'))
    .connect(deployer)
    .deploy(template.address);
}

describe('ButtonTokenFactory', () => {
  before('setup ButtonTokenFactory contract', setupContracts);

  it('should reject any ether sent to it', async function () {
    const user = accounts[1];
    await expect(user.sendTransaction({ to: factory.address, value: 1 })).to.be
      .reverted;
  });
});

describe('ButtonToken:Initialization', () => {
  beforeEach('setup ButtonTokenFactory contract', setupContracts);

  it('should set the correct template reference', async function () {
    expect(await factory.template()).to.eq(template.address);
    expect(await factory.instanceCount()).to.eq(0);
  });
});

describe('ButtonToken:create', () => {
  beforeEach('setup ButtonTokenFactory contract', setupContracts);

  it('Clone should set msg.sender as owner', async function () {
    const bToken = await createInstance(
      factory,
      mockBTC.address,
      'BUTTON-Bitcoin',
      'BUTTON-BTC',
      mockOracle.address,
    );

    expect(await bToken.owner()).to.eq(deployerAddress);
  });

  it('Clone should have proper parameters set', async function () {
    const bToken = await createInstance(
      factory,
      mockBTC.address,
      'BUTTON-Bitcoin',
      'BUTTON-BTC',
      mockOracle.address,
    );

    expect(await bToken.underlying()).to.eq(mockBTC.address);
    expect(await bToken.name()).to.eq('BUTTON-Bitcoin');
    expect(await bToken.symbol()).to.eq('BUTTON-BTC');
    expect(await bToken.totalSupply()).to.eq('0');
    expect(await bToken.totalUnderlying()).to.eq('0');
  });

  it('Unpacked args should run with correct values', async function () {
    const instanceAddress = await factory.callStatic[
      'create(address,string,string,address)'
    ](mockBTC.address, 'BUTTON-Bitcoin', 'BUTTON-BTC', mockOracle.address);
    await factory['create(address,string,string,address)'](
      mockBTC.address,
      'BUTTON-Bitcoin',
      'BUTTON-BTC',
      mockOracle.address,
    );

    const bToken = (await ethers.getContractFactory('ButtonToken'))
      .connect(deployer)
      .attach(instanceAddress);
    expect(await bToken.underlying()).to.eq(mockBTC.address);
  });

  it('Instance should register into instanceSet', async function () {
    const bToken = await createInstance(
      factory,
      mockBTC.address,
      'BUTTON-Bitcoin',
      'BUTTON-BTC',
      mockOracle.address,
    );

    expect(await factory.instanceCount()).to.eq(1);
    expect(await factory.instanceAt(0)).to.eq(bToken.address);
    expect(await factory.isInstance(bToken.address)).to.eq(true);
  });

  it('deposits should have the correct conversion', async function () {
    const bToken = await createInstance(
      factory,
      mockBTC.address,
      'BUTTON-Bitcoin',
      'BUTTON-BTC',
      mockOracle.address,
    );

    expect(await mockBTC.balanceOf(deployerAddress)).to.eq(
      '10000000000000000000',
    );

    const depositAmt = '5000000000000000000'; // 5 mockBTC
    await mockBTC.connect(deployer).approve(bToken.address, depositAmt);
    await bToken.connect(deployer).deposit(depositAmt);

    // 10000 * depositAmt
    expect(await bToken.balanceOf(deployerAddress)).to.eq(
      '50000000000000000000000',
    );

    await mockOracle.setData(toOracleValue('50000'), true);

    // 50000 * depositAmt
    expect(await bToken.balanceOf(deployerAddress)).to.eq(
      '250000000000000000000000',
    );
  });
});
