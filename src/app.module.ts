import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BlockchainModule } from './blockchain/blockchain.module';
import { CounterModule } from './counter/counter.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BlockchainModule,
    CounterModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
