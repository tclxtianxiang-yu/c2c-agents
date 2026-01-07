import { MIN_CONFIRMATIONS } from '@c2c-agents/config/constants';
import { MockUSDT__factory } from '@c2c-agents/contracts/typechain-types/factories/contracts/MockUSDT__factory';
import type { Log, Provider } from 'ethers';

import { ContractInteractionError, PaymentVerificationError } from '../errors';
import { normalizeAddress } from '../utils';
import { getProvider } from './contracts';

export interface VerifyPaymentParams {
  txHash: string;
  expectedFrom: string;
  expectedTo: string;
  expectedAmount: string;
  tokenAddress?: string;
  provider?: Provider;
  minConfirmations?: number;
}

export interface PaymentVerificationSuccess {
  success: true;
  txHash: string;
  confirmations: number;
  actualAmount: string;
}

export interface PaymentVerificationFailure {
  success: false;
  txHash: string;
  confirmations?: number;
  actualAmount?: string;
  error: PaymentVerificationError | ContractInteractionError;
}

export type PaymentVerificationResult = PaymentVerificationSuccess | PaymentVerificationFailure;

function toBigInt(value: string, label: string): bigint {
  try {
    return BigInt(value);
  } catch (error) {
    throw new PaymentVerificationError(`Invalid ${label} format`, { value, error });
  }
}

function findMatchingTransferLog(params: {
  logs: readonly Log[];
  tokenAddress: string;
  expectedFrom: string;
  expectedTo: string;
  expectedAmount: bigint;
}): { actualAmount?: string; matched: boolean } {
  const iface = MockUSDT__factory.createInterface();
  const transferEvent = iface.getEvent('Transfer');
  const transferTopic = transferEvent.topicHash;
  const normalizedToken = normalizeAddress(params.tokenAddress);
  let firstActual: string | undefined;

  for (const log of params.logs) {
    if (normalizeAddress(log.address) !== normalizedToken) continue;
    if (log.topics?.[0] !== transferTopic) continue;

    const parsed = iface.parseLog(log);
    if (!parsed) continue;
    const from = normalizeAddress(parsed.args.from as string);
    const to = normalizeAddress(parsed.args.to as string);
    const value = parsed.args.value as bigint;

    if (!firstActual) {
      firstActual = value.toString();
    }

    if (
      from === normalizeAddress(params.expectedFrom) &&
      to === normalizeAddress(params.expectedTo) &&
      value === params.expectedAmount
    ) {
      return { actualAmount: value.toString(), matched: true };
    }
  }

  return { matched: false, actualAmount: firstActual };
}

export async function verifyPayment(
  params: VerifyPaymentParams
): Promise<PaymentVerificationResult> {
  const provider = params.provider ?? getProvider();
  if (!params.tokenAddress) {
    return {
      success: false,
      txHash: params.txHash,
      error: new PaymentVerificationError('Missing tokenAddress: 必须显式传入 tokenAddress'),
    };
  }
  const tokenAddress = params.tokenAddress;
  const minConfirmations = params.minConfirmations ?? MIN_CONFIRMATIONS;
  let expectedFrom: string;
  let expectedTo: string;
  let normalizedToken: string;

  try {
    expectedFrom = normalizeAddress(params.expectedFrom);
    expectedTo = normalizeAddress(params.expectedTo);
    normalizedToken = normalizeAddress(tokenAddress);
  } catch (error) {
    return {
      success: false,
      txHash: params.txHash,
      error: new PaymentVerificationError('Invalid address in payment verification params', {
        expectedFrom: params.expectedFrom,
        expectedTo: params.expectedTo,
        tokenAddress,
        error,
      }),
    };
  }

  try {
    const receipt = await provider.getTransactionReceipt(params.txHash);
    if (!receipt) {
      return {
        success: false,
        txHash: params.txHash,
        error: new PaymentVerificationError('Transaction receipt not found', {
          txHash: params.txHash,
        }),
      };
    }

    if (receipt.status !== 1) {
      return {
        success: false,
        txHash: params.txHash,
        error: new PaymentVerificationError('Transaction status is failed', {
          txHash: params.txHash,
          status: receipt.status,
        }),
      };
    }

    const latestBlock = await provider.getBlockNumber();
    const confirmations = latestBlock - receipt.blockNumber + 1;
    if (confirmations < minConfirmations) {
      return {
        success: false,
        txHash: params.txHash,
        confirmations,
        error: new PaymentVerificationError('Insufficient confirmations', {
          required: minConfirmations,
          confirmations,
        }),
      };
    }

    const expectedAmount = toBigInt(params.expectedAmount, 'expectedAmount');
    const matchResult = findMatchingTransferLog({
      logs: receipt.logs,
      tokenAddress: normalizedToken,
      expectedFrom,
      expectedTo,
      expectedAmount,
    });

    if (!matchResult.matched) {
      return {
        success: false,
        txHash: params.txHash,
        confirmations,
        actualAmount: matchResult.actualAmount,
        error: new PaymentVerificationError('Transfer event mismatch', {
          expectedFrom: params.expectedFrom,
          expectedTo: params.expectedTo,
          expectedAmount: params.expectedAmount,
        }),
      };
    }

    return {
      success: true,
      txHash: params.txHash,
      confirmations,
      actualAmount: matchResult.actualAmount ?? params.expectedAmount,
    };
  } catch (error) {
    return {
      success: false,
      txHash: params.txHash,
      error: new ContractInteractionError('Failed to verify payment', {
        txHash: params.txHash,
        error,
      }),
    };
  }
}
