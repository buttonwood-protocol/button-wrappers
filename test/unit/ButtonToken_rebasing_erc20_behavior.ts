import { ethers, upgrades, waffle } from 'hardhat';
import { Contract, Signer, BigNumber } from 'ethers';
import { TransactionResponse } from '@ethersproject/providers';
import { expect } from 'chai';

const ORACLE_DECIMALS = 8;
const DECIMALS = 18;
const NAME = 'Button Bitcoin';
const SYMBOL = 'BTN-BTC';

const toOracleValue = (v: string): BigNumber =>
  ethers.utils.parseUnits(v, ORACLE_DECIMALS);

const toFixedPtAmt = (a: string): BigNumber =>
  ethers.utils.parseUnits(a, DECIMALS);

const INITIAL_SUPPLY = ethers.utils.parseUnits('50', DECIMALS);
const unitTokenAmount = toFixedPtAmt('1');

let token: Contract, owner: Signer, anotherAccount: Signer, recipient: Signer;

async function setupToken() {
  const [owner, recipient, anotherAccount] = await ethers.getSigners();

  const erc20Factory = await ethers.getContractFactory('MockERC20');
  const mockBTC = await erc20Factory
    .connect(owner)
    .deploy('Wood Bitcoin', 'WOOD-BTC');

  const oracleFactory = await ethers.getContractFactory('MockOracle');
  const mockOracle = await oracleFactory.connect(owner).deploy();
  await mockOracle.setData(toOracleValue('1'), true);

  const buttonTokenFactory = await ethers.getContractFactory('ButtonToken');
  token = await buttonTokenFactory.connect(owner).deploy();

  await token.initialize(mockBTC.address, NAME, SYMBOL, mockOracle.address);

  await mockBTC.connect(owner).mint(await owner.getAddress(), INITIAL_SUPPLY);

  await mockBTC.connect(owner).approve(token.address, INITIAL_SUPPLY);
  await token.connect(owner).deposit(INITIAL_SUPPLY);

  return { token, owner, recipient, anotherAccount };
}

describe('Button:Elastic', () => {
  beforeEach('setup Button contract', async function () {
    ({ token, owner, recipient, anotherAccount } = await waffle.loadFixture(
      setupToken,
    ));
  });

  describe('scaledTotalSupply', function () {
    it('returns the scaled total amount of tokens', async function () {
      expect(await token.scaledTotalSupply()).to.eq(INITIAL_SUPPLY);
    });
  });

  describe('scaledBalanceOf', function () {
    describe('when the requested for zero account', function () {
      it('returns zero', async function () {
        expect(await token.scaledBalanceOf(ethers.constants.AddressZero)).to.eq(
          0,
        );
      });
    });

    describe('when the requested account has no tokens', function () {
      it('returns zero', async function () {
        expect(
          await token.scaledBalanceOf(await anotherAccount.getAddress()),
        ).to.eq(0);
      });
    });

    describe('when the requested account has some tokens', function () {
      it('returns the total amount of tokens', async function () {
        expect(await token.scaledBalanceOf(await owner.getAddress())).to.eq(
          INITIAL_SUPPLY,
        );
      });
    });
  });
});

describe('Button:Elastic:transferAll', () => {
  beforeEach('setup Button contract', async function () {
    ({ token, owner, recipient, anotherAccount } = await waffle.loadFixture(
      setupToken,
    ));
  });

  describe('when the recipient is the zero address', function () {
    it('should revert', async function () {
      await expect(
        token.connect(owner).transferAll(ethers.constants.AddressZero),
      ).to.be.reverted;
    });
  });

  describe('when the recipient is the contract address', function () {
    it('should revert', async function () {
      await expect(token.connect(owner).transferAll(token.address)).to.be
        .reverted;
    });
  });

  describe('when the sender has zero balance', function () {
    it('should not revert', async function () {
      await expect(
        token.connect(anotherAccount).transferAll(await owner.getAddress()),
      ).not.to.be.reverted;
    });
  });

  describe('when the sender has balance', function () {
    it('should emit a transfer event', async function () {
      await expect(
        token.connect(owner).transferAll(await recipient.getAddress()),
      )
        .to.emit(token, 'Transfer')
        .withArgs(
          await owner.getAddress(),
          await recipient.getAddress(),
          INITIAL_SUPPLY,
        );
    });

    it("should transfer all of the sender's balance", async function () {
      const senderBalance = await token.balanceOf(await owner.getAddress());
      const recipientBalance = await token.balanceOf(
        await recipient.getAddress(),
      );
      await token.connect(owner).transferAll(await recipient.getAddress());
      const senderBalance_ = await token.balanceOf(await owner.getAddress());
      const recipientBalance_ = await token.balanceOf(
        await recipient.getAddress(),
      );
      expect(senderBalance_).to.eq('0');
      expect(recipientBalance_.sub(recipientBalance)).to.eq(senderBalance);
    });
  });
});

describe('Button:Elastic:transferAllFrom', () => {
  beforeEach('setup Button contract', async function () {
    ({ token, owner, recipient, anotherAccount } = await waffle.loadFixture(
      setupToken,
    ));
  });

  describe('when the recipient is the zero address', function () {
    it('should revert', async function () {
      const senderBalance = await token.balanceOf(await owner.getAddress());
      await token
        .connect(owner)
        .approve(await anotherAccount.getAddress(), senderBalance);
      await expect(
        token
          .connect(anotherAccount)
          .transferAllFrom(
            await owner.getAddress(),
            ethers.constants.AddressZero,
          ),
      ).to.be.reverted;
    });
  });

  describe('when the recipient is the contract address', function () {
    it('should revert', async function () {
      const senderBalance = await token.balanceOf(await owner.getAddress());
      await token
        .connect(owner)
        .approve(await anotherAccount.getAddress(), senderBalance);
      await expect(
        token
          .connect(anotherAccount)
          .transferAllFrom(await owner.getAddress(), token.address),
      ).to.be.reverted;
    });
  });

  describe('when the sender has zero balance', function () {
    it('should not revert', async function () {
      const senderBalance = await token.balanceOf(
        await anotherAccount.getAddress(),
      );
      await token
        .connect(anotherAccount)
        .approve(await anotherAccount.getAddress(), senderBalance);

      await expect(
        token
          .connect(recipient)
          .transferAllFrom(
            await anotherAccount.getAddress(),
            await recipient.getAddress(),
          ),
      ).not.to.be.reverted;
    });
  });

  describe('when the spender does NOT have enough approved balance', function () {
    it('reverts', async function () {
      await token
        .connect(owner)
        .approve(await anotherAccount.getAddress(), unitTokenAmount);
      await expect(
        token
          .connect(anotherAccount)
          .transferAllFrom(
            await owner.getAddress(),
            await recipient.getAddress(),
          ),
      ).to.be.reverted;
    });
  });

  describe('when the spender has enough approved balance', function () {
    it('emits a transfer event', async function () {
      const senderBalance = await token.balanceOf(await owner.getAddress());
      await token
        .connect(owner)
        .approve(await anotherAccount.getAddress(), senderBalance);

      await expect(
        token
          .connect(anotherAccount)
          .transferAllFrom(
            await owner.getAddress(),
            await recipient.getAddress(),
          ),
      )
        .to.emit(token, 'Transfer')
        .withArgs(
          await owner.getAddress(),
          await recipient.getAddress(),
          senderBalance,
        );
    });

    it('transfers the requested amount', async function () {
      const senderBalance = await token.balanceOf(await owner.getAddress());
      const recipientBalance = await token.balanceOf(
        await recipient.getAddress(),
      );

      await token
        .connect(owner)
        .approve(await anotherAccount.getAddress(), senderBalance);

      await token
        .connect(anotherAccount)
        .transferAllFrom(
          await owner.getAddress(),
          await recipient.getAddress(),
        );

      const senderBalance_ = await token.balanceOf(await owner.getAddress());
      const recipientBalance_ = await token.balanceOf(
        await recipient.getAddress(),
      );
      expect(senderBalance_).to.eq('0');
      expect(recipientBalance_.sub(recipientBalance)).to.eq(senderBalance);
    });

    it('decreases the spender allowance', async function () {
      const senderBalance = await token.balanceOf(await owner.getAddress());
      await token
        .connect(owner)
        .approve(await anotherAccount.getAddress(), senderBalance.add('99'));
      await expect(
        token
          .connect(anotherAccount)
          .transferAllFrom(
            await owner.getAddress(),
            await recipient.getAddress(),
          ),
      )
        .to.emit(token, 'Approval')
        .withArgs(
          await owner.getAddress(),
          await anotherAccount.getAddress(),
          '99',
        );
      expect(
        await token.allowance(
          await owner.getAddress(),
          await anotherAccount.getAddress(),
        ),
      ).to.eq('99');
    });
  });

  describe('when the spender has enough approved infinite balance', function () {
    it('emits a transfer event', async function () {
      const senderBalance = await token.balanceOf(await owner.getAddress());
      await token
        .connect(owner)
        .approve(
          await anotherAccount.getAddress(),
          ethers.constants.MaxUint256,
        );

      await expect(
        token
          .connect(anotherAccount)
          .transferAllFrom(
            await owner.getAddress(),
            await recipient.getAddress(),
          ),
      )
        .to.emit(token, 'Transfer')
        .withArgs(
          await owner.getAddress(),
          await recipient.getAddress(),
          senderBalance,
        );
    });

    it('transfers the requested amount', async function () {
      const senderBalance = await token.balanceOf(await owner.getAddress());
      const recipientBalance = await token.balanceOf(
        await recipient.getAddress(),
      );

      await token
        .connect(owner)
        .approve(
          await anotherAccount.getAddress(),
          ethers.constants.MaxUint256,
        );

      await token
        .connect(anotherAccount)
        .transferAllFrom(
          await owner.getAddress(),
          await recipient.getAddress(),
        );

      const senderBalance_ = await token.balanceOf(await owner.getAddress());
      const recipientBalance_ = await token.balanceOf(
        await recipient.getAddress(),
      );
      expect(senderBalance_).to.eq('0');
      expect(recipientBalance_.sub(recipientBalance)).to.eq(senderBalance);
    });

    it('does NOT decrease the spender allowance', async function () {
      const senderBalance = await token.balanceOf(await owner.getAddress());
      await token
        .connect(owner)
        .approve(
          await anotherAccount.getAddress(),
          ethers.constants.MaxUint256,
        );
      await expect(
        token
          .connect(anotherAccount)
          .transferAllFrom(
            await owner.getAddress(),
            await recipient.getAddress(),
          ),
      ).not.to.emit(token, 'Approval');
      expect(
        await token.allowance(
          await owner.getAddress(),
          await anotherAccount.getAddress(),
        ),
      ).to.eq(ethers.constants.MaxUint256);
    });
  });
});
