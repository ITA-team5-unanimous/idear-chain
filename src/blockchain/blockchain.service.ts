import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

@Injectable()
export class BlockchainService implements OnModuleInit {
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Wallet;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.initializeProvider();
  }

  private initializeProvider() {
    const rpcUrl = this.configService.get<string>('RPC_URL');
    const privateKey = this.configService.get<string>('PRIVATE_KEY');

    if (!rpcUrl) {
      throw new Error('RPC_URL is not defined in environment variables');
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    console.log(`Connected to blockchain: ${rpcUrl}`);

    if (privateKey) {
      this.signer = new ethers.Wallet(privateKey, this.provider);
      console.log(`Wallet loaded: ${this.signer.address}`);
    } else {
      console.warn('PRIVATE_KEY not set - read-only mode');
    }
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
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
