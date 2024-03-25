/*
  In this script, we generate random cycles of button tokens growth and contraction
  and test the precision of button tokens transfers.

  During every iteration; inflation is sampled from a uniform distribution between [-50%,250%]
  and the button tokens total supply grows/contracts.

  In each cycle we test the following:
  - If address 'A' transfers x button tokens to address 'B'.
    A's resulting external balance will be decreased by "precisely" x button tokens,
    and B's external balance will be "precisely" increased by x button tokens.
  - If address 'A' deposits y underlying tokens tokens,
    A's resulting underlying balance will increase by "precisely" y.
  - If address 'A' withdraws y underlying tokens tokens,
    A's resulting underlying balance will decrease by "precisely" y.
*/

import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { BigNumber, BigNumberish, Contract, Signer } from 'ethers';
import { imul } from '../utils/utils';
const Stochasm = require('stochasm');

const PRICE_DECIMALS = 8;
const MAX_UNDERLYING = ethers.BigNumber.from(10).pow(27).sub(1);
const endPrice = ethers.BigNumber.from(2).pow(96).sub(1);
const priceGrowth = new Stochasm({
  min: -0.5,
  max: 2.5,
  seed: 'fragments.org',
});

let buttonToken: Contract,
  mockBTC: Contract,
  inflation: BigNumber,
  priceChange = ethers.BigNumber.from(0),
  deployer: Signer,
  user: Signer;

async function testMintBurn(cAmount: BigNumberish) {
  expect(await mockBTC.balanceOf(deployer.getAddress())).to.eq(MAX_UNDERLYING);
  expect(await buttonToken.balanceOf(deployer.getAddress())).to.eq('0');
  expect(await buttonToken.scaledBalanceOf(deployer.getAddress())).to.eq('0');
  expect(await buttonToken.totalSupply()).to.eq('0');
  expect(await buttonToken.scaledTotalSupply()).to.eq('0');

  console.log('Price', (await buttonToken.lastPrice()).toString());
  console.log('CAmount', cAmount.toString());

  // deposit underlying
  await mockBTC.connect(deployer).approve(buttonToken.address, cAmount);

  const b1 = await mockBTC.balanceOf(deployer.getAddress());
  await buttonToken.connect(deployer).deposit(cAmount);
  const b2 = await mockBTC.balanceOf(deployer.getAddress());
  const depositedCAmount = b1.sub(b2);

  // Exactly cAmount gets transferred to the button token contract
  expect(depositedCAmount).to.eq(cAmount);
  expect(await mockBTC.balanceOf(deployer.getAddress())).to.eq(
    MAX_UNDERLYING.sub(depositedCAmount),
  );
  expect(await mockBTC.balanceOf(buttonToken.address)).to.eq(depositedCAmount);

  // minter underlying balance increase exactly by depositedCAmount
  expect(await buttonToken.scaledBalanceOf(deployer.getAddress())).to.eq(
    depositedCAmount,
  );
  expect(await buttonToken.scaledTotalSupply()).to.eq(depositedCAmount);

  // withdraw underlying
  await buttonToken.connect(deployer).withdraw(cAmount);
  const b3 = await mockBTC.balanceOf(deployer.getAddress());
  const withdrawnCAmount = b3.sub(b2);

  // Exactly withdrawnCAmount gets transferred out of the button token contract
  expect(withdrawnCAmount).to.eq(depositedCAmount);
  expect(withdrawnCAmount).to.lte(cAmount);
  expect(await mockBTC.balanceOf(deployer.getAddress())).to.eq(MAX_UNDERLYING);
  expect(await mockBTC.balanceOf(buttonToken.address)).to.eq('0');

  // burner underlying balance decreases exactly by withdrawnCAmount
  expect(await buttonToken.scaledBalanceOf(deployer.getAddress())).to.eq('0');
  expect(await buttonToken.scaledTotalSupply()).to.eq('0');

  // burner balance decreases exactly by quotedAmt
  expect(await buttonToken.balanceOf(deployer.getAddress())).to.eq('0');
  expect(await buttonToken.totalSupply()).to.eq('0');

  // burn bits if they are left over
  try {
    await buttonToken.connect(deployer).withdrawAll();
  } catch (e) {}
}

async function testTransfer(from: Signer, to: Signer, tAmt: BigNumberish) {
  const _fromT = await buttonToken.balanceOf(from.getAddress());
  const _toT = await buttonToken.balanceOf(to.getAddress());

  const _ts = await buttonToken.totalSupply();
  const _sTs = await buttonToken.scaledTotalSupply();

  await buttonToken.connect(from).transfer(to.getAddress(), tAmt);

  const fromT_ = await buttonToken.balanceOf(from.getAddress());
  const toT_ = await buttonToken.balanceOf(to.getAddress());

  const ts_ = await buttonToken.totalSupply();
  const sTs_ = await buttonToken.scaledTotalSupply();

  // exactly tAmt gets transferred
  expect(_fromT.sub(fromT_)).to.eq(tAmt);
  expect(toT_.sub(_toT)).to.eq(tAmt);

  // sum of balances are conserved
  expect(_fromT.add(_toT)).to.eq(fromT_.add(toT_));

  // supply does not change
  expect(_ts).to.eq(ts_);
  expect(_sTs).to.eq(sTs_);
}

async function exec() {
  const accounts = await ethers.getSigners();
  deployer = accounts[0];
  user = accounts[1];

  const erc20Factory = await ethers.getContractFactory('MockERC20');
  mockBTC = await erc20Factory
    .connect(deployer)
    .deploy('Wood Bitcoin', 'WOOD-BTC');

  const oracleFactory = await ethers.getContractFactory('MockOracle');
  const mockOracle = await oracleFactory.connect(deployer).deploy();
  await mockOracle.setData('1', true);

  const buttonTokenFactory = await ethers.getContractFactory('ButtonToken');
  buttonToken = await buttonTokenFactory.connect(deployer).deploy();

  buttonToken.initialize(mockBTC.address, 'TEST', 'TEST', mockOracle.address);

  await mockBTC
    .connect(deployer)
    .mint(await deployer.getAddress(), MAX_UNDERLYING);

  let i = 0;
  let lastPrice = await buttonToken.lastPrice();
  do {
    await mockOracle.setData(
      (await buttonToken.lastPrice()).add(priceChange),
      true,
    );
    await buttonToken.connect(deployer).rebase();
    lastPrice = await buttonToken.lastPrice();
    if (lastPrice.gte(endPrice)) {
      break;
    }
    i++;

    console.log('Rebase iteration', i);
    console.log('New price', lastPrice.toString(), 'price');

    // recalculate if bounds change
    const PRICE_BITS = BigNumber.from(
      '11579208923731619542357098500868790785326998466564000000000',
    );
    const BITS_PER_UNDERLYING = BigNumber.from(
      '115792089237316195423570985008687907853269984665640',
    );
    const minCollateral = PRICE_BITS.div(BITS_PER_UNDERLYING.mul(lastPrice))
      .mul(2)
      .add(1);
    console.log(
      `Testing precision of ${minCollateral.toString()} deposit and withdraw`,
    );
    await testMintBurn(minCollateral);

    console.log(
      `Testing precision of ${MAX_UNDERLYING.div(
        23,
      ).toString()} deposit and withdraw`,
    );
    await testMintBurn(MAX_UNDERLYING.div(23));

    console.log(
      `Testing precision of ${MAX_UNDERLYING.toString()} deposit and withdraw`,
    );
    await testMintBurn(MAX_UNDERLYING);

    await mockBTC
      .connect(deployer)
      .approve(buttonToken.address, MAX_UNDERLYING);
    const mintAmount = await buttonToken
      .connect(deployer)
      .callStatic.deposit(MAX_UNDERLYING);
    await buttonToken.connect(deployer).deposit(MAX_UNDERLYING);

    console.log('Testing precision of 1 unit transfer');
    await testTransfer(deployer, user, '1');
    await testTransfer(user, deployer, '1');

    console.log(
      `Testing precision of ${mintAmount.div(23).toString()} transfer`,
    );
    await testTransfer(deployer, user, mintAmount.div(23));
    await testTransfer(user, deployer, mintAmount.div(23));

    console.log('Testing precision of max transfer');
    await testTransfer(deployer, user, mintAmount);
    await testTransfer(user, deployer, mintAmount);

    try {
      await buttonToken.connect(user).withdrawAll();
    } catch (e) {}
    await buttonToken.connect(deployer).withdrawAll();

    inflation = priceGrowth.next().toFixed(5);
    priceChange = imul(lastPrice, inflation, 1);
  } while (lastPrice.add(priceChange).lt(endPrice));
}

describe('Precision tests', function () {
  it('should successfully run simulation', async function () {
    await exec();
  });
});
