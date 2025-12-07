import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FileProofController } from './file-proof.controller';
import { FileProofService } from './file-proof.service';

@Module({
  imports: [HttpModule],
  controllers: [FileProofController],
  providers: [FileProofService],
  exports: [FileProofService],
})
export class FileProofModule {}
