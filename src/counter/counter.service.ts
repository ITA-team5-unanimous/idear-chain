import {
  Injectable,
  OnModuleInit,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class CounterService implements OnModuleInit {
  private counterContract: ethers.Contract;
  private contractAddress: string;

  constructor(
    private blockchainService: BlockchainService,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.loadContract();
  }

  private async loadContract() {
    try {
      const network = this.configService.get<string>('NETWORK') || 'localhost';
      const deploymentPath = path.join(
        process.cwd(),
        'deployments',
        `Counter-${network}.json`,
      );

      if (!fs.existsSync(deploymentPath)) {
        console.warn(
          `Counter deployment file not found: ${deploymentPath}`,
        );
        console.warn('Please deploy the contract first');
        return;
      }

      const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
      this.contractAddress = deployment.contractAddress;
      const abi = deployment.abi;

      this.counterContract = await this.blockchainService.getContract(
        this.contractAddress,
        abi,
        true,
      );

      console.log(`Counter contract loaded: ${this.contractAddress}`);
    } catch (error) {
      console.error('Failed to load Counter contract:', error.message);
    }
  }

  private ensureContract() {
    if (!this.counterContract) {
      throw new BadRequestException(
        'Counter contract not initialized. Please deploy the contract first.',
      );
    }
  }

  async getCount(): Promise<number> {
    this.ensureContract();
    try {
      const count = await this.counterContract.getCount();
      return Number(count);
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to get count: ${error.message}`,
      );
    }
  }

  async increment(): Promise<{
    txHash: string;
    newCount: number;
    gasUsed: string;
    gasPrice: string;
    gasCostEth: string;
  }> {
    this.ensureContract();
    try {
      const tx = await this.counterContract.increment();
      const receipt = await tx.wait();
      const newCount = await this.getCount();

      const gasUsed = receipt.gasUsed;
      const gasPrice = receipt.gasPrice || tx.gasPrice;
      const gasCost = gasUsed * gasPrice;

      return {
        txHash: receipt.hash,
        newCount,
        gasUsed: gasUsed.toString(),
        gasPrice: ethers.formatUnits(gasPrice, 'gwei') + ' gwei',
        gasCostEth: ethers.formatEther(gasCost) + ' ETH',
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Transaction failed: ${error.message}`,
      );
    }
  }

  async decrement(): Promise<{
    txHash: string;
    newCount: number;
    gasUsed: string;
    gasPrice: string;
    gasCostEth: string;
  }> {
    this.ensureContract();
    try {
      const tx = await this.counterContract.decrement();
      const receipt = await tx.wait();
      const newCount = await this.getCount();

      const gasUsed = receipt.gasUsed;
      const gasPrice = receipt.gasPrice || tx.gasPrice;
      const gasCost = gasUsed * gasPrice;

      return {
        txHash: receipt.hash,
        newCount,
        gasUsed: gasUsed.toString(),
        gasPrice: ethers.formatUnits(gasPrice, 'gwei') + ' gwei',
        gasCostEth: ethers.formatEther(gasCost) + ' ETH',
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Transaction failed: ${error.message}`,
      );
    }
  }

  async reset(): Promise<{
    txHash: string;
    newCount: number;
    gasUsed: string;
    gasPrice: string;
    gasCostEth: string;
  }> {
    this.ensureContract();
    try {
      const tx = await this.counterContract.reset();
      const receipt = await tx.wait();
      const newCount = await this.getCount();

      const gasUsed = receipt.gasUsed;
      const gasPrice = receipt.gasPrice || tx.gasPrice;
      const gasCost = gasUsed * gasPrice;

      return {
        txHash: receipt.hash,
        newCount,
        gasUsed: gasUsed.toString(),
        gasPrice: ethers.formatUnits(gasPrice, 'gwei') + ' gwei',
        gasCostEth: ethers.formatEther(gasCost) + ' ETH',
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Transaction failed: ${error.message}`,
      );
    }
  }

  getContractInfo(): { address: string; network: string } {
    this.ensureContract();
    return {
      address: this.contractAddress,
      network: this.configService.get<string>('NETWORK') || 'localhost',
    };
  }
}
