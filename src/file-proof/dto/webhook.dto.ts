export enum TransactionStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
}

export enum TransactionFailureReason {
  ALREADY_REGISTERED = 'already_registered',
  SUBMISSION_FAILED = 'submission_failed',
  NETWORK_ERROR = 'network_error',
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
