import { Processor, WorkerHost, OnQueueEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { FileProofService } from './file-proof.service';
import { RegisterCommitDto } from './dto/register-commit.dto';
import { TransactionFailureReason } from './dto/webhook.dto';

@Processor('commit', {
  concurrency: 1, // 순차 처리로 nonce 충돌 방지
})
export class CommitProcessor extends WorkerHost {
  private readonly logger = new Logger(CommitProcessor.name);

  constructor(private readonly fileProofService: FileProofService) {
    super();
  }

  async process(job: Job<RegisterCommitDto>): Promise<void> {
    const { commit } = job.data;

    this.logger.log(`Processing commit registration job #${job.id}: ${commit}`);

    await this.fileProofService.registerCommit(job.data);

    this.logger.log(`Job #${job.id} completed successfully for commit ${commit}`);
  }

  @OnQueueEvent('failed')
  async onFailed(job: Job<RegisterCommitDto>, error: Error) {
    const { commit } = job.data;

    // error를 통해 reason 특정
    const reason = this.classifyFailureReason(error);

    this.logger.error(`Job #${job.id} permanently failed: ${reason}`);

    await this.fileProofService.sendFailureWebhook(
      commit,
      reason,
      `Failed after ${job.attemptsMade} attempts: ${error.message}`,
    );
  }

  private classifyFailureReason(error: Error): TransactionFailureReason {
    const msg = error.message?.toLowerCase() || '';

    // RPC rate limit
    if (msg.includes('429') || msg.includes('rate limit')) {
      return TransactionFailureReason.RPC_RATE_LIMIT;
    }

    if (msg.includes('not in mempool')) {
      return TransactionFailureReason.NETWORK_ERROR;
    }

    // 네트워크 에러
    if (msg.includes('network') || msg.includes('timeout')) {
      return TransactionFailureReason.NETWORK_ERROR;
    }

    // 기타 제출 실패 (nonce 에러 포함)
    return TransactionFailureReason.SUBMISSION_FAILED;
  }
}
