import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { WebSocketManager } from './websocket-manager';

@Injectable()
export class BlockchainService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BlockchainService.name);
  private provider: ethers.JsonRpcProvider;
  private wsManager: WebSocketManager;
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

  private async initializeWebSocketProvider() {
    const wsRpcUrl = this.configService.get<string>('WS_RPC_URL');

    if (!wsRpcUrl) {
      throw new Error('WS_RPC_URL is not defined');
    }

    this.wsManager = new WebSocketManager(wsRpcUrl, {
      baseReconnectDelay: 1000,
      maxReconnectDelay: 60000,
      healthCheckInterval: 60000,
      healthCheckRpcTimeout: 5000
    });

    // 이벤트 리스너 설정
    this.wsManager.on('connected', () => {
      this.logger.log('WebSocket connected to blockchain');
    });

    this.wsManager.on('disconnected', (code, reason) => {
      this.logger.warn(`WebSocket disconnected (code: ${code}, reason: ${reason})`);
    });

    this.wsManager.on('reconnecting', (attempt, delay) => {
      this.logger.log(`Reconnecting to WebSocket (attempt ${attempt}, delay ${Math.round(delay)}ms)`);
    });

    this.wsManager.on('reconnected', () => {
      this.logger.log('WebSocket reconnected to blockchain');
    });

    this.wsManager.on('error', (error) => {
      this.logger.error(`WebSocket error: ${error.message}`);
    });

    try {
      await this.wsManager.connect();
    } catch (error) {
      this.logger.error(`Failed to initialize WebSocket: ${error.message}`);
    }
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  getWsProvider(): ethers.WebSocketProvider | null {
    return this.wsManager?.getProvider() || null;
  }

  getWsManager(): WebSocketManager {
    return this.wsManager;
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

  async onModuleDestroy() {
    if (this.wsManager) {
      await this.wsManager.destroy();
      this.logger.log('WebSocketManager destroyed');
    }
  }
}
