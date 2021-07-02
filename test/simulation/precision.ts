/*
  In this script, we generate random cycles of button tokens growth and contraction
  and test the precision of button tokens transfers.

  During every iteration; inflation is sampled from a uniform distribution between [-50%,250%]
  and the button tokens total supply grows/contracts.

  In each cycle we test the following guarantees:
  - If the current quoted `exchangeRate` between button tokens to collateral is x:y,
    * user should be able to deposit "at the most" y collateral tokens and
      mint "precisely" x button tokens.
    * user should be able to withdraw "at the most" y collateral tokens and
      burn "precisely" x button tokens.
  - If address 'A' transfers x button tokens to address 'B'.
    A's resulting external balance will be decreased by precisely x button tokens,
    and B's external balance will be precisely increased by x button tokens.
*/

import { ethers, upgrades } from 'hardhat'
import { expect } from 'chai'
import { BigNumber, BigNumberish, Contract, Signer } from 'ethers'
import { imul } from '../utils/utils'
const Stochasm = require('stochasm')

const PRICE_DECIMALS = 8
const MAX_COLLATERAL = ethers.BigNumber.from(10).pow(27).sub(1)
const endPrice = ethers.BigNumber.from(2).pow(96).sub(1)
const priceGrowth = new Stochasm({
  min: -0.5,
  max: 2.5,
  seed: 'fragments.org',
})

let buttonToken: Contract,
  mockBTC: Contract,
  inflation: BigNumber,
  priceChange = ethers.BigNumber.from(0),
  deployer: Signer,
  user: Signer

async function testMintBurn(cAmount: BigNumberish) {
  expect(await mockBTC.balanceOf(deployer.getAddress())).to.eq(MAX_COLLATERAL)
  expect(await buttonToken.balanceOf(deployer.getAddress())).to.eq('0')
  expect(await buttonToken.scaledBalanceOf(deployer.getAddress())).to.eq('0')
  expect(await buttonToken.totalSupply()).to.eq('0')
  expect(await buttonToken.scaledTotalSupply()).to.eq('0')

  const quotedAmt = await buttonToken.exchangeRate(cAmount)
  if (quotedAmt.lte('0')) {
    return
  }

  console.log('Price', (await buttonToken.currentPrice()).toString())
  console.log('Queried CAmount', cAmount.toString())
  console.log('Quoted amount', quotedAmt.toString())

  // mint collateral
  await mockBTC.connect(deployer).approve(buttonToken.address, cAmount)
  const depositedCAmount = await buttonToken
    .connect(deployer)
    .callStatic.mint(quotedAmt)
  await buttonToken.connect(deployer).mint(quotedAmt)

  console.log('Used CAmount', depositedCAmount.toString())
  console.log('CAmount diff', depositedCAmount.sub(cAmount).abs().toString())

  // Exactly depositedCAmount gets transferred to the button token contract
  expect(depositedCAmount).to.lte(cAmount)
  expect(await mockBTC.balanceOf(deployer.getAddress())).to.eq(
    MAX_COLLATERAL.sub(depositedCAmount),
  )
  expect(await mockBTC.balanceOf(buttonToken.address)).to.eq(depositedCAmount)

  // minter collateral balance increase exactly by depositedCAmount
  expect(await buttonToken.scaledBalanceOf(deployer.getAddress())).to.eq(
    depositedCAmount,
  )
  expect(await buttonToken.scaledTotalSupply()).to.eq(depositedCAmount)

  // minter balance increase exactly by quotedAmt
  expect(await buttonToken.balanceOf(deployer.getAddress())).to.eq(quotedAmt)
  expect(await buttonToken.totalSupply()).to.eq(quotedAmt)

  // burn collateral
  const burnCAmount = await buttonToken
    .connect(deployer)
    .callStatic.burn(quotedAmt)
  await buttonToken.connect(deployer).burn(quotedAmt)

  // Exactly burnCAmount gets transferred out of the button token contract
  expect(burnCAmount).to.eq(depositedCAmount)
  expect(burnCAmount).to.lte(cAmount)
  expect(await mockBTC.balanceOf(deployer.getAddress())).to.eq(MAX_COLLATERAL)
  expect(await mockBTC.balanceOf(buttonToken.address)).to.eq('0')

  // burner collateral balance decreases exactly by burnCAmount
  expect(await buttonToken.scaledBalanceOf(deployer.getAddress())).to.eq('0')
  expect(await buttonToken.scaledTotalSupply()).to.eq('0')

  // burner balance decreases exactly by quotedAmt
  expect(await buttonToken.balanceOf(deployer.getAddress())).to.eq('0')
  expect(await buttonToken.totalSupply()).to.eq('0')

  // burn shares if they are left over
  try {
    await buttonToken.connect(deployer).burnAll()
  } catch (e) {}
}

async function testTransfer(from: Signer, to: Signer, tAmt: BigNumberish) {
  const _fromT = await buttonToken.balanceOf(from.getAddress())
  const _toT = await buttonToken.balanceOf(to.getAddress())

  const _ts = await buttonToken.totalSupply()
  const _sTs = await buttonToken.scaledTotalSupply()

  await buttonToken.connect(from).transfer(to.getAddress(), tAmt)

  const fromT_ = await buttonToken.balanceOf(from.getAddress())
  const toT_ = await buttonToken.balanceOf(to.getAddress())

  const ts_ = await buttonToken.totalSupply()
  const sTs_ = await buttonToken.scaledTotalSupply()

  // exactly tAmt gets transferred
  expect(_fromT.sub(fromT_)).to.eq(tAmt)
  expect(toT_.sub(_toT)).to.eq(tAmt)

  // sum of balances are conserved
  expect(_fromT.add(_toT)).to.eq(fromT_.add(toT_))

  // supply does not change
  expect(_ts).to.eq(ts_)
  expect(_sTs).to.eq(sTs_)
}

async function exec() {
  const accounts = await ethers.getSigners()
  deployer = accounts[0]
  user = accounts[1]

  const erc20Factory = await ethers.getContractFactory('MockERC20')
  mockBTC = await erc20Factory
    .connect(deployer)
    .deploy('Wood Bitcoin', 'WOOD-BTC')

  const oracleFactory = await ethers.getContractFactory('MockOracle')
  const mockOracle = await oracleFactory.connect(deployer).deploy()
  await mockOracle.setData('1', true)

  const buttonTokenFactory = await ethers.getContractFactory('ButtonToken')
  buttonToken = await buttonTokenFactory
    .connect(deployer)
    .deploy(mockBTC.address, 'TEST', 'TEST', mockOracle.address)

  await mockBTC
    .connect(deployer)
    .mint(await deployer.getAddress(), MAX_COLLATERAL)

  let i = 0
  let currentPrice = await buttonToken.currentPrice()
  do {
    await mockOracle.setData(
      (await buttonToken.currentPrice()).add(priceChange),
      true,
    )
    currentPrice = await buttonToken.currentPrice()
    await buttonToken.connect(deployer).rebase()
    i++

    console.log('Rebase iteration', i)
    console.log('New price', currentPrice.toString(), 'price')

    const minCollateral = BigNumber.from('10')
      .pow(PRICE_DECIMALS)
      .div(currentPrice)
      .mul(2)
    console.log(
      `Testing precision of ${minCollateral.toString()} mint and burn`,
    )
    await testMintBurn(minCollateral)

    console.log(
      `Testing precision of ${MAX_COLLATERAL.div(23).toString()} mint and burn`,
    )
    await testMintBurn(MAX_COLLATERAL.div(23))

    console.log(
      `Testing precision of ${MAX_COLLATERAL.toString()} mint and burn`,
    )
    await testMintBurn(MAX_COLLATERAL)

    const quotedAmt = await buttonToken.exchangeRate(MAX_COLLATERAL)
    await mockBTC.connect(deployer).approve(buttonToken.address, MAX_COLLATERAL)
    const depositedCAmount = await buttonToken
      .connect(deployer)
      .callStatic.mint(quotedAmt)
    await buttonToken.connect(deployer).mint(quotedAmt)

    console.log('Queried CAmount', MAX_COLLATERAL.toString())
    console.log('Used CAmount', depositedCAmount.toString())
    console.log(
      'CAmount diff',
      depositedCAmount.sub(MAX_COLLATERAL).abs().toString(),
    )
    console.log('Quoted amount', quotedAmt.toString())

    console.log('Testing precision of 1 unit transfer')
    await testTransfer(deployer, user, '1')
    await testTransfer(user, deployer, '1')

    console.log(`Testing precision of ${quotedAmt.div(23).toString()} transfer`)
    await testTransfer(deployer, user, quotedAmt.div(23))
    await testTransfer(user, deployer, quotedAmt.div(23))

    console.log('Testing precision of max transfer')
    await testTransfer(deployer, user, quotedAmt)
    await testTransfer(user, deployer, quotedAmt)

    try {
      await buttonToken.connect(user).burnAll()
    } catch (e) {}
    await buttonToken.connect(deployer).burnAll()

    inflation = priceGrowth.next().toFixed(5)
    priceChange = imul(currentPrice, inflation, 1)
  } while (currentPrice.add(priceChange).lt(endPrice))
}

describe('Precision tests', function () {
  it('should successfully run simulation', async function () {
    await exec()
  })
})
