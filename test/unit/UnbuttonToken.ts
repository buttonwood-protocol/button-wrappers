import { ethers, upgrades } from 'hardhat';
import { Contract, Signer, BigNumber, BigNumberish } from 'ethers';
import { expect } from 'chai';

const PRICE_DECIMALS = 8;
const DECIMALS = 18;
const NAME = 'Unbutton Ampleforth';
const SYMBOL = 'UBTN-AMPL';

const toOracleValue = (v: string): BigNumber =>
  ethers.utils.parseUnits(v, PRICE_DECIMALS);

const toFixedPtAmt = (a: string): BigNumber =>
  ethers.utils.parseUnits(a, DECIMALS);

const transferAmount = toFixedPtAmt('10');
const unitTokenAmount = toFixedPtAmt('1');

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
  unbuttonToken: Contract;

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

  const rebasingErc20Factory = await ethers.getContractFactory(
    'MockRebasingERC20',
  );
  mockAmpl = await rebasingErc20Factory.deploy(
    'Ampleforth',
    'AMPL',
    startingMultiplier,
    multiplierGranularity,
  );

  const unbuttonTokenFactory = await ethers.getContractFactory('UnbuttonToken');
  unbuttonToken = await unbuttonTokenFactory.deploy();

  const initialDeposit = await unbuttonToken.INITIAL_DEPOSIT();
  const initialRate = '1000000';
  await mockAmpl.mint(deployerAddress, initialDeposit);
  await mockAmpl.approve(unbuttonToken.address, initialDeposit);
  await unbuttonToken.initialize(mockAmpl.address, NAME, SYMBOL, initialRate);
}

describe('UnbuttonToken', () => {
  before('setup UnbuttonToken contract', setupContracts);

  it('should reject any ether sent to it', async function () {
    const user = accounts[1];
    await expect(user.sendTransaction({ to: unbuttonToken.address, value: 1 }))
      .to.be.reverted;
  });
});

describe('UnbuttonToken:Initialization', () => {
  beforeEach('setup UnbuttonToken contract', setupContracts);

  it('should set the underlying reference', async function () {
    expect(await unbuttonToken.underlying()).to.eq(mockAmpl.address);
  });

  it('should set detailed erc20 info parameters', async function () {
    expect(await unbuttonToken.name()).to.eq(NAME);
    expect(await unbuttonToken.symbol()).to.eq(SYMBOL);
    expect(await unbuttonToken.decimals()).to.eq(18);
  });

  it('should set the erc20 balance and supply', async function () {
    expect(await unbuttonToken.totalSupply()).to.eq('1000000000');
    expect(await unbuttonToken.balanceOf(unbuttonToken.address)).to.eq(
      '1000000000',
    );
    expect(await unbuttonToken.balanceOf(deployerAddress)).to.eq('0');
  });

  it('should set the underlying balance and supply', async function () {
    expect(await unbuttonToken.totalUnderlying()).to.eq('1000');
    expect(
      await unbuttonToken.balanceOfUnderlying(unbuttonToken.address),
    ).to.eq('1000');
    expect(await unbuttonToken.balanceOfUnderlying(deployerAddress)).to.eq('0');
  });
});

describe('UnbuttonToken Invalid Deposit', () => {
  beforeEach('setup UnbuttonToken contract', setupContracts);

  it('should fail to deposit negative amount', async function () {
    await expect(unbuttonToken.deposit('-1')).to.be.reverted;
  });

  it('should fail to deposit more than balance', async function () {
    await mockAmpl.mint(deployerAddress, '500');
    await mockAmpl.approve(unbuttonToken.address, '1000');
    await expect(unbuttonToken.deposit('1000')).to.be.reverted;
  });

  it('should fail to deposit more than allowed', async function () {
    await mockAmpl.mint(deployerAddress, '1000');
    await mockAmpl.approve(unbuttonToken.address, '500');
    await expect(unbuttonToken.deposit('1000')).to.be.reverted;
  });
});

describe('UnbuttonToken Deposit', () => {
  beforeEach('setup UnbuttonToken contract', setupContracts);

  describe('when the user deposits the smallest amount', async function () {
    let r: any;
    beforeEach(async function () {
      await mockAmpl.mint(deployerAddress, '1');
      await mockAmpl.approve(unbuttonToken.address, '1');
      r = unbuttonToken.deposit('1');
      await r;
    });

    it('should mint tokens to the user', async function () {
      expect(await unbuttonToken.totalSupply()).to.eq('1001000000');
      expect(await unbuttonToken.balanceOf(unbuttonToken.address)).to.eq(
        '1000000000',
      );
      expect(await unbuttonToken.balanceOf(deployerAddress)).to.eq('1000000');

      expect(await unbuttonToken.totalUnderlying()).to.eq('1001');
      expect(
        await unbuttonToken.balanceOfUnderlying(unbuttonToken.address),
      ).to.eq('1000');
      expect(await unbuttonToken.balanceOfUnderlying(deployerAddress)).to.eq(
        '1',
      );
    });

    it('should log transfer', async function () {
      await expect(r)
        .to.emit(mockAmpl, 'Transfer')
        .withArgs(deployerAddress, unbuttonToken.address, '1');
    });

    it('should log mint', async function () {
      await expect(r)
        .to.emit(unbuttonToken, 'Transfer')
        .withArgs(ethers.constants.AddressZero, deployerAddress, '1000000');
    });
  });

  describe('when the user deposits a reasonable amount', async function () {
    let r: any;
    beforeEach(async function () {
      await mockAmpl.mint(deployerAddress, '1000000000000'); // 1000 AMPL
      await mockAmpl.approve(unbuttonToken.address, '1000000000000');
      expect(await unbuttonToken.callStatic.deposit('1000000000000')).to.eq(
        '1000000000000000000',
      );
      r = unbuttonToken.deposit('1000000000000');
      await r;
    });

    it('should mint tokens to the user', async function () {
      expect(await unbuttonToken.totalSupply()).to.eq('1000000001000000000');
      expect(await unbuttonToken.balanceOf(unbuttonToken.address)).to.eq(
        '1000000000',
      );
      expect(await unbuttonToken.balanceOf(deployerAddress)).to.eq(
        '1000000000000000000',
      );

      expect(await unbuttonToken.totalUnderlying()).to.eq('1000000001000');
      expect(
        await unbuttonToken.balanceOfUnderlying(unbuttonToken.address),
      ).to.eq('1000');
      expect(await unbuttonToken.balanceOfUnderlying(deployerAddress)).to.eq(
        '1000000000000',
      );
    });

    it('should log transfer', async function () {
      await expect(r)
        .to.emit(mockAmpl, 'Transfer')
        .withArgs(deployerAddress, unbuttonToken.address, '1000000000000');
    });

    it('should log mint', async function () {
      await expect(r)
        .to.emit(unbuttonToken, 'Transfer')
        .withArgs(
          ethers.constants.AddressZero,
          deployerAddress,
          '1000000000000000000',
        );
    });
  });
});

describe('UnbuttonToken DepositFor', () => {
  beforeEach('setup UnbuttonToken contract', setupContracts);

  let r: any;
  beforeEach(async function () {
    await mockAmpl.mint(deployerAddress, '1000000000000'); // 1000 AMPL
    await mockAmpl.approve(unbuttonToken.address, '1000000000000');
    expect(
      await unbuttonToken.callStatic.depositFor(userAAddress, '1000000000000'),
    ).to.eq('1000000000000000000');
    r = unbuttonToken.depositFor(userAAddress, '1000000000000');
    await r;
  });

  it('should mint tokens to the user', async function () {
    expect(await unbuttonToken.totalSupply()).to.eq('1000000001000000000');
    expect(await unbuttonToken.balanceOf(userAAddress)).to.eq(
      '1000000000000000000',
    );
    expect(await unbuttonToken.totalUnderlying()).to.eq('1000000001000');
    expect(await unbuttonToken.balanceOfUnderlying(userAAddress)).to.eq(
      '1000000000000',
    );
  });

  it('should log transfer', async function () {
    await expect(r)
      .to.emit(mockAmpl, 'Transfer')
      .withArgs(deployerAddress, unbuttonToken.address, '1000000000000');
  });

  it('should log mint', async function () {
    await expect(r)
      .to.emit(unbuttonToken, 'Transfer')
      .withArgs(
        ethers.constants.AddressZero,
        userAAddress,
        '1000000000000000000',
      );
  });
});

describe('UnbuttonToken Withdrawal', () => {
  beforeEach('setup UnbuttonToken contract', setupContracts);

  it('should fail to withdraw 0 tokens', async function () {
    await expect(unbuttonToken.connect(userA).withdraw('0')).to.be.reverted;
  });

  it('should fail to withdraw more than deposited', async function () {
    await mockAmpl.mint(deployerAddress, '3000');
    await mockAmpl.approve(unbuttonToken.address, '3000');
    await unbuttonToken.deposit('3000');
    await expect(unbuttonToken.connect(userA).withdraw('3001')).to.be.reverted;
  });

  describe('correct amount', () => {
    let r: any;
    beforeEach(async function () {
      await mockAmpl.mint(deployerAddress, '3000');
      await mockAmpl.approve(unbuttonToken.address, '3000');
      await unbuttonToken.deposit('3000');
      expect(await unbuttonToken.callStatic.withdraw('500')).to.eq('500000000');
      r = unbuttonToken.withdraw('500');
      await r;
    });
    it('should withdraw correct amount of corresponding collateral', async function () {
      expect(await unbuttonToken.totalSupply()).to.eq('3500000000');
      expect(await unbuttonToken.balanceOf(deployerAddress)).to.eq(
        '2500000000',
      );
      expect(await unbuttonToken.totalUnderlying()).to.eq('3500');
      expect(await unbuttonToken.balanceOfUnderlying(deployerAddress)).to.eq(
        '2500',
      );
      expect(await mockAmpl.balanceOf(deployerAddress)).to.eq('500');
    });
    it('should log transfer', async function () {
      await expect(r)
        .to.emit(mockAmpl, 'Transfer')
        .withArgs(unbuttonToken.address, deployerAddress, '500');
    });
    it('should log mint', async function () {
      await expect(r)
        .to.emit(unbuttonToken, 'Transfer')
        .withArgs(deployerAddress, ethers.constants.AddressZero, '500000000');
    });
  });
});

describe('UnbuttonToken WithdrawTo', () => {
  beforeEach('setup UnbuttonToken contract', setupContracts);

  let r: any;
  beforeEach(async function () {
    await mockAmpl.mint(deployerAddress, '3000');
    await mockAmpl.approve(unbuttonToken.address, '3000');
    await unbuttonToken.deposit('3000');
    expect(
      await unbuttonToken.callStatic.withdrawTo(userAAddress, '500'),
    ).to.eq('500000000');
    r = unbuttonToken.withdrawTo(userAAddress, '500');
    await r;
  });
  it('should withdraw correct amount of corresponding collateral', async function () {
    expect(await unbuttonToken.totalSupply()).to.eq('3500000000');
    expect(await unbuttonToken.balanceOf(deployerAddress)).to.eq('2500000000');
    expect(await unbuttonToken.totalUnderlying()).to.eq('3500');
    expect(await unbuttonToken.balanceOfUnderlying(deployerAddress)).to.eq(
      '2500',
    );
    expect(await mockAmpl.balanceOf(deployerAddress)).to.eq('0');
    expect(await mockAmpl.balanceOf(userAAddress)).to.eq('500');
  });
  it('should log transfer', async function () {
    await expect(r)
      .to.emit(mockAmpl, 'Transfer')
      .withArgs(unbuttonToken.address, userAAddress, '500');
  });
  it('should log mint', async function () {
    await expect(r)
      .to.emit(unbuttonToken, 'Transfer')
      .withArgs(deployerAddress, ethers.constants.AddressZero, '500000000');
  });
});

describe('UnbuttonToken WithdrawalAll', () => {
  let r: any;
  beforeEach('setup UnbuttonToken contract', async function () {
    await setupContracts();

    await mockAmpl.mint(deployerAddress, '3000');
    await mockAmpl.approve(unbuttonToken.address, '3000');
    await unbuttonToken.deposit('3000');

    expect(await unbuttonToken.callStatic.withdrawAll()).to.eq('3000000000');
    r = unbuttonToken.withdrawAll();
    await r;
  });

  it('should fail to withdraw if balance is 0', async function () {
    expect(await unbuttonToken.balanceOf(userBAddress)).to.eq('0');
    await expect(unbuttonToken.connect(userB).withdrawAll()).to.be.reverted;
  });

  it('should withdraw correct amount of corresponding collateral', async function () {
    expect(await unbuttonToken.totalSupply()).to.eq('1000000000');
    expect(await unbuttonToken.balanceOf(deployerAddress)).to.eq('0');
    expect(await unbuttonToken.totalUnderlying()).to.eq('1000');
    expect(await unbuttonToken.balanceOfUnderlying(deployerAddress)).to.eq('0');
    expect(await mockAmpl.balanceOf(deployerAddress)).to.eq('3000');
  });
  it('should log transfer', async function () {
    await expect(r)
      .to.emit(mockAmpl, 'Transfer')
      .withArgs(unbuttonToken.address, deployerAddress, '3000');
  });
  it('should log mint', async function () {
    await expect(r)
      .to.emit(unbuttonToken, 'Transfer')
      .withArgs(deployerAddress, ethers.constants.AddressZero, '3000000000');
  });
});

describe('UnbuttonToken WithdrawalAllTo', () => {
  let r: any;
  beforeEach('setup UnbuttonToken contract', async function () {
    await setupContracts();

    await mockAmpl.mint(deployerAddress, '3000');
    await mockAmpl.approve(unbuttonToken.address, '3000');
    await unbuttonToken.deposit('3000');

    expect(await unbuttonToken.callStatic.withdrawAllTo(userAAddress)).to.eq(
      '3000000000',
    );
    r = unbuttonToken.withdrawAllTo(userAAddress);
    await r;
  });

  it('should withdraw correct amount of corresponding collateral', async function () {
    expect(await unbuttonToken.totalSupply()).to.eq('1000000000');
    expect(await unbuttonToken.balanceOf(deployerAddress)).to.eq('0');
    expect(await unbuttonToken.totalUnderlying()).to.eq('1000');
    expect(await unbuttonToken.balanceOfUnderlying(deployerAddress)).to.eq('0');
    expect(await unbuttonToken.balanceOf(deployerAddress)).to.eq('0');
    expect(await mockAmpl.balanceOf(userAAddress)).to.eq('3000');
  });
  it('should log transfer', async function () {
    await expect(r)
      .to.emit(mockAmpl, 'Transfer')
      .withArgs(unbuttonToken.address, userAAddress, '3000');
  });
  it('should log mint', async function () {
    await expect(r)
      .to.emit(unbuttonToken, 'Transfer')
      .withArgs(deployerAddress, ethers.constants.AddressZero, '3000000000');
  });
});

describe('UnbuttonToken Mint', () => {
  beforeEach('setup UnbuttonToken contract', setupContracts);

  let r: any;
  beforeEach(async function () {
    await mockAmpl.mint(deployerAddress, '1000000000000'); // 1000 AMPL
    await mockAmpl.approve(unbuttonToken.address, '1000000000000');
    expect(await unbuttonToken.callStatic.mint('1000000000000000000')).to.eq(
      '1000000000000',
    );
    r = unbuttonToken.mint('1000000000000000000');
    await r;
  });

  it('should mint tokens to the user', async function () {
    expect(await unbuttonToken.totalSupply()).to.eq('1000000001000000000');
    expect(await unbuttonToken.balanceOf(deployerAddress)).to.eq(
      '1000000000000000000',
    );
    expect(await unbuttonToken.totalUnderlying()).to.eq('1000000001000');
    expect(await unbuttonToken.balanceOfUnderlying(deployerAddress)).to.eq(
      '1000000000000',
    );
  });

  it('should log transfer', async function () {
    await expect(r)
      .to.emit(mockAmpl, 'Transfer')
      .withArgs(deployerAddress, unbuttonToken.address, '1000000000000');
  });

  it('should log mint', async function () {
    await expect(r)
      .to.emit(unbuttonToken, 'Transfer')
      .withArgs(
        ethers.constants.AddressZero,
        deployerAddress,
        '1000000000000000000',
      );
  });
});

describe('UnbuttonToken MintFor', () => {
  beforeEach('setup UnbuttonToken contract', setupContracts);

  describe('when the user deposits a reasonable amount', async function () {
    let r: any;
    beforeEach(async function () {
      await mockAmpl.mint(deployerAddress, '1000000000000'); // 1000 AMPL
      await mockAmpl.approve(unbuttonToken.address, '1000000000000');
      expect(
        await unbuttonToken.callStatic.mintFor(
          userAAddress,
          '1000000000000000000',
        ),
      ).to.eq('1000000000000');
      r = unbuttonToken.mintFor(userAAddress, '1000000000000000000');
      await r;
    });

    it('should mint tokens to the user', async function () {
      expect(await unbuttonToken.totalSupply()).to.eq('1000000001000000000');
      expect(await unbuttonToken.balanceOf(userAAddress)).to.eq(
        '1000000000000000000',
      );
      expect(await unbuttonToken.totalUnderlying()).to.eq('1000000001000');
      expect(await unbuttonToken.balanceOfUnderlying(userAAddress)).to.eq(
        '1000000000000',
      );
    });

    it('should log transfer', async function () {
      await expect(r)
        .to.emit(mockAmpl, 'Transfer')
        .withArgs(deployerAddress, unbuttonToken.address, '1000000000000');
    });

    it('should log mint', async function () {
      await expect(r)
        .to.emit(unbuttonToken, 'Transfer')
        .withArgs(
          ethers.constants.AddressZero,
          userAAddress,
          '1000000000000000000',
        );
    });
  });
});

describe('UnbuttonToken Burn', () => {
  beforeEach('setup UnbuttonToken contract', setupContracts);

  let r: any;
  beforeEach(async function () {
    await mockAmpl.mint(deployerAddress, '3000');
    await mockAmpl.approve(unbuttonToken.address, '3000');
    await unbuttonToken.deposit('3000');
    expect(await unbuttonToken.callStatic.burn('500000000')).to.eq('500');
    r = unbuttonToken.burn('500000000');
    await r;
  });
  it('should withdraw correct amount of corresponding collateral', async function () {
    expect(await unbuttonToken.totalSupply()).to.eq('3500000000');
    expect(await unbuttonToken.balanceOf(deployerAddress)).to.eq('2500000000');
    expect(await unbuttonToken.totalUnderlying()).to.eq('3500');
    expect(await unbuttonToken.balanceOfUnderlying(deployerAddress)).to.eq(
      '2500',
    );
    expect(await mockAmpl.balanceOf(deployerAddress)).to.eq('500');
  });
  it('should log transfer', async function () {
    await expect(r)
      .to.emit(mockAmpl, 'Transfer')
      .withArgs(unbuttonToken.address, deployerAddress, '500');
  });
  it('should log mint', async function () {
    await expect(r)
      .to.emit(unbuttonToken, 'Transfer')
      .withArgs(deployerAddress, ethers.constants.AddressZero, '500000000');
  });
});

describe('UnbuttonToken BurnTo', () => {
  beforeEach('setup UnbuttonToken contract', setupContracts);

  let r: any;
  beforeEach(async function () {
    await mockAmpl.mint(deployerAddress, '3000');
    await mockAmpl.approve(unbuttonToken.address, '3000');
    await unbuttonToken.deposit('3000');
    expect(
      await unbuttonToken.callStatic.burnTo(userAAddress, '500000000'),
    ).to.eq('500');
    r = unbuttonToken.burnTo(userAAddress, '500000000');
    await r;
  });
  it('should withdraw correct amount of corresponding collateral', async function () {
    expect(await unbuttonToken.totalSupply()).to.eq('3500000000');
    expect(await unbuttonToken.balanceOf(deployerAddress)).to.eq('2500000000');
    expect(await unbuttonToken.totalUnderlying()).to.eq('3500');
    expect(await unbuttonToken.balanceOfUnderlying(deployerAddress)).to.eq(
      '2500',
    );
    expect(await mockAmpl.balanceOf(deployerAddress)).to.eq('0');
    expect(await mockAmpl.balanceOf(userAAddress)).to.eq('500');
  });
  it('should log transfer', async function () {
    await expect(r)
      .to.emit(mockAmpl, 'Transfer')
      .withArgs(unbuttonToken.address, userAAddress, '500');
  });
  it('should log mint', async function () {
    await expect(r)
      .to.emit(unbuttonToken, 'Transfer')
      .withArgs(deployerAddress, ethers.constants.AddressZero, '500000000');
  });
});

describe('UnbuttonToken BurnAll', () => {
  let r: any;
  beforeEach('setup UnbuttonToken contract', async function () {
    await setupContracts();

    await mockAmpl.mint(deployerAddress, '3000');
    await mockAmpl.approve(unbuttonToken.address, '3000');
    await unbuttonToken.deposit('3000');
    expect(await unbuttonToken.callStatic.burnAll()).to.eq('3000');
    r = unbuttonToken.burnAll();
    await r;
  });

  it('should withdraw correct amount of corresponding collateral', async function () {
    expect(await unbuttonToken.totalSupply()).to.eq('1000000000');
    expect(await unbuttonToken.balanceOf(deployerAddress)).to.eq('0');
    expect(await unbuttonToken.totalUnderlying()).to.eq('1000');
    expect(await unbuttonToken.balanceOfUnderlying(deployerAddress)).to.eq('0');
    expect(await mockAmpl.balanceOf(deployerAddress)).to.eq('3000');
  });
  it('should log transfer', async function () {
    await expect(r)
      .to.emit(mockAmpl, 'Transfer')
      .withArgs(unbuttonToken.address, deployerAddress, '3000');
  });
  it('should log mint', async function () {
    await expect(r)
      .to.emit(unbuttonToken, 'Transfer')
      .withArgs(deployerAddress, ethers.constants.AddressZero, '3000000000');
  });
});

describe('UnbuttonToken BurnAllTo', () => {
  let r: any;
  beforeEach('setup UnbuttonToken contract', async function () {
    await setupContracts();

    await mockAmpl.mint(deployerAddress, '3000');
    await mockAmpl.approve(unbuttonToken.address, '3000');
    await unbuttonToken.deposit('3000');
    expect(await unbuttonToken.callStatic.burnAllTo(userAAddress)).to.eq(
      '3000',
    );
    r = unbuttonToken.burnAllTo(userAAddress);
    await r;
  });

  it('should withdraw correct amount of corresponding collateral', async function () {
    expect(await unbuttonToken.totalSupply()).to.eq('1000000000');
    expect(await unbuttonToken.balanceOf(deployerAddress)).to.eq('0');
    expect(await unbuttonToken.totalUnderlying()).to.eq('1000');
    expect(await unbuttonToken.balanceOfUnderlying(deployerAddress)).to.eq('0');
    expect(await unbuttonToken.balanceOf(deployerAddress)).to.eq('0');
    expect(await mockAmpl.balanceOf(userAAddress)).to.eq('3000');
  });
  it('should log transfer', async function () {
    await expect(r)
      .to.emit(mockAmpl, 'Transfer')
      .withArgs(unbuttonToken.address, userAAddress, '3000');
  });
  it('should log mint', async function () {
    await expect(r)
      .to.emit(unbuttonToken, 'Transfer')
      .withArgs(deployerAddress, ethers.constants.AddressZero, '3000000000');
  });
});

describe('UnbuttonToken:Contraction', () => {
  beforeEach('setup UnbuttonToken contract', setupContracts);

  it('should see deposited erc20 balance shrink', async function () {
    await mockAmpl.mint(deployerAddress, '2000');
    await mockAmpl.approve(unbuttonToken.address, '2000');
    await unbuttonToken.deposit('2000');
    expect(await unbuttonToken.totalSupply()).to.eq('3000000000');
    expect(await unbuttonToken.balanceOf(deployerAddress)).to.eq('2000000000');
    expect(await unbuttonToken.totalUnderlying()).to.eq('3000');
    expect(await unbuttonToken.balanceOfUnderlying(deployerAddress)).to.eq(
      '2000',
    );

    await mockAmpl.rebase(startingMultiplier / 2);
    expect(await unbuttonToken.totalSupply()).to.eq('3000000000');
    expect(await unbuttonToken.balanceOf(deployerAddress)).to.eq('2000000000');
    expect(await unbuttonToken.totalUnderlying()).to.eq('1500');
    expect(await unbuttonToken.balanceOfUnderlying(deployerAddress)).to.eq(
      '1000',
    );
  });
});

describe('UnbuttonToken:Expansion', () => {
  beforeEach('setup UnbuttonToken contract', setupContracts);

  it('should see deposited erc20 balance grow', async function () {
    await mockAmpl.mint(deployerAddress, '2000');
    await mockAmpl.approve(unbuttonToken.address, '2000');
    await unbuttonToken.deposit('2000');
    expect(await unbuttonToken.totalSupply()).to.eq('3000000000');
    expect(await unbuttonToken.balanceOf(deployerAddress)).to.eq('2000000000');
    expect(await unbuttonToken.totalUnderlying()).to.eq('3000');
    expect(await unbuttonToken.balanceOfUnderlying(deployerAddress)).to.eq(
      '2000',
    );

    await mockAmpl.rebase(startingMultiplier * 3);
    expect(await unbuttonToken.totalSupply()).to.eq('3000000000');
    expect(await unbuttonToken.balanceOf(deployerAddress)).to.eq('2000000000');
    expect(await unbuttonToken.totalUnderlying()).to.eq('9000');
    expect(await unbuttonToken.balanceOfUnderlying(deployerAddress)).to.eq(
      '6000',
    );
  });
});
