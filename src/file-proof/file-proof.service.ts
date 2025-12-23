import {
  Injectable,
  OnModuleInit,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import { firstValueFrom } from 'rxjs';
import { RegisterCommitDto } from './dto/register-commit.dto';
import {
  TransactionResultDto,
  TransactionStatus,
  TransactionSuccessData,
  TransactionFailureData,
  TransactionFailureReason,
} from './dto/webhook.dto';

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
  private readonly logger = new Logger(FileProofService.name);
  private fileProofContract: ethers.Contract;
  private wsContract: ethers.Contract;
  private contractAddress: string;
  private webhookUrl: string;

  constructor(
    private blockchainService: BlockchainService,
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.webhookUrl = this.configService.get<string>('WEBHOOK_URL') || '';
  }

  async onModuleInit() {
    await this.loadContract();
    await this.setupEventListener();
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
        this.logger.warn(`FileProof deployment file not found: ${deploymentPath}`);
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

      this.logger.log(`FileProof contract loaded: ${this.contractAddress}`);
    } catch (error) {
      this.logger.error('Failed to load FileProof contract:', error.message);
    }
  }

  private ensureContract() {
    if (!this.fileProofContract) {
      throw new InternalServerErrorException(
        'FileProof contract not initialized.',
      );
    }
  }

  // Commit을 블록체인에 등록 (백그라운드 처리, 결과는 웹훅 전송)
  async registerCommit(dto: RegisterCommitDto): Promise<void> {
    this.ensureContract();

    // 사전 검증으로 이미 등록된 commit인지 확인, Revert 방지
    let exists = false;
    try {
      [exists] = await this.fileProofContract.verifyCommit(dto.commit);
    } catch (error) {
      this.logger.error(`Failed to verify commit ${dto.commit}: ${error.message}`);

      // 재시도 가능한 에러면 throw (BullMQ가 재시도)
      if (this.isRetryableError(error)) {
        throw error;
      }

      await this.sendFailureWebhook(
        dto.commit,
        TransactionFailureReason.NETWORK_ERROR,
        `Verification failed: ${error.message}`,
      );
      return;
    }

    if (exists) {
      this.logger.warn(`Commit already registered: ${dto.commit}`);
      await this.sendFailureWebhook(
        dto.commit,
        TransactionFailureReason.ALREADY_REGISTERED,
        'Commit already exists on blockchain',
      );
      return;
    }

    // 트랜잭션 제출
    try {
      const startTime = Date.now();

      const tx = await this.fileProofContract.registerCommit(
        dto.commit,
        dto.timestamp,
        dto.serverSignature,
      );

      this.logger.log(`Transaction sent for commit ${dto.commit}: ${tx.hash} (${Date.now()-startTime}ms)`);

      // SUCCESS는 WebSocket 이벤트 리스너에서 처리
    } catch (error) {
      this.logger.error(`Failed to submit transaction for commit ${dto.commit}: ${error.message}`);

      // 재시도 가능한 에러면 throw (BullMQ가 재시도)
      if (this.isRetryableError(error)) {
        throw error;
      }

      await this.sendFailureWebhook(
        dto.commit,
        TransactionFailureReason.SUBMISSION_FAILED,
        error.message,
      );
    }
  }

  // Commit 레코드 조회
  async getCommit(commit: string): Promise<CommitRecord> {
    this.ensureContract();

    const verification = await this.verifyCommit(commit);
    if (!verification.exists) {
      throw new NotFoundException(`Commit not found: ${commit}`);
    }

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
  async getContractInfo(): Promise<{
    address: string;
    network: string;
    owner: string;
  }> {
    this.ensureContract();
    return {
      address: this.contractAddress,
      network: this.configService.get<string>('NETWORK') || 'localhost',
      owner: await this.fileProofContract.owner(),
    };
  }

  // WebSocket 이벤트 리스너 설정
  private async setupEventListener(): Promise<void> {
    try {
      const wsProvider = this.blockchainService.getWsProvider();

      this.wsContract = new ethers.Contract(
        this.contractAddress,
        this.fileProofContract.interface,
        wsProvider,
      );

      // CommitRegistered 이벤트 리스닝
      this.wsContract.on(
        'CommitRegistered',
        async (commit, timestamp, blockNumber, registeredAt, registrar, event) => {
          try {
            const txHash = event.log.transactionHash;

            const receipt = await wsProvider.getTransactionReceipt(txHash);

            if (!receipt) {
              this.logger.error(`Receipt not found for tx ${txHash}`);
              return;
            }

            const gasUsed = receipt.gasUsed;
            const gasPrice = receipt.gasPrice || 0n;
            const gasCost = gasUsed * gasPrice;

            const successData: TransactionSuccessData = {
              blockNumber: Number(blockNumber),
              registeredAt: Number(registeredAt),
              gasUsed: gasUsed.toString(),
              gasPrice: ethers.formatUnits(gasPrice, 'gwei') + ' gwei',
              gasCostEth: ethers.formatEther(gasCost) + ' ETH',
            };

            // SUCCESS 웹훅 전송
            await this.sendWebhook({
              status: TransactionStatus.SUCCESS,
              commit: commit,
              txHash: txHash,
              successData,
            });
          } catch (error) {
            this.logger.error(`Failed to process CommitRegistered event: ${error.message}`);
          }
        },
      );

      this.logger.log('WebSocket event listener setup complete');
    } catch (error) {
      this.logger.error(`Failed to setup event listener: ${error.message}`);
      throw error;
    }
  }

  // 웹훅 전송
  private async sendWebhook(transactionResultDto: TransactionResultDto): Promise<void> {
    if (!this.webhookUrl) {
      this.logger.warn('Webhook URL not configured.');
      return;
    }

    try {
      this.logger.log(`Sending webhook to ${this.webhookUrl} for commit ${transactionResultDto.commit}`);

      await firstValueFrom(
        this.httpService.post(this.webhookUrl, transactionResultDto, {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 3000, // 3초 타임아웃
        }),
      );

      this.logger.log(`Webhook sent successfully for commit ${transactionResultDto.commit}`);
    } catch (error) {
      this.logger.error(`Failed to send webhook for commit ${transactionResultDto.commit}: ${error.message}`);
    }
  }

  // 재시도 가능한 에러 판단
  private isRetryableError(error: any): boolean {
    const msg = error.message?.toLowerCase() || '';

    return (
      msg.includes('network') ||
      msg.includes('timeout') ||
      msg.includes('econnrefused') ||
      msg.includes('econnreset') ||
      msg.includes('429') ||
      msg.includes('rate limit') ||
      msg.includes('service unavailable') ||
      msg.includes('nonce')
    );
  }

  // FAILURE 웹훅 전송 헬퍼
  async sendFailureWebhook(
    commit: string,
    reason: TransactionFailureReason,
    error: string,
    txHash?: string,
  ): Promise<void> {
    const failureData: TransactionFailureData = {
      reason,
      error,
    };

    await this.sendWebhook({
      status: TransactionStatus.FAILURE,
      commit: commit,
      txHash: txHash,
      failureData,
    });
  }
}
