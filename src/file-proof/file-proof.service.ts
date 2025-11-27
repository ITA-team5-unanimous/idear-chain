import {
  Injectable,
  OnModuleInit,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import { RegisterCommitDto } from './dto/register-commit.dto';

export interface CommitRecord {
  commit: string;
  timestamp: number;
  serverSignature: string;
  blockNumber: number;
  registeredAt: number;
  exists: boolean;
  txHash: string;
}

@Injectable()
export class FileProofService implements OnModuleInit {
  private fileProofContract: ethers.Contract;
  private contractAddress: string;

  constructor(
    private blockchainService: BlockchainService,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.loadContract();
  }

  private async loadContract() {
    try {
      const network = this.configService.get<string>('NETWORK') || 'localhost';
      const deploymentPath = path.join(
        process.cwd(),
        'deployments',
        `FileProof-${network}.json`,
      );

      if (!fs.existsSync(deploymentPath)) {
        console.warn(
          `FileProof deployment file not found: ${deploymentPath}`,
        );
        console.warn('Please deploy the FileProof contract first');
        return;
      }

      const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
      this.contractAddress = deployment.contractAddress;
      const abi = deployment.abi;

      this.fileProofContract = await this.blockchainService.getContract(
        this.contractAddress,
        abi,
        true,
      );

      console.log(`FileProof contract loaded: ${this.contractAddress}`);
    } catch (error) {
      console.error('Failed to load FileProof contract:', error.message);
    }
  }

  private ensureContract() {
    if (!this.fileProofContract) {
      throw new BadRequestException(
        'FileProof contract not initialized. Please deploy the contract first.',
      );
    }
  }

  // Commit을 블록체인에 등록
  async registerCommit(dto: RegisterCommitDto): Promise<{
    txHash: string;
    commit: string;
    blockNumber: number;
    gasUsed: string;
    gasPrice: string;
    gasCostEth: string;
  }> {
    this.ensureContract();
    try {
      const tx = await this.fileProofContract.registerCommit(
        dto.commit,
        dto.timestamp,
        dto.serverSignature,
      );
      const receipt = await tx.wait();

      const gasUsed = receipt.gasUsed;
      const gasPrice = receipt.gasPrice || tx.gasPrice;
      const gasCost = gasUsed * gasPrice;

      return {
        txHash: receipt.hash,
        commit: dto.commit,
        blockNumber: receipt.blockNumber,
        gasUsed: gasUsed.toString(),
        gasPrice: ethers.formatUnits(gasPrice, 'gwei') + ' gwei',
        gasCostEth: ethers.formatEther(gasCost) + ' ETH',
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to register commit: ${error.message}`,
      );
    }
  }

  // Commit 레코드 조회
  async getCommit(commit: string): Promise<CommitRecord> {
    this.ensureContract();
    try {
      const record = await this.fileProofContract.getCommit(commit);

      // 이벤트 로그에서 txHash 조회
      const blockNumber = Number(record.blockNumber);
      const filter = this.fileProofContract.filters.CommitRegistered(commit);
      const events = await this.fileProofContract.queryFilter(filter, blockNumber, blockNumber);
      const txHash = events.length > 0 ? events[0].transactionHash : '';

      return {
        txHash,
        commit: record.commit,
        timestamp: Number(record.timestamp),
        serverSignature: record.serverSignature,
        blockNumber,
        registeredAt: Number(record.registeredAt),
        exists: record.exists,
      };
    } catch (error) {
      if (error.message.includes('Not found')) {
        throw new NotFoundException(`Commit not found: ${commit}`);
      }
      throw new InternalServerErrorException(
        `Failed to get commit: ${error.message}`,
      );
    }
  }

  // Commit 검증 (존재 여부 및 일부 정보)
  async verifyCommit(commit: string): Promise<{
    exists: boolean;
    timestamp: number;
    blockNumber: number;
  }> {
    this.ensureContract();
    try {
      const [exists, timestamp, blockNumber] =
        await this.fileProofContract.verifyCommit(commit);

      return {
        exists,
        timestamp: Number(timestamp),
        blockNumber: Number(blockNumber),
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to verify commit: ${error.message}`,
      );
    }
  }

  // 인덱스로 commit 조회
  async getCommitByIndex(index: number): Promise<string> {
    this.ensureContract();
    try {
      const commit = await this.fileProofContract.getCommitByIndex(index);
      return commit;
    } catch (error) {
      if (error.message.includes('Invalid index')) {
        throw new BadRequestException(`Invalid index: ${index}`);
      }
      throw new InternalServerErrorException(
        `Failed to get commit by index: ${error.message}`,
      );
    }
  }

  // 범위로 commit 조회
  async getCommitsByRange(
    start: number,
    end: number,
  ): Promise<{ commits: string[]; count: number }> {
    this.ensureContract();
    try {
      const commits = await this.fileProofContract.getCommitsByRange(
        start,
        end,
      );
      return {
        commits: commits.map((c: string) => c),
        count: commits.length,
      };
    } catch (error) {
      if (
        error.message.includes('Invalid start') ||
        error.message.includes('Invalid end')
      ) {
        throw new BadRequestException(
          `Invalid range: start=${start}, end=${end}`,
        );
      }
      throw new InternalServerErrorException(
        `Failed to get commits by range: ${error.message}`,
      );
    }
  }

  // 전체 commit 수 조회
  async getTotalCommits(): Promise<number> {
    this.ensureContract();
    try {
      const total = await this.fileProofContract.totalCommits();
      return Number(total);
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to get total commits: ${error.message}`,
      );
    }
  }

  // 컨트랙트 정보 조회
  getContractInfo(): {
    address: string;
    network: string;
    owner: string;
  } {
    this.ensureContract();
    return {
      address: this.contractAddress,
      network: this.configService.get<string>('NETWORK') || 'localhost',
      owner: this.blockchainService.getSigner().address,
    };
  }
}
