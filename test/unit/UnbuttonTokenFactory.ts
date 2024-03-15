import { ethers } from 'hardhat';
import { Contract, Signer, BigNumber, BigNumberish } from 'ethers';
import { expect } from 'chai';

const startingMultiplier = 10000;
const multiplierGranularity = 10000;

let accounts: Signer[],
  deployer: Signer,
  deployerAddress: string,
  userA: Signer,
  userAAddress: string,
  userB: Signer,
  userBAddress: string,
  userC: Signer,
  userCAddress: string,
  mockAmpl: Contract,
  template: Contract,
  factory: Contract,
  initialDeposit: BigNumberish,
  initialRate: BigNumber;

async function createInstance(
  factory: Contract,
  underlying: String,
  name: String,
  symbol: String,
  initialRate: BigNumber,
) {
  const args = ethers.utils.defaultAbiCoder.encode(
    ['address', 'string', 'string', 'uint256'],
    [underlying, name, symbol, initialRate],
  );
  const instanceAddress = await factory.callStatic['create(bytes)'](args);
  await factory['create(bytes)'](args);

  const instance = (await ethers.getContractFactory('UnbuttonToken'))
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

  const AMPL_TOTAL_SUPPLY = '50000000000000000'; // 50m AMPL
  const MAX_SUPPLY = '10000000000000000000000000'; // 10m unbutton tokens
  initialDeposit = '1000';

  const rebasingErc20ContractFactory = await ethers.getContractFactory(
    'MockRebasingERC20',
  );
  mockAmpl = await rebasingErc20ContractFactory
    .connect(deployer)
    .deploy('Ampleforth', 'AMPL', startingMultiplier, multiplierGranularity);
  await mockAmpl.mint(deployerAddress, AMPL_TOTAL_SUPPLY);

  const unbuttonTokenContractFactory = await ethers.getContractFactory(
    'UnbuttonToken',
  );
  template = await unbuttonTokenContractFactory.connect(deployer).deploy();

  factory = await (await ethers.getContractFactory('UnbuttonTokenFactory'))
    .connect(deployer)
    .deploy(template.address);

  initialRate = BigNumber.from('1').mul(MAX_SUPPLY).div(AMPL_TOTAL_SUPPLY);
}

describe('UnbuttonTokenFactory', () => {
  before('setup UnbuttonTokenFactory contract', setupContracts);

  it('should reject any ether sent to it', async function () {
    const user = accounts[1];
    await expect(user.sendTransaction({ to: factory.address, value: 1 })).to.be
      .reverted;
  });
});

describe('UnbuttonToken:Initialization', () => {
  beforeEach('setup UnbuttonTokenFactory contract', setupContracts);

  it('should set the correct template reference', async function () {
    expect(await factory.template()).to.eq(template.address);
    expect(await factory.instanceCount()).to.eq(0);
  });
});

describe('UnbuttonToken:create', () => {
  beforeEach('setup UnbuttonTokenFactory contract', setupContracts);

  it('Clone should have proper parameters set', async function () {
    await mockAmpl.approve(factory.address, await template.INITIAL_DEPOSIT());
    const ubToken = await createInstance(
      factory,
      mockAmpl.address,
      'UNBUTTON-Ampleforth',
      'UNBUTTON-AMPL',
      initialRate,
    );

    expect(await ubToken.underlying()).to.eq(mockAmpl.address);
    expect(await ubToken.name()).to.eq('UNBUTTON-Ampleforth');
    expect(await ubToken.symbol()).to.eq('UNBUTTON-AMPL');
    expect(await ubToken.totalSupply()).to.eq(initialRate.mul(initialDeposit));
    expect(await ubToken.totalUnderlying()).to.eq('1000');
  });

  it('Unpacked args should run with correct values', async function () {
    await mockAmpl.approve(factory.address, await template.INITIAL_DEPOSIT());
    const instanceAddress = await factory.callStatic[
      'create(address,string,string,uint256)'
    ](mockAmpl.address, 'UNBUTTON-Ampleforth', 'UNBUTTON-AMPL', initialRate);
    await factory['create(address,string,string,uint256)'](
      mockAmpl.address,
      'UNBUTTON-Ampleforth',
      'UNBUTTON-AMPL',
      initialRate,
    );

    const ubToken = (await ethers.getContractFactory('UnbuttonToken'))
      .connect(deployer)
      .attach(instanceAddress);
    expect(await ubToken.underlying()).to.eq(mockAmpl.address);
  });

  it('Instance should register into instanceSet', async function () {
    await mockAmpl.approve(factory.address, await template.INITIAL_DEPOSIT());
    const ubToken = await createInstance(
      factory,
      mockAmpl.address,
      'UNBUTTON-Ampleforth',
      'UNBUTTON-AMPL',
      initialRate,
    );

    expect(await factory.instanceCount()).to.eq(1);
    expect(await factory.instanceAt(0)).to.eq(ubToken.address);
    expect(await factory.isInstance(ubToken.address)).to.eq(true);
  });

  it('deposits should have the correct conversion', async function () {
    await mockAmpl.approve(factory.address, await template.INITIAL_DEPOSIT());
    const ubToken = await createInstance(
      factory,
      mockAmpl.address,
      'UNBUTTON-Ampleforth',
      'UNBUTTON-AMPL',
      initialRate,
    );

    {
      const depositAmt = '5000000000000000'; // 5m or 10% of ampl supply
      await mockAmpl.connect(deployer).approve(ubToken.address, depositAmt);
      await ubToken.connect(deployer).deposit(depositAmt);

      // 1m or 10% of ub supply
      expect(await ubToken.balanceOf(deployerAddress)).to.eq(
        '1000000000000000000000000',
      );
    }

    await mockAmpl.rebase(2 * startingMultiplier);

    {
      const depositAmt = '10000000000000000'; // 10m or 10% of ampl supply
      await mockAmpl.connect(deployer).approve(ubToken.address, depositAmt);
      await ubToken.connect(deployer).deposit(depositAmt);

      // 2m or 20% of ub supply
      expect(await ubToken.balanceOf(deployerAddress)).to.eq(
        '2000000000000000000000000',
      );
    }
  });
});
