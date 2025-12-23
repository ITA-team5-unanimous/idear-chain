import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { QueueModule } from './queue/queue.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { FileProofModule } from './file-proof/file-proof.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    QueueModule,
    BlockchainModule,
    FileProofModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
