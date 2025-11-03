import { expect } from 'chai';
import hre from 'hardhat';
import { Counter } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('Counter', function () {
  let counter: Counter;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;

  beforeEach(async function () {
    [owner, addr1] = await hre.ethers.getSigners();

    const CounterFactory = await hre.ethers.getContractFactory('Counter');
    counter = await CounterFactory.deploy();
    await counter.waitForDeployment();
  });

  describe('Deployment', function () {
    it('Should set the right owner', async function () {
      expect(await counter.owner()).to.equal(owner.address);
    });

    it('Should initialize count to 0', async function () {
      expect(await counter.getCount()).to.equal(0);
    });
  });

  describe('Increment', function () {
    it('Should increment count by 1', async function () {
      await counter.increment();
      expect(await counter.getCount()).to.equal(1);
    });

    it('Should emit CountChanged event', async function () {
      await expect(counter.increment())
        .to.emit(counter, 'CountChanged')
        .withArgs(1, owner.address);
    });

    it('Should increment multiple times', async function () {
      await counter.increment();
      await counter.increment();
      await counter.increment();
      expect(await counter.getCount()).to.equal(3);
    });
  });

  describe('Decrement', function () {
    it('Should decrement count by 1 when count > 0', async function () {
      await counter.increment();
      await counter.increment();
      await counter.decrement();
      expect(await counter.getCount()).to.equal(1);
    });

    it('Should emit CountChanged event', async function () {
      await counter.increment();
      await expect(counter.decrement())
        .to.emit(counter, 'CountChanged')
        .withArgs(0, owner.address);
    });

    it('Should revert when trying to decrement below zero (underflow)', async function () {
      await expect(counter.decrement()).to.be.reverted;
    });

    it('Should revert when count is 0', async function () {
      await counter.increment();
      await counter.decrement();
      expect(await counter.getCount()).to.equal(0);
      await expect(counter.decrement()).to.be.reverted;
    });
  });

  describe('Reset', function () {
    it('Should reset count to 0', async function () {
      await counter.increment();
      await counter.increment();
      await counter.reset();
      expect(await counter.getCount()).to.equal(0);
    });

    it('Should emit CountReset event', async function () {
      await expect(counter.reset())
        .to.emit(counter, 'CountReset')
        .withArgs(owner.address);
    });
  });

  describe('Complex scenarios', function () {
    it('Should handle increment and decrement together', async function () {
      await counter.increment();
      await counter.increment();
      await counter.decrement();
      expect(await counter.getCount()).to.equal(1);
    });

    it('Should allow any address to modify counter', async function () {
      await counter.connect(addr1).increment();
      expect(await counter.getCount()).to.equal(1);
    });
  });
});
