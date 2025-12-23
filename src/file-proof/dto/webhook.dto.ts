export enum TransactionStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
}

export enum TransactionFailureReason {
  ALREADY_REGISTERED = 'already_registered',
  SUBMISSION_FAILED = 'submission_failed',
  NETWORK_ERROR = 'network_error',
  NONCE_ERROR = 'nonce_error',
  RPC_RATE_LIMIT = 'rpc_rate_limit',
}

export interface TransactionSuccessData {
  blockNumber: number;
  registeredAt: number;
  gasUsed: string;
  gasPrice: string;
  gasCostEth: string;
}

export interface TransactionFailureData {
  reason: TransactionFailureReason;
  error: string;
}

export class TransactionResultDto {
  status: TransactionStatus;
  commit: string;
  txHash?: string;
  successData?: TransactionSuccessData;
  failureData?: TransactionFailureData;
}
