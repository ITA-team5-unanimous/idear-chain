import { Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { EventEmitter } from 'events';
import WebSocket from 'ws';

export enum ConnectionState {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  RECONNECTING = 'RECONNECTING',
  DESTROYED = 'DESTROYED',
}

export interface WebSocketManagerEvents {
  connected: () => void;
  disconnected: (code: number, reason: string) => void;
  reconnecting: (attempt: number, delay: number) => void;
  reconnected: () => void;
  error: (error: Error) => void;
}

export class WebSocketManager extends EventEmitter {
  private readonly logger = new Logger(WebSocketManager.name);
  private wsProvider: ethers.WebSocketProvider | null = null;
  private state: ConnectionState = ConnectionState.DISCONNECTED;

  // 재연결 설정
  private reconnectAttempt = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readonly baseReconnectDelay: number;
  private readonly maxReconnectDelay: number;

  // 헬스체크 설정
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private readonly healthCheckInterval: number;
  private readonly healthCheckRpcTimeout: number;

  constructor(
    private readonly wsRpcUrl: string,
    options?: {
      baseReconnectDelay?: number;
      maxReconnectDelay?: number;
      healthCheckInterval?: number;
      healthCheckRpcTimeout?: number;
    },
  ) {
    super();
    this.baseReconnectDelay = options?.baseReconnectDelay ?? 1000;
    this.maxReconnectDelay = options?.maxReconnectDelay ?? 60000;
    this.healthCheckInterval = options?.healthCheckInterval ?? 60000;
    this.healthCheckRpcTimeout = options?.healthCheckRpcTimeout ?? 5000;
  }

  async connect(): Promise<ethers.WebSocketProvider> {
    if (this.state === ConnectionState.DESTROYED) {
      throw new Error('WebSocketManager has been destroyed');
    }

    if (this.state === ConnectionState.CONNECTED && this.wsProvider) {
      return this.wsProvider;
    }

    const isReconnecting = this.reconnectAttempt > 0;

    this.transitionTo(ConnectionState.CONNECTING);

    if (!isReconnecting) {
      this.logger.log(`Connecting to WebSocket: ${this.wsRpcUrl}`);
    }

    try {
      this.wsProvider = this.createProvider();
      await this.verifyConnection();

      this.transitionTo(ConnectionState.CONNECTED);
      this.reconnectAttempt = 0;

      this.logger.log('WebSocket connected successfully');
      this.emit('connected');

      this.startHealthCheck();

      return this.wsProvider;
    } catch (error) {
      await this.cleanup();
      this.transitionTo(ConnectionState.DISCONNECTED);
      this.scheduleReconnect();

      throw error;
    }
  }

  private createProvider(): ethers.WebSocketProvider {
    const ws = new WebSocket(this.wsRpcUrl);

    ws.on('error', (err: Error) => {
      this.logger.error(`WebSocket error: ${err.message}`);
    });

    ws.on('close', (code: number, reasonBuf: Buffer) => {
      const reason = reasonBuf?.toString?.() ?? '';

      if (code !== 1000) {
        this.logger.warn(`WebSocket closed abnormally (code: ${code}${reason ? `, reason: ${reason}` : ''})`);
      }

      this.emit('disconnected', code, reason);

      if (
        code !== 1000 &&
        this.state !== ConnectionState.DESTROYED &&
        (this.state === ConnectionState.CONNECTING ||
          this.state === ConnectionState.CONNECTED)
      ) {
        void this.handleConnectionLost();
      }
    });

    return new ethers.WebSocketProvider(ws as any);
  }

  private async verifyConnection(): Promise<void> {
    if (!this.wsProvider) {
      throw new Error('Provider not initialized');
    }

    try {
      await Promise.race([
        this.wsProvider.getBlockNumber(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection verification timeout')), 10000),
        ),
      ]);
    } catch (error) {
      throw new Error(`Connection verification failed: ${error.message}`);
    }
  }

  private async handleConnectionLost(): Promise<void> {
    if (this.state === ConnectionState.DESTROYED) return;
    if (this.state === ConnectionState.RECONNECTING) return;

    await this.cleanup();
    this.transitionTo(ConnectionState.DISCONNECTED);
    this.scheduleReconnect();
  }

  private startHealthCheck(): void {
    this.stopHealthCheck();

    this.healthCheckTimer = setInterval(() => {
      void this.performHealthCheck();
    }, this.healthCheckInterval);
  }

  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  private async performHealthCheck(): Promise<void> {
    if (this.state !== ConnectionState.CONNECTED) {
      return;
    }

    try {
      await Promise.race([
        this.wsProvider?.getBlockNumber(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Health check RPC timeout')),
            this.healthCheckRpcTimeout,
          ),
        ),
      ]);
    } catch (error) {
      this.logger.warn(`Health check failed, reconnecting...`);
      await this.handleConnectionLost();
    }
  }

  private scheduleReconnect(): void {
    if (this.state === ConnectionState.DESTROYED) {
      return;
    }

    if (this.reconnectTimer) {
      return;
    }

    this.transitionTo(ConnectionState.RECONNECTING);

    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempt),
      this.maxReconnectDelay,
    );

    this.reconnectAttempt++;
    this.logger.log(
      `Reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempt})`,
    );
    this.emit('reconnecting', this.reconnectAttempt, delay);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.reconnect();
    }, delay);
  }

  private async reconnect(): Promise<void> {
    if (this.state === ConnectionState.DESTROYED) {
      return;
    }

    this.logger.log(`Reconnection attempt ${this.reconnectAttempt}...`);

    try {
      await this.connect();
      this.logger.log(
        `WebSocket reconnected successfully (${this.reconnectAttempt} attempts)`,
      );
      this.emit('reconnected');
    } catch (error) {
      this.logger.warn(`Reconnection failed: ${error.message}`);
    }
  }

  private transitionTo(newState: ConnectionState): void {
    if (this.state === newState) {
      return;
    }

    this.state = newState;
  }

  getState(): ConnectionState {
    return this.state;
  }

  isConnected(): boolean {
    return this.state === ConnectionState.CONNECTED;
  }

  getProvider(): ethers.WebSocketProvider | null {
    return this.wsProvider;
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempt;
  }

  private async cleanup(): Promise<void> {
    this.stopHealthCheck();

    if (this.wsProvider) {
      try {
        this.wsProvider.removeAllListeners();
        await this.wsProvider.destroy();
      } catch (error) {
        // Ignore cleanup errors
      }
      this.wsProvider = null;
    }
  }

  async destroy(): Promise<void> {
    this.transitionTo(ConnectionState.DESTROYED);

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    await this.cleanup();

    this.removeAllListeners();
    this.logger.log('WebSocketManager destroyed');
  }
}
