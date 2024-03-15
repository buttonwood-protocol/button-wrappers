import { ethers } from 'hardhat';
import { BigNumberish } from 'ethers';
import { BigNumber as BN } from 'bignumber.js';

export const imul = (a: BigNumberish, b: BigNumberish, c: BigNumberish) => {
  return ethers.BigNumber.from(
    new BN(a.toString()).times(b.toString()).idiv(c.toString()).toString(10),
  );
};

export const timeNow = async () => {
  return (await ethers.provider.getBlock('latest')).timestamp;
};

export const increaseTime = async (seconds: BigNumberish) => {
  await ethers.provider.send('evm_mine', [
    ethers.BigNumber.from(seconds)
      .add(await timeNow())
      .toNumber(),
  ]);
};

export const setTime = async (time: BigNumberish) => {
  await ethers.provider.send('evm_setNextBlockTimestamp', [time]);
};
