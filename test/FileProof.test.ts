import { expect } from 'chai';
import hre from 'hardhat';
import { FileProof } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('FileProof', function () {
  let fileProof: FileProof;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;

  // 테스트용 데이터
  const fileHash = hre.ethers.sha256(hre.ethers.toUtf8Bytes('test-file-content'));
  const salt = hre.ethers.randomBytes(32);
  const commit = hre.ethers.sha256(hre.ethers.concat([fileHash, salt]));
  const timestamp = Math.floor(Date.now() / 1000);
  const serverSignature = hre.ethers.toUtf8Bytes('mock-server-signature');

  beforeEach(async function () {
    [owner, addr1, addr2] = await hre.ethers.getSigners();

    const FileProofFactory = await hre.ethers.getContractFactory('FileProof');
    fileProof = await FileProofFactory.deploy();
    await fileProof.waitForDeployment();
  });

  describe('Deployment', function () {
    it('Should set the right owner', async function () {
      expect(await fileProof.owner()).to.equal(owner.address);
    });

    it('Should initialize totalCommits to 0', async function () {
      expect(await fileProof.totalCommits()).to.equal(0);
    });
  });

  describe('registerCommit', function () {
    it('Should register a commit successfully (only owner)', async function () {
      const tx = await fileProof.registerCommit(commit, timestamp, serverSignature);
      const receipt = await tx.wait();
      const block = await hre.ethers.provider.getBlock(receipt!.blockNumber);

      await expect(tx)
        .to.emit(fileProof, 'CommitRegistered')
        .withArgs(
          commit,
          timestamp,
          receipt!.blockNumber,
          block!.timestamp,
          owner.address,
        );

      expect(await fileProof.totalCommits()).to.equal(1);
    });

    it('Should revert if not called by owner', async function () {
      await expect(
        fileProof.connect(addr1).registerCommit(commit, timestamp, serverSignature),
      ).to.be.revertedWith('Only owner');
    });

    it('Should revert if commit is empty', async function () {
      const emptyCommit = hre.ethers.ZeroHash;
      await expect(
        fileProof.registerCommit(emptyCommit, timestamp, serverSignature),
      ).to.be.revertedWith('Empty commit');
    });

    it('Should revert if timestamp is 0', async function () {
      await expect(fileProof.registerCommit(commit, 0, serverSignature)).to.be.revertedWith(
        'Invalid timestamp',
      );
    });

    it('Should revert if serverSignature is empty', async function () {
      await expect(
        fileProof.registerCommit(commit, timestamp, '0x'),
      ).to.be.revertedWith('Missing signature');
    });

    it('Should revert if commit already exists', async function () {
      await fileProof.registerCommit(commit, timestamp, serverSignature);
      await expect(
        fileProof.registerCommit(commit, timestamp, serverSignature),
      ).to.be.revertedWith('Already registered');
    });

    it('Should increment totalCommits correctly', async function () {
      const commit2 = hre.ethers.sha256(hre.ethers.toUtf8Bytes('commit2'));
      const commit3 = hre.ethers.sha256(hre.ethers.toUtf8Bytes('commit3'));

      await fileProof.registerCommit(commit, timestamp, serverSignature);
      expect(await fileProof.totalCommits()).to.equal(1);

      await fileProof.registerCommit(commit2, timestamp, serverSignature);
      expect(await fileProof.totalCommits()).to.equal(2);

      await fileProof.registerCommit(commit3, timestamp, serverSignature);
      expect(await fileProof.totalCommits()).to.equal(3);
    });
  });

  describe('getCommit', function () {
    beforeEach(async function () {
      await fileProof.registerCommit(commit, timestamp, serverSignature);
    });

    it('Should return commit record correctly', async function () {
      const record = await fileProof.getCommit(commit);

      expect(record.commit).to.equal(commit);
      expect(record.timestamp).to.equal(timestamp);
      expect(record.serverSignature).to.equal(hre.ethers.hexlify(serverSignature));
      expect(record.blockNumber).to.be.greaterThan(0);
      expect(record.registeredAt).to.be.greaterThan(0);
      expect(record.exists).to.equal(true);
    });

    it('Should revert if commit does not exist', async function () {
      const nonExistentCommit = hre.ethers.sha256(hre.ethers.toUtf8Bytes('non-existent'));
      await expect(fileProof.getCommit(nonExistentCommit)).to.be.revertedWith('Not found');
    });
  });

  describe('verifyCommit', function () {
    beforeEach(async function () {
      await fileProof.registerCommit(commit, timestamp, serverSignature);
    });

    it('Should verify existing commit', async function () {
      const [exists, returnedTimestamp, blockNumber] = await fileProof.verifyCommit(commit);

      expect(exists).to.equal(true);
      expect(returnedTimestamp).to.equal(timestamp);
      expect(blockNumber).to.be.greaterThan(0);
    });

    it('Should return false for non-existent commit', async function () {
      const nonExistentCommit = hre.ethers.sha256(hre.ethers.toUtf8Bytes('non-existent'));
      const [exists, returnedTimestamp, blockNumber] = await fileProof.verifyCommit(
        nonExistentCommit,
      );

      expect(exists).to.equal(false);
      expect(returnedTimestamp).to.equal(0);
      expect(blockNumber).to.equal(0);
    });
  });

  describe('getCommitByIndex', function () {
    beforeEach(async function () {
      await fileProof.registerCommit(commit, timestamp, serverSignature);
    });

    it('Should return commit by index', async function () {
      const returnedCommit = await fileProof.getCommitByIndex(1);
      expect(returnedCommit).to.equal(commit);
    });

    it('Should revert if index is 0', async function () {
      await expect(fileProof.getCommitByIndex(0)).to.be.revertedWith('Invalid index');
    });

    it('Should revert if index is greater than totalCommits', async function () {
      await expect(fileProof.getCommitByIndex(2)).to.be.revertedWith('Invalid index');
    });
  });

  describe('getCommitsByRange', function () {
    const commit2 = hre.ethers.sha256(hre.ethers.toUtf8Bytes('commit2'));
    const commit3 = hre.ethers.sha256(hre.ethers.toUtf8Bytes('commit3'));

    beforeEach(async function () {
      await fileProof.registerCommit(commit, timestamp, serverSignature);
      await fileProof.registerCommit(commit2, timestamp, serverSignature);
      await fileProof.registerCommit(commit3, timestamp, serverSignature);
    });

    it('Should return commits in range', async function () {
      const commits = await fileProof.getCommitsByRange(1, 3);
      expect(commits.length).to.equal(3);
      expect(commits[0]).to.equal(commit);
      expect(commits[1]).to.equal(commit2);
      expect(commits[2]).to.equal(commit3);
    });

    it('Should return single commit when start equals end', async function () {
      const commits = await fileProof.getCommitsByRange(2, 2);
      expect(commits.length).to.equal(1);
      expect(commits[0]).to.equal(commit2);
    });

    it('Should revert if start is 0', async function () {
      await expect(fileProof.getCommitsByRange(0, 3)).to.be.revertedWith('Invalid start');
    });

    it('Should revert if start is greater than totalCommits', async function () {
      await expect(fileProof.getCommitsByRange(4, 5)).to.be.revertedWith('Invalid start');
    });

    it('Should revert if end is less than start', async function () {
      await expect(fileProof.getCommitsByRange(3, 1)).to.be.revertedWith('Invalid end');
    });

    it('Should revert if end is greater than totalCommits', async function () {
      await expect(fileProof.getCommitsByRange(1, 4)).to.be.revertedWith('Invalid end');
    });
  });

  describe('Complex scenarios', function () {
    it('Should handle multiple commits from owner', async function () {
      const commits = [
        hre.ethers.sha256(hre.ethers.toUtf8Bytes('commit1')),
        hre.ethers.sha256(hre.ethers.toUtf8Bytes('commit2')),
        hre.ethers.sha256(hre.ethers.toUtf8Bytes('commit3')),
      ];

      for (const c of commits) {
        await fileProof.registerCommit(c, timestamp, serverSignature);
      }

      expect(await fileProof.totalCommits()).to.equal(3);

      const allCommits = await fileProof.getCommitsByRange(1, 3);
      expect(allCommits.length).to.equal(3);
    });

    it('Should preserve commit data integrity', async function () {
      const blockNumberBefore = await hre.ethers.provider.getBlockNumber();

      await fileProof.registerCommit(commit, timestamp, serverSignature);

      const record = await fileProof.getCommit(commit);
      const [exists, ts, bn] = await fileProof.verifyCommit(commit);

      expect(exists).to.equal(true);
      expect(ts).to.equal(timestamp);
      expect(bn).to.equal(blockNumberBefore + 1);
      expect(record.commit).to.equal(commit);
      expect(record.timestamp).to.equal(timestamp);
    });

    it('Should verify off-chain proof calculation', async function () {
      const userFileHash = hre.ethers.sha256(hre.ethers.toUtf8Bytes('test-file-content'));
      const userSalt = salt;

      // Off-chain에서 commit 계산
      const calculatedCommit = hre.ethers.sha256(
        hre.ethers.concat([userFileHash, userSalt]),
      );

      // On-chain에 commit 등록
      await fileProof.registerCommit(calculatedCommit, timestamp, serverSignature);

      // 검증: 계산한 commit이 블록체인에 존재하는지 확인
      const [exists, ts, bn] = await fileProof.verifyCommit(calculatedCommit);
      expect(exists).to.equal(true);

      expect(calculatedCommit).to.equal(commit);
    });
  });
});
