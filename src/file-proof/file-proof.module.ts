import { Module } from '@nestjs/common';
import { FileProofController } from './file-proof.controller';
import { FileProofService } from './file-proof.service';

@Module({
  controllers: [FileProofController],
  providers: [FileProofService],
  exports: [FileProofService],
})
export class FileProofModule {}
