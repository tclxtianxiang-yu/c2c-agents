import type {
  ExecutePayoutParams,
  ExecuteRecordEscrowParams,
  ExecuteRefundParams,
  PaymentVerificationResult,
  PayoutResult,
  RecordEscrowResult,
  RefundResult,
  VerifyPaymentParams,
} from '@c2c-agents/shared/chain';
import {
  executePayout,
  executeRecordEscrow,
  executeRefund,
  getProvider,
  verifyPayment,
} from '@c2c-agents/shared/chain';
import { Injectable } from '@nestjs/common';
import type { JsonRpcProvider } from 'ethers';
import { Wallet } from 'ethers';
import { validateApiEnv } from '../../config/env';

type VerifyPaymentInput = Omit<VerifyPaymentParams, 'tokenAddress' | 'provider'>;
type ExecutePayoutInput = Omit<
  ExecutePayoutParams,
  'signer' | 'escrowAddress' | 'provider' | 'rpcUrl'
>;
type ExecuteRefundInput = Omit<
  ExecuteRefundParams,
  'signer' | 'escrowAddress' | 'provider' | 'rpcUrl'
>;
type ExecuteRecordEscrowInput = Omit<
  ExecuteRecordEscrowParams,
  'signer' | 'escrowAddress' | 'provider' | 'rpcUrl'
>;

@Injectable()
export class ChainService {
  private readonly rpcUrl: string;
  private readonly mockUsdtAddress: string;
  private readonly escrowAddress: string;
  private readonly provider: JsonRpcProvider;
  private readonly signer: Wallet;

  constructor() {
    const env = validateApiEnv();
    this.rpcUrl = env.chainRpcUrl;
    this.mockUsdtAddress = env.mockUsdtAddress;
    this.escrowAddress = env.escrowAddress;
    this.provider = getProvider({ rpcUrl: this.rpcUrl });
    // signer/provider 生命周期为 app 单例
    this.signer = new Wallet(env.operatorPrivateKey, this.provider);
  }

  verifyPayment(params: VerifyPaymentInput): Promise<PaymentVerificationResult> {
    return verifyPayment({
      ...params,
      tokenAddress: this.mockUsdtAddress,
      provider: this.provider,
    });
  }

  executePayout(params: ExecutePayoutInput): Promise<PayoutResult> {
    return executePayout({
      ...params,
      signer: this.signer,
      escrowAddress: this.escrowAddress,
      rpcUrl: this.rpcUrl,
    });
  }

  executeRefund(params: ExecuteRefundInput): Promise<RefundResult> {
    return executeRefund({
      ...params,
      signer: this.signer,
      escrowAddress: this.escrowAddress,
      rpcUrl: this.rpcUrl,
    });
  }

  recordEscrow(params: ExecuteRecordEscrowInput): Promise<RecordEscrowResult> {
    return executeRecordEscrow({
      ...params,
      signer: this.signer,
      escrowAddress: this.escrowAddress,
      rpcUrl: this.rpcUrl,
    });
  }
}
