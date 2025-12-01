import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BlockchainModule } from './blockchain/blockchain.module';
import { CounterModule } from './counter/counter.module';
import { FileProofModule } from './file-proof/file-proof.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BlockchainModule,
    CounterModule,
    FileProofModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
