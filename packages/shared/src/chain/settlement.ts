import type { Escrow } from '@c2c-agents/contracts/typechain-types/contracts/Escrow';
import type { Provider, Signer } from 'ethers';
import { ContractInteractionError, IdempotencyViolationError, ValidationError } from '../errors';
import { calculateFee, normalizeAddress, uuidToBytes32 } from '../utils';
import {
  GAS_LIMITS,
  GAS_PRICE_MULTIPLIER,
  MAX_RETRIES,
  MIN_CONFIRMATIONS,
  PLATFORM_FEE_RATE,
} from './constants';
import { getEscrowContract, getProvider } from './contracts';

export interface GasOverrides {
  gasLimit?: bigint;
  gasPriceMultiplier?: number;
}

export interface ExecutePayoutParams {
  orderId: string;
  creatorAddress: string;
  providerAddress: string;
  grossAmount: string;
  signer: Signer;
  escrowAddress?: string;
  feeRate?: number;
  minConfirmations?: number;
  gas?: GasOverrides;
  provider?: Provider;
  rpcUrl?: string;
  deps?: {
    escrowContract?: Escrow;
  };
}

export interface ExecuteRefundParams {
  orderId: string;
  creatorAddress: string;
  amount: string;
  signer: Signer;
  escrowAddress?: string;
  minConfirmations?: number;
  gas?: GasOverrides;
  provider?: Provider;
  rpcUrl?: string;
  deps?: {
    escrowContract?: Escrow;
  };
}

export interface ExecuteRecordEscrowParams {
  orderId: string;
  amount: string;
  signer: Signer;
  escrowAddress?: string;
  minConfirmations?: number;
  gas?: GasOverrides;
  provider?: Provider;
  rpcUrl?: string;
  deps?: {
    escrowContract?: Escrow;
  };
}

export interface SettlementSuccess {
  success: true;
  orderKey: string;
  txHash: string;
  confirmations: number;
}

export interface PayoutSuccess extends SettlementSuccess {
  grossAmount: string;
  netAmount: string;
  feeAmount: string;
}

export interface RefundSuccess extends SettlementSuccess {
  amount: string;
}

export interface RecordEscrowSuccess extends SettlementSuccess {
  amount: string;
}

export interface SettlementFailure {
  success: false;
  orderKey: string;
  error: ContractInteractionError | IdempotencyViolationError | ValidationError;
}

export type PayoutResult = PayoutSuccess | SettlementFailure;
export type RefundResult = RefundSuccess | SettlementFailure;
export type RecordEscrowResult = RecordEscrowSuccess | SettlementFailure;

function scaleBigInt(value: bigint, multiplier: number): bigint {
  const scale = 1000;
  const factor = BigInt(Math.round(multiplier * scale));
  return (value * factor) / BigInt(scale);
}

async function buildGasOverrides(
  provider: Provider | null,
  defaultLimit: number,
  gas?: GasOverrides
): Promise<{ gasLimit: bigint; gasPrice?: bigint }> {
  const gasLimit = gas?.gasLimit ?? BigInt(defaultLimit);
  if (!provider) return { gasLimit };

  const feeData = await provider.getFeeData();
  if (!feeData.gasPrice) return { gasLimit };

  const multiplier = gas?.gasPriceMultiplier ?? GAS_PRICE_MULTIPLIER;
  return {
    gasLimit,
    gasPrice: scaleBigInt(feeData.gasPrice, multiplier),
  };
}

async function resolveStatus(escrow: Escrow, orderKey: string): Promise<bigint> {
  try {
    return await escrow.getStatus(orderKey);
  } catch (error) {
    throw new ContractInteractionError('Failed to query Escrow status', { orderKey, error });
  }
}

export async function executePayout(params: ExecutePayoutParams): Promise<PayoutResult> {
  const orderKey = uuidToBytes32(params.orderId);
  const escrow =
    params.deps?.escrowContract ??
    getEscrowContract({
      signer: params.signer,
      escrowAddress: params.escrowAddress,
      provider: params.provider,
      rpcUrl: params.rpcUrl,
    });

  try {
    let creatorAddress: string;
    let providerAddress: string;
    try {
      creatorAddress = normalizeAddress(params.creatorAddress);
      providerAddress = normalizeAddress(params.providerAddress);
    } catch (error) {
      throw new ValidationError('Invalid settlement address', {
        creatorAddress: params.creatorAddress,
        providerAddress: params.providerAddress,
        error,
      });
    }

    const status = await resolveStatus(escrow, orderKey);
    if (status !== 0n) {
      return {
        success: false,
        orderKey,
        error: new IdempotencyViolationError('Order already settled', {
          orderId: params.orderId,
          status: status.toString(),
        }),
      };
    }

    const feeRate = params.feeRate ?? PLATFORM_FEE_RATE;
    const { feeAmount, netAmount } = calculateFee(params.grossAmount, feeRate);
    const gross = BigInt(params.grossAmount);
    const fee = BigInt(feeAmount);
    const net = BigInt(netAmount);

    const provider =
      params.provider ?? params.signer.provider ?? getProvider({ rpcUrl: params.rpcUrl });
    const overrides = await buildGasOverrides(provider, GAS_LIMITS.PAYOUT, params.gas);
    const minConfirmations = params.minConfirmations ?? MIN_CONFIRMATIONS;

    const tx = await escrow.payout(
      orderKey,
      creatorAddress,
      providerAddress,
      gross,
      net,
      fee,
      overrides
    );
    const receipt = await tx.wait(minConfirmations);
    if (!receipt) {
      throw new ContractInteractionError('Payout transaction not confirmed', {
        orderId: params.orderId,
      });
    }

    const latestBlock = await provider.getBlockNumber();
    const confirmations = latestBlock - receipt.blockNumber + 1;

    return {
      success: true,
      orderKey,
      txHash: tx.hash,
      confirmations,
      grossAmount: params.grossAmount,
      netAmount,
      feeAmount,
    };
  } catch (error) {
    if (error instanceof IdempotencyViolationError || error instanceof ValidationError) {
      return { success: false, orderKey, error };
    }

    return {
      success: false,
      orderKey,
      error:
        error instanceof ContractInteractionError
          ? error
          : new ContractInteractionError('Payout execution failed', {
              orderId: params.orderId,
              error,
            }),
    };
  }
}

export async function executeRefund(params: ExecuteRefundParams): Promise<RefundResult> {
  const orderKey = uuidToBytes32(params.orderId);
  const escrow =
    params.deps?.escrowContract ??
    getEscrowContract({
      signer: params.signer,
      escrowAddress: params.escrowAddress,
      provider: params.provider,
      rpcUrl: params.rpcUrl,
    });

  try {
    let creatorAddress: string;
    try {
      creatorAddress = normalizeAddress(params.creatorAddress);
    } catch (error) {
      throw new ValidationError('Invalid refund address', {
        creatorAddress: params.creatorAddress,
        error,
      });
    }

    const status = await resolveStatus(escrow, orderKey);
    if (status !== 0n) {
      return {
        success: false,
        orderKey,
        error: new IdempotencyViolationError('Order already settled', {
          orderId: params.orderId,
          status: status.toString(),
        }),
      };
    }

    const amount = BigInt(params.amount);
    const provider =
      params.provider ?? params.signer.provider ?? getProvider({ rpcUrl: params.rpcUrl });
    const overrides = await buildGasOverrides(provider, GAS_LIMITS.REFUND, params.gas);
    const minConfirmations = params.minConfirmations ?? MIN_CONFIRMATIONS;

    const tx = await escrow.refund(orderKey, creatorAddress, amount, overrides);
    const receipt = await tx.wait(minConfirmations);
    if (!receipt) {
      throw new ContractInteractionError('Refund transaction not confirmed', {
        orderId: params.orderId,
      });
    }

    const latestBlock = await provider.getBlockNumber();
    const confirmations = latestBlock - receipt.blockNumber + 1;

    return {
      success: true,
      orderKey,
      txHash: tx.hash,
      confirmations,
      amount: params.amount,
    };
  } catch (error) {
    if (error instanceof IdempotencyViolationError || error instanceof ValidationError) {
      return { success: false, orderKey, error };
    }

    return {
      success: false,
      orderKey,
      error:
        error instanceof ContractInteractionError
          ? error
          : new ContractInteractionError('Refund execution failed', {
              orderId: params.orderId,
              error,
            }),
    };
  }
}

export async function executeRecordEscrow(
  params: ExecuteRecordEscrowParams
): Promise<RecordEscrowResult> {
  const orderKey = uuidToBytes32(params.orderId);
  const escrow =
    params.deps?.escrowContract ??
    getEscrowContract({
      signer: params.signer,
      escrowAddress: params.escrowAddress,
      provider: params.provider,
      rpcUrl: params.rpcUrl,
    });

  try {
    const status = await resolveStatus(escrow, orderKey);
    if (status !== 0n) {
      return {
        success: false,
        orderKey,
        error: new IdempotencyViolationError('Order already settled', {
          orderId: params.orderId,
          status: status.toString(),
        }),
      };
    }

    const reserved = await escrow.escrowedAmounts(orderKey);
    if (reserved > 0n) {
      return {
        success: false,
        orderKey,
        error: new IdempotencyViolationError('Escrow already recorded', {
          orderId: params.orderId,
          amount: reserved.toString(),
        }),
      };
    }

    const amount = BigInt(params.amount);
    if (amount <= 0n) {
      return {
        success: false,
        orderKey,
        error: new ValidationError('Escrow amount must be > 0', {
          orderId: params.orderId,
          amount: params.amount,
        }),
      };
    }

    const provider =
      params.provider ?? params.signer.provider ?? getProvider({ rpcUrl: params.rpcUrl });
    const overrides = await buildGasOverrides(provider, GAS_LIMITS.DEPOSIT, params.gas);
    const minConfirmations = params.minConfirmations ?? MIN_CONFIRMATIONS;

    const tx = await escrow.recordEscrow(orderKey, amount, overrides);
    const receipt = await tx.wait(minConfirmations);
    if (!receipt) {
      throw new ContractInteractionError('Record escrow transaction not confirmed', {
        orderId: params.orderId,
      });
    }

    const latestBlock = await provider.getBlockNumber();
    const confirmations = latestBlock - receipt.blockNumber + 1;

    return {
      success: true,
      orderKey,
      txHash: tx.hash,
      confirmations,
      amount: params.amount,
    };
  } catch (error) {
    if (error instanceof IdempotencyViolationError || error instanceof ValidationError) {
      return { success: false, orderKey, error };
    }

    return {
      success: false,
      orderKey,
      error:
        error instanceof ContractInteractionError
          ? error
          : new ContractInteractionError('Record escrow execution failed', {
              orderId: params.orderId,
              error,
            }),
    };
  }
}

export async function executePayoutWithRetry(
  params: ExecutePayoutParams,
  maxRetries: number = MAX_RETRIES
): Promise<PayoutResult> {
  if (maxRetries < 1) {
    return {
      success: false,
      orderKey: uuidToBytes32(params.orderId),
      error: new ValidationError('maxRetries must be >= 1'),
    };
  }

  let attempt = 0;
  let lastResult: PayoutResult | null = null;

  while (attempt < maxRetries) {
    attempt += 1;
    lastResult = await executePayout(params);

    if (lastResult.success) return lastResult;
    if (lastResult.error instanceof IdempotencyViolationError) return lastResult;
  }

  return (
    lastResult ?? {
      success: false,
      orderKey: uuidToBytes32(params.orderId),
      error: new ContractInteractionError('Payout execution failed after retries'),
    }
  );
}

export async function executeRefundWithRetry(
  params: ExecuteRefundParams,
  maxRetries: number = MAX_RETRIES
): Promise<RefundResult> {
  if (maxRetries < 1) {
    return {
      success: false,
      orderKey: uuidToBytes32(params.orderId),
      error: new ValidationError('maxRetries must be >= 1'),
    };
  }

  let attempt = 0;
  let lastResult: RefundResult | null = null;

  while (attempt < maxRetries) {
    attempt += 1;
    lastResult = await executeRefund(params);

    if (lastResult.success) return lastResult;
    if (lastResult.error instanceof IdempotencyViolationError) return lastResult;
  }

  return (
    lastResult ?? {
      success: false,
      orderKey: uuidToBytes32(params.orderId),
      error: new ContractInteractionError('Refund execution failed after retries'),
    }
  );
}
