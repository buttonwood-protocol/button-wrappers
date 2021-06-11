import { ethers, upgrades } from 'hardhat'
import { Contract, Signer, BigNumber } from 'ethers'
import { expect } from 'chai'

const ORACLE_DECIMALS = 20
const DECIMALS = 18
const NAME = 'Button Bitcoin'
const SYMBOL = 'BTN-BTC'

const toOracleValue = (v: string): BigNumber =>
  ethers.utils.parseUnits(v, ORACLE_DECIMALS)

const toFixedPtAmt = (a: string): BigNumber =>
  ethers.utils.parseUnits(a, DECIMALS)

function eqAprox(a: BigNumber, b: BigNumber, diff: string = '1') {
  expect(a).to.gte(b.sub(diff)).lte(b)
}

let accounts: Signer[],
  deployer: Signer,
  deployerAddress: string,
  userA: Signer,
  userAAddress: string,
  userB: Signer,
  userBAddress: string,
  mockBTC: Contract,
  mockOracle: Contract,
  buttonToken: Contract

async function setupContracts() {
  accounts = await ethers.getSigners()
  deployer = accounts[0]
  userA = accounts[1]
  userB = accounts[2]

  deployerAddress = await deployer.getAddress()
  userAAddress = await userA.getAddress()
  userBAddress = await userB.getAddress()

  const erc20Factory = await ethers.getContractFactory('MockERC20')
  mockBTC = await erc20Factory
    .connect(deployer)
    .deploy('Wood Bitcoin', 'WOOD-BTC')

  const oracleFactory = await ethers.getContractFactory('MockOracle')
  mockOracle = await oracleFactory.connect(deployer).deploy()
  await mockOracle.setData(toOracleValue('10000'), true)

  const buttonTokenFactory = await ethers.getContractFactory('ButtonToken')
  buttonToken = await buttonTokenFactory
    .connect(deployer)
    .deploy(mockBTC.address, NAME, SYMBOL, mockOracle.address)
}

describe('ButtonToken', () => {
  before('setup ButtonToken contract', setupContracts)

  it('should reject any ether sent to it', async function () {
    const user = accounts[1]
    await expect(user.sendTransaction({ to: buttonToken.address, value: 1 })).to
      .be.reverted
  })
})

describe('ButtonToken:Initialization', () => {
  beforeEach('setup ButtonToken contract', setupContracts)

  it('should set the owner', async function () {
    expect(await buttonToken.owner()).to.eq(deployerAddress)
  })

  it('should set the asset reference', async function () {
    expect(await buttonToken.asset()).to.eq(mockBTC.address)
  })

  it('should set detailed erc20 info parameters', async function () {
    expect(await buttonToken.name()).to.eq(NAME)
    expect(await buttonToken.symbol()).to.eq(SYMBOL)
    expect(await buttonToken.decimals()).to.eq(await mockBTC.decimals())
  })

  it('should set the erc20 balance and supply parameters', async function () {
    expect(await buttonToken.totalSupply()).to.eq('0')
    expect(await buttonToken.scaledTotalSupply()).to.eq('0')
    expect(await buttonToken.balanceOf(deployerAddress)).to.eq('0')
    expect(await buttonToken.scaledBalanceOf(deployerAddress)).to.eq('0')
  })

  it('should set the oracle price and reference', async function () {
    expect(await buttonToken.priceOracle()).to.eq(mockOracle.address)
    expect(await buttonToken.lastPriceUpdateTimestampSec()).to.gte(0)
    expect(await buttonToken.minPriceUpdateIntervalSec()).to.eq(3600)
  })
})

describe('ButtonToken:resetPriceOracle', async () => {
  beforeEach('setup ButtonToken contract', setupContracts)

  describe('when invoked by non owner', function () {
    it('should revert', async function () {
      const oracleFactory = await ethers.getContractFactory('MockOracle')
      mockOracle = await oracleFactory.connect(deployer).deploy()
      await mockOracle.setData(toOracleValue('45000'), true)

      await expect(
        buttonToken.connect(userA).resetPriceOracle(mockOracle.address),
      ).to.be.revertedWith('Ownable: caller is not the owner')
    })
  })

  describe('when the new price oracle is NOT valid', function () {
    it('should revert', async function () {
      const oracleFactory = await ethers.getContractFactory('MockOracle')
      mockOracle = await oracleFactory.connect(deployer).deploy()
      await mockOracle.setData(toOracleValue('45000'), false)

      await expect(
        buttonToken.connect(deployer).resetPriceOracle(mockOracle.address),
      ).to.be.revertedWith('ButtonToken: unable to fetch data from oracle')
    })
  })

  describe('when the new price oracle is valid', function () {
    it('should update the reference and rebase with new price', async function () {
      const oracleFactory = await ethers.getContractFactory('MockOracle')
      mockOracle = await oracleFactory.connect(deployer).deploy()
      await mockOracle.setData(toOracleValue('45000'), true)

      expect(await buttonToken.priceOracle()).to.not.eq(mockOracle.address)
      const timeBefore = await buttonToken.lastPriceUpdateTimestampSec()

      await expect(
        buttonToken.connect(deployer).resetPriceOracle(mockOracle.address),
      )
        .to.emit(buttonToken, 'Rebase')
        .withArgs(toOracleValue('45000'))
        .to.emit(buttonToken, 'PriceOracleUpdated')
        .withArgs(mockOracle.address)

      expect(await buttonToken.priceOracle()).to.eq(mockOracle.address)
      expect(await buttonToken.lastPriceUpdateTimestampSec()).to.gte(timeBefore)
      expect(await buttonToken.currentPrice()).to.eq(toOracleValue('45000'))
    })
  })
})

describe('ButtonToken:setMinUpdateIntervalSec', async () => {
  beforeEach('setup ButtonToken contract', setupContracts)

  describe('when invoked by non owner', function () {
    it('should revert', async function () {
      await expect(
        buttonToken.connect(userA).setMinUpdateIntervalSec(7200),
      ).to.be.revertedWith('Ownable: caller is not the owner')
    })
  })

  describe('when invoked by owner', function () {
    it('should update minPriceUpdateIntervalSec', async function () {
      expect(await buttonToken.minPriceUpdateIntervalSec()).to.not.eq(7200)
      await buttonToken.connect(deployer).setMinUpdateIntervalSec(7200)
      expect(await buttonToken.minPriceUpdateIntervalSec()).to.eq(7200)
    })
  })
})

describe('ButtonToken:Rebase:Expansion', async () => {
  // Rebase +10%, with starting balances A:750 and B:250.
  let r: any
  before('setup ButtonToken contract', async function () {
    await setupContracts()
    await buttonToken.setMinUpdateIntervalSec(0)

    await mockBTC.connect(deployer).mint(deployerAddress, toFixedPtAmt('1'))
    await mockBTC
      .connect(deployer)
      .approve(buttonToken.address, toFixedPtAmt('1'))

    await buttonToken
      .connect(deployer)
      .mint(await buttonToken.getExchangeRate(toFixedPtAmt('1')))
    await buttonToken
      .connect(deployer)
      .transfer(userAAddress, toFixedPtAmt('7500'))
    await buttonToken
      .connect(deployer)
      .transfer(userBAddress, toFixedPtAmt('2500'))

    expect(await buttonToken.totalSupply()).to.eq(toFixedPtAmt('10000'))
    expect(await buttonToken.balanceOf(deployerAddress)).to.eq(
      toFixedPtAmt('0'),
    )
    expect(await buttonToken.balanceOf(userAAddress)).to.eq(
      toFixedPtAmt('7500'),
    )
    expect(await buttonToken.balanceOf(userBAddress)).to.eq(
      toFixedPtAmt('2500'),
    )

    eqAprox(await buttonToken.scaledTotalSupply(), toFixedPtAmt('1'))
    eqAprox(
      await buttonToken.scaledBalanceOf(userAAddress),
      toFixedPtAmt('0.75'),
    )
    eqAprox(
      await buttonToken.scaledBalanceOf(userBAddress),
      toFixedPtAmt('0.25'),
    )

    await mockOracle.setData(toOracleValue('11000'), true)
    r = buttonToken.rebase()
    await r
  })

  it('should emit Rebase', async function () {
    await expect(r)
      .to.emit(buttonToken, 'Rebase')
      .withArgs(toOracleValue('11000'))
  })

  it('should increase the totalSupply', async function () {
    expect(await buttonToken.totalSupply()).to.eq(toFixedPtAmt('11000'))
  })

  it('should NOT CHANGE the scaledTotalSupply', async function () {
    eqAprox(await buttonToken.scaledTotalSupply(), toFixedPtAmt('1'))
  })

  it('should increase individual balances', async function () {
    expect(await buttonToken.balanceOf(userAAddress)).to.eq(
      toFixedPtAmt('8250'),
    )
    expect(await buttonToken.balanceOf(userBAddress)).to.eq(
      toFixedPtAmt('2750'),
    )
  })

  it('should NOT CHANGE the individual scaled balances', async function () {
    eqAprox(
      await buttonToken.scaledBalanceOf(userAAddress),
      toFixedPtAmt('0.75'),
    )
    eqAprox(
      await buttonToken.scaledBalanceOf(userBAddress),
      toFixedPtAmt('0.25'),
    )
  })
})

// describe('ButtonToken:Rebase:Expansion', async function () {
//   let policy: Signer
//   const MAX_SUPPLY = ethers.BigNumber.from(2).pow(128).sub(1)

//   describe('when totalSupply is less than MAX_SUPPLY and expands beyond', function () {
//     before('setup ButtonToken contract', async function () {
//       await setupContracts()
//       policy = accounts[1]
//       await buttonToken
//         .connect(deployer)
//         .setMonetaryPolicy(await policy.getAddress())
//       const totalSupply = await buttonToken.totalSupply.call()
//       await buttonToken
//         .connect(policy)
//         .rebase(MAX_SUPPLY.sub(toFixedPtAmt('1')))
//     })

//     it('should emit Rebase', async function () {
//       const supply = await buttonToken.totalSupply()
//       await expect(
//         buttonToken.connect(policy).rebase(supply.add(toFixedPtAmt('2'))),
//       )
//         .to.emit(buttonToken, 'LogRebase')
//         .withArgs(MAX_SUPPLY)
//     })

//     it('should increase the totalSupply to MAX_SUPPLY', async function () {
//       expect(await buttonToken.totalSupply()).to.eq(MAX_SUPPLY)
//     })
//   })

//   describe('when totalSupply is MAX_SUPPLY and expands', function () {
//     before(async function () {
//       expect(await buttonToken.totalSupply()).to.eq(MAX_SUPPLY)
//     })

//     it('should emit Rebase', async function () {
//       const supply = await buttonToken.totalSupply()
//       await expect(
//         buttonToken.connect(policy).rebase(supply.add(toFixedPtAmt('2'))),
//       )
//         .to.emit(buttonToken, 'LogRebase')
//         .withArgs(MAX_SUPPLY)
//     })

//     it('should NOT change the totalSupply', async function () {
//       expect(await buttonToken.totalSupply()).to.eq(MAX_SUPPLY)
//     })
//   })
// })

// describe('ButtonToken:Rebase:NoChange', function () {
//   // Rebase (0%), with starting balances A:750 and B:250.
//   let A: Signer, B: Signer, policy: Signer

//   before('setup ButtonToken contract', async function () {
//     await setupContracts()
//     A = accounts[2]
//     B = accounts[3]
//     policy = accounts[1]
//     await buttonToken
//       .connect(deployer)
//       .setMonetaryPolicy(await policy.getAddress())
//     await buttonToken
//       .connect(deployer)
//       .transfer(userAAddress, toFixedPtAmt('750'))
//     await buttonToken
//       .connect(deployer)
//       .transfer(userBAddress, toFixedPtAmt('250'))

//     expect(await buttonToken.totalSupply()).to.eq(INITIAL_SUPPLY)
//     expect(await buttonToken.balanceOf(userAAddress)).to.eq(
//       toFixedPtAmt('750'),
//     )
//     expect(await buttonToken.balanceOf(userBAddress)).to.eq(
//       toFixedPtAmt('250'),
//     )

//     expect(await buttonToken.scaledTotalSupply()).to.eq(TOTAL_GONS)
//     expect(await buttonToken.scaledBalanceOf(userAAddress)).to.eq(
//       '1736881338559742931353564775130318617799049769984608460591863250000000000',
//     )
//     expect(await buttonToken.scaledBalanceOf(userBAddress)).to.eq(
//       '578960446186580977117854925043439539266349923328202820197287750000000000',
//     )
//   })

//   it('should emit Rebase', async function () {
//     const supply = await buttonToken.totalSupply()
//     await expect(buttonToken.connect(policy).rebase(supply))
//       .to.emit(buttonToken, 'LogRebase')
//       .withArgs(initialSupply)
//   })

//   it('should NOT CHANGE the totalSupply', async function () {
//     expect(await buttonToken.totalSupply()).to.eq(initialSupply)
//   })

//   it('should NOT CHANGE the scaledTotalSupply', async function () {
//     expect(await buttonToken.scaledTotalSupply()).to.eq(TOTAL_GONS)
//   })

//   it('should NOT CHANGE individual balances', async function () {
//     expect(await buttonToken.balanceOf(userAAddress)).to.eq(
//       toFixedPtAmt('750'),
//     )
//     expect(await buttonToken.balanceOf(userBAddress)).to.eq(
//       toFixedPtAmt('250'),
//     )
//   })

//   it('should NOT CHANGE the individual scaled balances', async function () {
//     expect(await buttonToken.scaledBalanceOf(userAAddress)).to.eq(
//       '1736881338559742931353564775130318617799049769984608460591863250000000000',
//     )
//     expect(await buttonToken.scaledBalanceOf(userBAddress)).to.eq(
//       '578960446186580977117854925043439539266349923328202820197287750000000000',
//     )
//   })
// })

// describe('ButtonToken:Rebase:Contraction', function () {
//   // Rebase -5M (-10%), with starting balances A:750 and B:250.
//   let A: Signer, B: Signer, policy: Signer
//   const rebaseAmt = INITIAL_SUPPLY.div(10)

//   before('setup ButtonToken contract', async function () {
//     await setupContracts()
//     A = accounts[2]
//     B = accounts[3]
//     policy = accounts[1]
//     await buttonToken
//       .connect(deployer)
//       .setMonetaryPolicy(await policy.getAddress())
//     await buttonToken
//       .connect(deployer)
//       .transfer(userAAddress, toFixedPtAmt('750'))
//     await buttonToken
//       .connect(deployer)
//       .transfer(userBAddress, toFixedPtAmt('250'))

//     expect(await buttonToken.totalSupply()).to.eq(INITIAL_SUPPLY)
//     expect(await buttonToken.balanceOf(userAAddress)).to.eq(
//       toFixedPtAmt('750'),
//     )
//     expect(await buttonToken.balanceOf(userBAddress)).to.eq(
//       toFixedPtAmt('250'),
//     )

//     expect(await buttonToken.scaledTotalSupply()).to.eq(TOTAL_GONS)
//     expect(await buttonToken.scaledBalanceOf(userAAddress)).to.eq(
//       '1736881338559742931353564775130318617799049769984608460591863250000000000',
//     )
//     expect(await buttonToken.scaledBalanceOf(userBAddress)).to.eq(
//       '578960446186580977117854925043439539266349923328202820197287750000000000',
//     )
//   })

//   it('should emit Rebase', async function () {
//     const supply = await buttonToken.totalSupply()
//     await expect(buttonToken.connect(policy).rebase(supply.sub(rebaseAmt)))
//       .to.emit(buttonToken, 'LogRebase')
//       .withArgs(initialSupply.sub(rebaseAmt))
//   })

//   it('should decrease the totalSupply', async function () {
//     expect(await buttonToken.totalSupply()).to.eq(initialSupply.sub(rebaseAmt))
//   })

//   it('should NOT. CHANGE the scaledTotalSupply', async function () {
//     expect(await buttonToken.scaledTotalSupply()).to.eq(TOTAL_GONS)
//   })

//   it('should decrease individual balances', async function () {
//     expect(await buttonToken.balanceOf(userAAddress)).to.eq(
//       toFixedPtAmt('675'),
//     )
//     expect(await buttonToken.balanceOf(userBAddress)).to.eq(
//       toFixedPtAmt('225'),
//     )
//   })

//   it('should NOT CHANGE the individual scaled balances', async function () {
//     expect(await buttonToken.scaledBalanceOf(userAAddress)).to.eq(
//       '1736881338559742931353564775130318617799049769984608460591863250000000000',
//     )
//     expect(await buttonToken.scaledBalanceOf(userBAddress)).to.eq(
//       '578960446186580977117854925043439539266349923328202820197287750000000000',
//     )
//   })
// })

// describe('ButtonToken:Transfer', function () {
//   let A: Signer, B: Signer, C: Signer

//   before('setup ButtonToken contract', async () => {
//     await setupContracts()
//     A = accounts[2]
//     B = accounts[3]
//     C = accounts[4]
//   })

//   describe('deployer transfers 12 to A', function () {
//     it('should have correct balances', async function () {
//       const deployerBefore = await buttonToken.balanceOf(
//         deployerAddress,
//       )
//       await buttonToken
//         .connect(deployer)
//         .transfer(userAAddress, toFixedPtAmt('12'))
//       expect(await buttonToken.balanceOf(deployerAddress)).to.eq(
//         deployerBefore.sub(toFixedPtAmt('12')),
//       )
//       expect(await buttonToken.balanceOf(userAAddress)).to.eq(
//         toFixedPtAmt('12'),
//       )
//     })
//   })

//   describe('deployer transfers 15 to B', async function () {
//     it('should have balances [973,15]', async function () {
//       const deployerBefore = await buttonToken.balanceOf(
//         deployerAddress,
//       )
//       await buttonToken
//         .connect(deployer)
//         .transfer(userBAddress, toFixedPtAmt('15'))
//       expect(await buttonToken.balanceOf(deployerAddress)).to.eq(
//         deployerBefore.sub(toFixedPtAmt('15')),
//       )
//       expect(await buttonToken.balanceOf(userBAddress)).to.eq(
//         toFixedPtAmt('15'),
//       )
//     })
//   })

//   describe('deployer transfers the rest to C', async function () {
//     it('should have balances [0,973]', async function () {
//       const deployerBefore = await buttonToken.balanceOf(
//         deployerAddress,
//       )
//       await buttonToken
//         .connect(deployer)
//         .transfer(await C.getAddress(), deployerBefore)
//       expect(await buttonToken.balanceOf(deployerAddress)).to.eq(0)
//       expect(await buttonToken.balanceOf(await C.getAddress())).to.eq(
//         deployerBefore,
//       )
//     })
//   })

//   describe('when the recipient address is the contract address', function () {
//     it('reverts on transfer', async function () {
//       await expect(
//         buttonToken.connect(A).transfer(buttonToken.address, unitTokenAmount),
//       ).to.be.reverted
//     })

//     it('reverts on transferFrom', async function () {
//       await expect(
//         buttonToken
//           .connect(A)
//           .transferFrom(
//             userAAddress,
//             buttonToken.address,
//             unitTokenAmount,
//           ),
//       ).to.be.reverted
//     })
//   })

//   describe('when the recipient is the zero address', function () {
//     it('emits an approval event', async function () {
//       await expect(
//         buttonToken
//           .connect(A)
//           .approve(ethers.constants.AddressZero, transferAmount),
//       )
//         .to.emit(buttonToken, 'Approval')
//         .withArgs(
//           userAAddress,
//           ethers.constants.AddressZero,
//           transferAmount,
//         )
//     })

//     it('transferFrom should fail', async function () {
//       await expect(
//         buttonToken
//           .connect(C)
//           .transferFrom(
//             userAAddress,
//             ethers.constants.AddressZero,
//             unitTokenAmount,
//           ),
//       ).to.be.reverted
//     })
//   })
// })

describe('ButtonToken:deposit', async () => {
  // when no approval
  // when deposit amounts are too small
  // overflow/underflow conditions?
  // when success
  // transfer collateral
  // mint tokens
  // emit event
  describe('with sufficient approval', async function () {
    beforeEach('setup ButtonToken contract', async () => {
      await setupContracts()

      await mockBTC.connect(deployer).mint(userAAddress, toFixedPtAmt('1'))

      await mockBTC
        .connect(userA)
        .approve(buttonToken.address, toFixedPtAmt('1'))
    })

    it('should transfer collateral from the user', async function () {
      expect(await mockBTC.balanceOf(userAAddress)).to.eq(toFixedPtAmt('1'))
      expect(await mockBTC.balanceOf(buttonToken.address)).to.eq(
        toFixedPtAmt('0'),
      )

      await buttonToken
        .connect(userA)
        .mint(await buttonToken.getExchangeRate(toFixedPtAmt('1')))

      expect(await mockBTC.balanceOf(userAAddress)).to.eq(toFixedPtAmt('0'))
      expect(await mockBTC.balanceOf(buttonToken.address)).to.eq(
        toFixedPtAmt('1'),
      )
    })

    it('should mint button tokens', async function () {
      expect(await buttonToken.balanceOf(userAAddress)).to.eq('0')

      await buttonToken
        .connect(userA)
        .mint(await buttonToken.getExchangeRate(toFixedPtAmt('1')))

      expect(await buttonToken.balanceOf(userAAddress)).to.eq(
        toFixedPtAmt('10000'),
      )
    })

    it('should emit transfer log', async function () {
      await expect(
        buttonToken
          .connect(userA)
          .mint(await buttonToken.getExchangeRate(toFixedPtAmt('1'))),
      )
        .to.emit(buttonToken, 'Transfer')
        .withArgs(
          ethers.constants.AddressZero,
          userAAddress,
          toFixedPtAmt('10000'),
        )
    })
  })
})
