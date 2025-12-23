import {
  Controller, Get, Post,
  Body, Param, Query,
  HttpCode, HttpStatus,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { FileProofService } from './file-proof.service';
import { RegisterCommitDto } from './dto/register-commit.dto';

@Controller('file-proof')
export class FileProofController {
  private readonly logger = new Logger(FileProofController.name);

  constructor(
    private readonly fileProofService: FileProofService,
    @InjectQueue('commit') private readonly commitQueue: Queue<RegisterCommitDto>,
  ) {}

  // Commit을 블록체인에 등록
  @Post('commits')
  @HttpCode(HttpStatus.ACCEPTED)
  async registerCommit(@Body() dto: RegisterCommitDto) {
    const job = await this.commitQueue.add('register-commit', dto);

    this.logger.log(`Job #${job.id} added to queue for commit ${dto.commit}`);

    return {
      message: 'Transaction queued for processing',
      commit: dto.commit,
      jobId: job.id,
    };
  }

  // 전체 commit 수 조회
  @Get('total')
  async getTotalCommits() {
    const total = await this.fileProofService.getTotalCommits();
    return { totalCommits: total };
  }

  // 컨트랙트 정보 조회
  @Get('info')
  getContractInfo() {
    return this.fileProofService.getContractInfo();
  }

  // 범위로 commits 조회
  @Get('commits/by-range')
  async getCommitsByRange(
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    const startNum = parseInt(start, 10);
    const endNum = parseInt(end, 10);

    if (isNaN(startNum) || isNaN(endNum) || startNum < 1 || endNum < startNum) {
      throw new Error('Invalid range parameters');
    }

    return this.fileProofService.getCommitsByRange(startNum, endNum);
  }

  // 인덱스로 commit 조회
  @Get('commits/by-index/:index')
  async getCommitByIndex(@Param('index') index: string) {
    const indexNum = parseInt(index, 10);
    if (isNaN(indexNum) || indexNum < 1) {
      throw new Error('Index must be a positive integer');
    }
    const commit = await this.fileProofService.getCommitByIndex(indexNum);
    return { index: indexNum, commit };
  }

  // Commit 검증
  @Get('commits/:commit/verify')
  async verifyCommit(@Param('commit') commit: string) {
    return this.fileProofService.verifyCommit(commit);
  }

  // Commit 레코드 전체 내용 조회
  @Get('commits/:commit')
  async getCommit(@Param('commit') commit: string) {
    return this.fileProofService.getCommit(commit);
  }
}
