import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  private provider: ethers.JsonRpcProvider;
  private wsProvider: ethers.WebSocketProvider;
  private signer: ethers.Wallet;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.initializeProvider();
    this.initializeWebSocketProvider();
  }

  private initializeProvider() {
    const rpcUrl = this.configService.get<string>('RPC_URL');
    const privateKey = this.configService.get<string>('PRIVATE_KEY');

    if (!rpcUrl) {
      throw new Error('RPC_URL is not defined in environment variables');
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.logger.log(`Connected to blockchain: ${rpcUrl}`);

    if (privateKey) {
      this.signer = new ethers.Wallet(privateKey, this.provider);
      this.logger.log(`Wallet loaded: ${this.signer.address}`);
    } else {
      this.logger.warn('PRIVATE_KEY not set');
    }
  }

  private initializeWebSocketProvider() {
    const wsRpcUrl = this.configService.get<string>('WS_RPC_URL');

    if (!wsRpcUrl) {
      throw new Error('WS_RPC_URL is not defined');
    }

    this.wsProvider = new ethers.WebSocketProvider(wsRpcUrl);

    this.wsProvider.once('block', (blockNumber) => {
      this.logger.log(`WebSocket connected to blockchain: ${wsRpcUrl} (block: ${blockNumber})`);
    });

    this.wsProvider.on('error', (error) => {
      this.logger.error(`WebSocket error: ${error.message}`);
    });
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  getWsProvider(): ethers.WebSocketProvider {
    return this.wsProvider;
  }

  getSigner(): ethers.Wallet {
    if (!this.signer) {
      throw new Error('Signer not initialized. PRIVATE_KEY is required.');
    }
    return this.signer;
  }

  async getContract(
    address: string,
    abi: any[],
    withSigner = false,
  ): Promise<ethers.Contract> {
    if (withSigner) {
      return new ethers.Contract(address, abi, this.getSigner());
    }
    return new ethers.Contract(address, abi, this.provider);
  }

  async getBlockNumber(): Promise<number> {
    return await this.provider.getBlockNumber();
  }

  async getBalance(address: string): Promise<string> {
    const balance = await this.provider.getBalance(address);
    return ethers.formatEther(balance);
  }
}
