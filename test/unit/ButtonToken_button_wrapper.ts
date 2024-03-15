import { ethers, upgrades } from 'hardhat';
import { Contract, Signer, BigNumber } from 'ethers';
import { expect } from 'chai';

const PRICE_DECIMALS = 8;
const DECIMALS = 18;
const NAME = 'Button Bitcoin';
const SYMBOL = 'BTN-BTC';

const toOracleValue = (v: string): BigNumber =>
  ethers.utils.parseUnits(v, PRICE_DECIMALS);

const toFixedPtAmt = (a: string): BigNumber =>
  ethers.utils.parseUnits(a, DECIMALS);

let accounts: Signer[],
  deployer: Signer,
  deployerAddress: string,
  userA: Signer,
  userAAddress: string,
  mockBTC: Contract,
  mockOracle: Contract,
  buttonToken: Contract,
  cAmount: BigNumber,
  withdrawCAmount: BigNumber;

async function setupContracts() {
  accounts = await ethers.getSigners();
  deployer = accounts[0];
  userA = accounts[1];

  deployerAddress = await deployer.getAddress();
  userAAddress = await userA.getAddress();

  const erc20Factory = await ethers.getContractFactory('MockERC20');
  mockBTC = await erc20Factory
    .connect(deployer)
    .deploy('Wood Bitcoin', 'WOOD-BTC');

  const oracleFactory = await ethers.getContractFactory('MockOracle');
  mockOracle = await oracleFactory.connect(deployer).deploy();
  await mockOracle.setData(toOracleValue('10000'), true);

  const buttonTokenFactory = await ethers.getContractFactory('ButtonToken');
  buttonToken = await buttonTokenFactory.connect(deployer).deploy();

  buttonToken.initialize(mockBTC.address, NAME, SYMBOL, mockOracle.address);
}

describe('ButtonToken:underlying', async () => {
  it('should set the correct value', async function () {
    await setupContracts();
    expect(await buttonToken.underlying()).to.eq(mockBTC.address);
  });
});

describe('ButtonToken:deposit', async () => {
  describe('without sufficient approval', async function () {
    it('should revert', async function () {
      await setupContracts();

      await mockBTC.connect(deployer).mint(userAAddress, toFixedPtAmt('1'));

      await mockBTC
        .connect(userA)
        .approve(buttonToken.address, toFixedPtAmt('0.99'));

      await expect(buttonToken.connect(userA).deposit(toFixedPtAmt('1'))).to.be
        .reverted;
    });
  });

  describe('without sufficient balance', async function () {
    it('should revert', async function () {
      await setupContracts();

      await mockBTC.connect(deployer).mint(userAAddress, toFixedPtAmt('2'));

      await mockBTC
        .connect(userA)
        .approve(buttonToken.address, toFixedPtAmt('1'));

      await expect(buttonToken.connect(userA).deposit(toFixedPtAmt('2'))).to.be
        .reverted;
    });
  });

  describe('When deposit amount is > MAX_UNDERLYING', async function () {
    it('should not be reverted', async function () {
      await setupContracts();

      cAmount = (await buttonToken.MAX_UNDERLYING()).add(1);

      const mintAmt = cAmount
        .mul(await buttonToken.lastPrice())
        .div(BigNumber.from(10).pow(PRICE_DECIMALS));

      await mockBTC.connect(deployer).mint(userAAddress, cAmount);

      await mockBTC.connect(userA).approve(buttonToken.address, cAmount);

      await expect(buttonToken.connect(userA).deposit(mintAmt)).to.be.reverted;
    });
  });

  describe('When deposit amount < MAX_UNDERLYING', async function () {
    it('should not be reverted', async function () {
      await setupContracts();

      const MAX_UNDERLYING = await buttonToken.MAX_UNDERLYING();
      const cAmount = MAX_UNDERLYING.sub(1);

      await mockBTC.connect(deployer).mint(userAAddress, cAmount);

      await mockBTC.connect(userA).approve(buttonToken.address, cAmount);

      await expect(buttonToken.connect(userA).deposit(cAmount)).not.to.be
        .reverted;
    });
  });

  describe('When deposit amount zero', async function () {
    it('should be reverted', async function () {
      await setupContracts();

      cAmount = BigNumber.from('1');

      await mockBTC.connect(deployer).mint(userAAddress, cAmount);
      await mockBTC.connect(userA).approve(buttonToken.address, cAmount);

      await expect(buttonToken.connect(userA).deposit('0')).to.be.reverted;
    });
  });

  describe('When deposit < unit amount', async function () {
    it('should be reverted', async function () {
      await setupContracts();

      cAmount = BigNumber.from('1');
      await mockOracle.setData('123', true);

      await mockBTC.connect(deployer).mint(userAAddress, cAmount);
      await mockBTC.connect(userA).approve(buttonToken.address, cAmount);

      await expect(buttonToken.connect(userA).deposit(cAmount)).to.be.reverted;
    });
  });

  describe('When deposit amount unit amount', async function () {
    beforeEach('setup ButtonToken contract', async () => {
      await setupContracts();

      cAmount = BigNumber.from('1');

      await mockBTC.connect(deployer).mint(userAAddress, cAmount);
      await mockBTC.connect(userA).approve(buttonToken.address, cAmount);
    });

    it('should transfer underlying from the user', async function () {
      expect(await mockBTC.balanceOf(userAAddress)).to.eq(cAmount);
      expect(await mockBTC.balanceOf(buttonToken.address)).to.eq('0');

      expect(await buttonToken.balanceOfUnderlying(userAAddress)).to.eq('0');
      expect(await buttonToken.totalUnderlying()).to.eq('0');

      await expect(buttonToken.connect(userA).deposit(cAmount))
        .to.emit(mockBTC, 'Transfer')
        .withArgs(userAAddress, buttonToken.address, cAmount);

      expect(await mockBTC.balanceOf(userAAddress)).to.eq('0');
      expect(await mockBTC.balanceOf(buttonToken.address)).to.eq(cAmount);

      expect(await buttonToken.balanceOfUnderlying(userAAddress)).to.eq(
        cAmount,
      );
      expect(await buttonToken.totalUnderlying()).to.eq(cAmount);
    });

    it('should deposit button tokens', async function () {
      expect(await buttonToken.balanceOf(userAAddress)).to.eq('0');

      expect(
        await buttonToken.connect(userA).callStatic.deposit(cAmount),
      ).to.eq('10000');
      await buttonToken.connect(userA).deposit(cAmount);

      expect(await buttonToken.balanceOf(userAAddress)).to.eq('10000');
    });

    it('should emit transfer log', async function () {
      await expect(buttonToken.connect(userA).deposit(cAmount))
        .to.emit(buttonToken, 'Transfer')
        .withArgs(ethers.constants.AddressZero, userAAddress, '10000');
    });
  });

  describe('with sufficient approval', async function () {
    beforeEach('setup ButtonToken contract', async () => {
      await setupContracts();

      cAmount = toFixedPtAmt('1');
      await mockBTC.connect(deployer).mint(userAAddress, cAmount);

      await mockBTC.connect(userA).approve(buttonToken.address, cAmount);
    });

    it('should transfer underlying from the user', async function () {
      expect(await mockBTC.balanceOf(userAAddress)).to.eq(cAmount);
      expect(await mockBTC.balanceOf(buttonToken.address)).to.eq('0');

      expect(await buttonToken.balanceOfUnderlying(userAAddress)).to.eq('0');
      expect(await buttonToken.totalUnderlying()).to.eq('0');

      await expect(buttonToken.connect(userA).deposit(cAmount))
        .to.emit(mockBTC, 'Transfer')
        .withArgs(userAAddress, buttonToken.address, cAmount);

      expect(await mockBTC.balanceOf(userAAddress)).to.eq('0');
      expect(await mockBTC.balanceOf(buttonToken.address)).to.eq(cAmount);

      expect(await buttonToken.balanceOfUnderlying(userAAddress)).to.eq(
        cAmount,
      );
      expect(await buttonToken.totalUnderlying()).to.eq(cAmount);
    });

    it('should deposit button tokens', async function () {
      expect(await buttonToken.balanceOf(userAAddress)).to.eq('0');

      expect(
        await buttonToken.connect(userA).callStatic.deposit(cAmount),
      ).to.eq(toFixedPtAmt('10000'));

      await buttonToken.connect(userA).deposit(cAmount);

      expect(await buttonToken.balanceOf(userAAddress)).to.eq(
        toFixedPtAmt('10000'),
      );
    });

    it('should emit transfer log', async function () {
      await expect(buttonToken.connect(userA).deposit(cAmount))
        .to.emit(buttonToken, 'Transfer')
        .withArgs(
          ethers.constants.AddressZero,
          userAAddress,
          toFixedPtAmt('10000'),
        );
    });
  });
});

describe('ButtonToken:withdraw', async () => {
  describe('When withdraw amount zero', async function () {
    it('should be reverted', async function () {
      await setupContracts();

      cAmount = toFixedPtAmt('1');
      withdrawCAmount = BigNumber.from('0');

      await mockBTC.connect(deployer).mint(userAAddress, cAmount);
      await mockBTC.connect(userA).approve(buttonToken.address, cAmount);
      await buttonToken.connect(userA).deposit(cAmount);

      await expect(buttonToken.connect(userA).withdraw(withdrawCAmount)).to.be
        .reverted;
    });
  });

  describe('When withdraw amount < unit amount', async function () {
    it('should be reverted', async function () {
      await setupContracts();

      cAmount = toFixedPtAmt('2');
      withdrawCAmount = BigNumber.from('1');

      await mockBTC.connect(deployer).mint(userAAddress, cAmount);
      await mockBTC.connect(userA).approve(buttonToken.address, cAmount);
      await buttonToken.connect(userA).deposit(cAmount);

      await mockOracle.setData('123', true);
      await expect(buttonToken.connect(userA).withdraw(withdrawCAmount)).to.be
        .reverted;
    });
  });

  describe('When withdraw amount is unit amount', async function () {
    it('should not be reverted', async function () {
      await setupContracts();

      cAmount = BigNumber.from('2');
      withdrawCAmount = BigNumber.from('1');

      await mockBTC.connect(deployer).mint(userAAddress, cAmount);
      await mockBTC.connect(userA).approve(buttonToken.address, cAmount);
      await buttonToken.connect(userA).deposit(cAmount);

      await expect(buttonToken.connect(userA).withdraw(withdrawCAmount)).not.to
        .be.reverted;
    });
  });

  describe('When withdraw amount > balance', async function () {
    it('should be reverted', async function () {
      await setupContracts();

      cAmount = toFixedPtAmt('1');

      await mockBTC.connect(deployer).mint(userAAddress, cAmount);
      await mockBTC.connect(userA).approve(buttonToken.address, cAmount);
      await buttonToken.connect(userA).deposit(cAmount);

      await expect(buttonToken.connect(userA).deposit(cAmount.add(1))).to.be
        .reverted;
    });
  });

  describe('When withdraw amount equal to the balance', async function () {
    beforeEach(async function () {
      await setupContracts();

      cAmount = toFixedPtAmt('1');

      await mockBTC.connect(deployer).mint(userAAddress, cAmount);
      await mockBTC.connect(userA).approve(buttonToken.address, cAmount);

      await buttonToken.connect(userA).callStatic.deposit(cAmount);
      await buttonToken.connect(userA).deposit(cAmount);
    });

    it('should transfer underlying to the user', async function () {
      expect(await mockBTC.balanceOf(userAAddress)).to.eq('0');
      expect(await mockBTC.balanceOf(buttonToken.address)).to.eq(cAmount);

      expect(await buttonToken.balanceOfUnderlying(userAAddress)).to.eq(
        cAmount,
      );
      expect(await buttonToken.totalUnderlying()).to.eq(cAmount);

      await expect(buttonToken.connect(userA).withdraw(cAmount))
        .to.emit(mockBTC, 'Transfer')
        .withArgs(buttonToken.address, userAAddress, cAmount);

      expect(await mockBTC.balanceOf(userAAddress)).to.eq(cAmount);
      expect(await mockBTC.balanceOf(buttonToken.address)).to.eq('0');

      expect(await buttonToken.balanceOfUnderlying(userAAddress)).to.eq('0');
      expect(await buttonToken.totalUnderlying()).to.eq('0');
    });

    it('should deposit button tokens', async function () {
      expect(await buttonToken.balanceOf(userAAddress)).to.eq(
        toFixedPtAmt('10000'),
      );

      expect(
        await buttonToken.connect(userA).callStatic.withdraw(cAmount),
      ).to.eq(toFixedPtAmt('10000'));

      await buttonToken.connect(userA).withdraw(cAmount);

      expect(await buttonToken.balanceOf(userAAddress)).to.eq('0');
    });

    it('should emit transfer log', async function () {
      await expect(buttonToken.connect(userA).withdraw(cAmount))
        .to.emit(buttonToken, 'Transfer')
        .withArgs(
          userAAddress,
          ethers.constants.AddressZero,
          toFixedPtAmt('10000'),
        );
    });
  });

  describe('When withdraw amount less than the balance', async function () {
    beforeEach(async function () {
      await setupContracts();

      cAmount = toFixedPtAmt('2');
      withdrawCAmount = toFixedPtAmt('1');

      await mockBTC.connect(deployer).mint(userAAddress, cAmount);
      await mockBTC.connect(userA).approve(buttonToken.address, cAmount);

      await buttonToken.connect(userA).deposit(cAmount);
    });

    it('should transfer underlying to the user', async function () {
      expect(await mockBTC.balanceOf(userAAddress)).to.eq('0');
      expect(await mockBTC.balanceOf(buttonToken.address)).to.eq(cAmount);

      expect(await buttonToken.balanceOfUnderlying(userAAddress)).to.eq(
        cAmount,
      );
      expect(await buttonToken.totalUnderlying()).to.eq(cAmount);

      await expect(buttonToken.connect(userA).withdraw(withdrawCAmount))
        .to.emit(mockBTC, 'Transfer')
        .withArgs(buttonToken.address, userAAddress, withdrawCAmount);

      expect(await mockBTC.balanceOf(userAAddress)).to.eq(toFixedPtAmt('1'));
      expect(await mockBTC.balanceOf(buttonToken.address)).to.eq(
        toFixedPtAmt('1'),
      );

      expect(await buttonToken.balanceOfUnderlying(userAAddress)).to.eq(
        cAmount.sub(withdrawCAmount),
      );
      expect(await buttonToken.totalUnderlying()).to.eq(
        cAmount.sub(withdrawCAmount),
      );
    });

    it('should deposit button tokens', async function () {
      expect(await buttonToken.balanceOf(userAAddress)).to.eq(
        toFixedPtAmt('20000'),
      );

      expect(
        await buttonToken.connect(userA).callStatic.withdraw(withdrawCAmount),
      ).to.eq(toFixedPtAmt('10000'));
      await buttonToken.connect(userA).withdraw(withdrawCAmount);

      expect(await buttonToken.balanceOf(userAAddress)).to.eq(
        toFixedPtAmt('10000'),
      );
    });

    it('should emit transfer log', async function () {
      await expect(buttonToken.connect(userA).withdraw(withdrawCAmount))
        .to.emit(buttonToken, 'Transfer')
        .withArgs(
          userAAddress,
          ethers.constants.AddressZero,
          toFixedPtAmt('10000'),
        );
    });
  });
});

describe('ButtonToken:withdrawAll', async () => {
  beforeEach(async function () {
    await setupContracts();

    cAmount = toFixedPtAmt('1');

    await mockBTC.connect(deployer).mint(userAAddress, cAmount);
    await mockBTC.connect(userA).approve(buttonToken.address, cAmount);

    await buttonToken.connect(userA).deposit(cAmount);
  });

  it('should transfer underlying to the user', async function () {
    expect(await mockBTC.balanceOf(userAAddress)).to.eq('0');
    expect(await mockBTC.balanceOf(buttonToken.address)).to.eq(cAmount);

    expect(await buttonToken.balanceOfUnderlying(userAAddress)).to.eq(cAmount);
    expect(await buttonToken.totalUnderlying()).to.eq(cAmount);

    await expect(buttonToken.connect(userA).withdrawAll())
      .to.emit(mockBTC, 'Transfer')
      .withArgs(buttonToken.address, userAAddress, cAmount);

    expect(await mockBTC.balanceOf(userAAddress)).to.eq(cAmount);
    expect(await mockBTC.balanceOf(buttonToken.address)).to.eq('0');

    expect(await buttonToken.balanceOfUnderlying(userAAddress)).to.eq('0');
    expect(await buttonToken.totalUnderlying()).to.eq('0');
  });

  it('should deposit button tokens', async function () {
    expect(await buttonToken.balanceOf(userAAddress)).to.eq(
      toFixedPtAmt('10000'),
    );

    expect(await buttonToken.connect(userA).callStatic.withdrawAll()).to.eq(
      toFixedPtAmt('10000'),
    );
    await buttonToken.connect(userA).withdrawAll();

    expect(await buttonToken.balanceOf(userAAddress)).to.eq('0');
  });

  it('should emit transfer log', async function () {
    await expect(buttonToken.connect(userA).withdrawAll())
      .to.emit(buttonToken, 'Transfer')
      .withArgs(
        userAAddress,
        ethers.constants.AddressZero,
        toFixedPtAmt('10000'),
      );
  });
});

describe('ButtonToken:depositFor', async function () {
  beforeEach('setup ButtonToken contract', async () => {
    await setupContracts();

    cAmount = toFixedPtAmt('1');
    await mockBTC.connect(deployer).mint(userAAddress, cAmount);

    await mockBTC.connect(userA).approve(buttonToken.address, cAmount);
  });

  it('should transfer underlying from the user', async function () {
    expect(await mockBTC.balanceOf(userAAddress)).to.eq(cAmount);
    expect(await mockBTC.balanceOf(buttonToken.address)).to.eq('0');

    expect(await buttonToken.balanceOfUnderlying(userAAddress)).to.eq('0');
    expect(await buttonToken.totalUnderlying()).to.eq('0');

    await expect(
      buttonToken.connect(userA).depositFor(deployerAddress, cAmount),
    )
      .to.emit(mockBTC, 'Transfer')
      .withArgs(userAAddress, buttonToken.address, cAmount);

    expect(await mockBTC.balanceOf(userAAddress)).to.eq('0');
    expect(await mockBTC.balanceOf(buttonToken.address)).to.eq(cAmount);

    expect(await buttonToken.balanceOfUnderlying(userAAddress)).to.eq('0');
    expect(await buttonToken.balanceOfUnderlying(deployerAddress)).to.eq(
      cAmount,
    );
    expect(await buttonToken.totalUnderlying()).to.eq(cAmount);
  });

  it('should deposit button tokens', async function () {
    expect(await buttonToken.balanceOf(userAAddress)).to.eq('0');

    expect(
      await buttonToken
        .connect(userA)
        .callStatic.depositFor(deployerAddress, cAmount),
    ).to.eq(toFixedPtAmt('10000'));

    await buttonToken.connect(userA).depositFor(deployerAddress, cAmount);

    expect(await buttonToken.balanceOf(userAAddress)).to.eq('0');
    expect(await buttonToken.balanceOf(deployerAddress)).to.eq(
      toFixedPtAmt('10000'),
    );
  });

  it('should emit transfer log', async function () {
    await expect(
      buttonToken.connect(userA).depositFor(deployerAddress, cAmount),
    )
      .to.emit(buttonToken, 'Transfer')
      .withArgs(
        ethers.constants.AddressZero,
        deployerAddress,
        toFixedPtAmt('10000'),
      );
  });
});

describe('ButtonToken:withdrawTo', async function () {
  beforeEach(async function () {
    await setupContracts();

    cAmount = toFixedPtAmt('2');
    withdrawCAmount = toFixedPtAmt('1');

    await mockBTC.connect(deployer).mint(userAAddress, cAmount);
    await mockBTC.connect(userA).approve(buttonToken.address, cAmount);

    await buttonToken.connect(userA).deposit(cAmount);
  });

  it('should transfer underlying to the user', async function () {
    expect(await mockBTC.balanceOf(userAAddress)).to.eq('0');
    expect(await mockBTC.balanceOf(buttonToken.address)).to.eq(cAmount);

    expect(await buttonToken.balanceOfUnderlying(userAAddress)).to.eq(cAmount);
    expect(await buttonToken.totalUnderlying()).to.eq(cAmount);

    await expect(
      buttonToken.connect(userA).withdrawTo(deployerAddress, withdrawCAmount),
    )
      .to.emit(mockBTC, 'Transfer')
      .withArgs(buttonToken.address, deployerAddress, withdrawCAmount);

    expect(await mockBTC.balanceOf(userAAddress)).to.eq(toFixedPtAmt('0'));
    expect(await mockBTC.balanceOf(deployerAddress)).to.eq(toFixedPtAmt('1'));
    expect(await mockBTC.balanceOf(buttonToken.address)).to.eq(
      toFixedPtAmt('1'),
    );

    expect(await buttonToken.balanceOfUnderlying(userAAddress)).to.eq(
      cAmount.sub(withdrawCAmount),
    );
    expect(await buttonToken.totalUnderlying()).to.eq(
      cAmount.sub(withdrawCAmount),
    );
  });

  it('should deposit button tokens', async function () {
    expect(await buttonToken.balanceOf(userAAddress)).to.eq(
      toFixedPtAmt('20000'),
    );

    expect(
      await buttonToken
        .connect(userA)
        .callStatic.withdrawTo(deployerAddress, withdrawCAmount),
    ).to.eq(toFixedPtAmt('10000'));
    await buttonToken
      .connect(userA)
      .withdrawTo(deployerAddress, withdrawCAmount);

    expect(await buttonToken.balanceOf(userAAddress)).to.eq(
      toFixedPtAmt('10000'),
    );
  });

  it('should emit transfer log', async function () {
    await expect(
      buttonToken.connect(userA).withdrawTo(deployerAddress, withdrawCAmount),
    )
      .to.emit(buttonToken, 'Transfer')
      .withArgs(
        userAAddress,
        ethers.constants.AddressZero,
        toFixedPtAmt('10000'),
      );
  });
});

describe('ButtonToken:withdrawAllTo', async function () {
  beforeEach(async function () {
    await setupContracts();

    cAmount = toFixedPtAmt('2');

    await mockBTC.connect(deployer).mint(userAAddress, cAmount);
    await mockBTC.connect(userA).approve(buttonToken.address, cAmount);

    await buttonToken.connect(userA).deposit(cAmount);
  });

  it('should transfer underlying to the user', async function () {
    expect(await mockBTC.balanceOf(userAAddress)).to.eq('0');
    expect(await mockBTC.balanceOf(buttonToken.address)).to.eq(cAmount);

    expect(await buttonToken.balanceOfUnderlying(userAAddress)).to.eq(cAmount);
    expect(await buttonToken.totalUnderlying()).to.eq(cAmount);

    await expect(buttonToken.connect(userA).withdrawAllTo(deployerAddress))
      .to.emit(mockBTC, 'Transfer')
      .withArgs(buttonToken.address, deployerAddress, cAmount);

    expect(await mockBTC.balanceOf(userAAddress)).to.eq(toFixedPtAmt('0'));
    expect(await mockBTC.balanceOf(deployerAddress)).to.eq(toFixedPtAmt('2'));
    expect(await mockBTC.balanceOf(buttonToken.address)).to.eq('0');

    expect(await buttonToken.balanceOfUnderlying(userAAddress)).to.eq('0');
    expect(await buttonToken.totalUnderlying()).to.eq('0');
  });

  it('should deposit button tokens', async function () {
    expect(await buttonToken.balanceOf(userAAddress)).to.eq(
      toFixedPtAmt('20000'),
    );

    expect(
      await buttonToken
        .connect(userA)
        .callStatic.withdrawAllTo(deployerAddress),
    ).to.eq(toFixedPtAmt('20000'));
    await buttonToken.connect(userA).withdrawAllTo(deployerAddress);

    expect(await buttonToken.balanceOf(userAAddress)).to.eq('0');
  });

  it('should emit transfer log', async function () {
    await expect(buttonToken.connect(userA).withdrawAllTo(deployerAddress))
      .to.emit(buttonToken, 'Transfer')
      .withArgs(
        userAAddress,
        ethers.constants.AddressZero,
        toFixedPtAmt('20000'),
      );
  });
});

describe('ButtonToken:mint', async () => {
  it('should not be able to mint tiny amounts with 0 uAmount', async function () {
    await setupContracts();

    await expect(
      buttonToken.connect(userA).mint(toFixedPtAmt('0.000000000000000001')),
    ).to.be.reverted;
  });
});
