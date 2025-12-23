import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { FileProofController } from './file-proof.controller';
import { FileProofService } from './file-proof.service';
import { CommitProcessor } from './commit.processor';

@Module({
  imports: [
    HttpModule,
    BullModule.registerQueue({
      name: 'commit', // "chain:commit:*" 형태로 Redis 저장
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    }),
  ],
  controllers: [FileProofController],
  providers: [FileProofService, CommitProcessor],
  exports: [FileProofService],
})
export class FileProofModule {}
