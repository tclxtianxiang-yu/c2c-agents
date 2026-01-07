import type { Provider, Signer } from 'ethers';
import { describe, expect, it, vi } from 'vitest';
import { ContractInteractionError, IdempotencyViolationError } from '../errors';
import {
  executePayout,
  executePayoutWithRetry,
  executeRecordEscrow,
  executeRefund,
  executeRefundWithRetry,
} from './settlement';

const ORDER_ID = '550e8400-e29b-41d4-a716-446655440000';
const CREATOR = '0x0000000000000000000000000000000000000101';
const PROVIDER = '0x0000000000000000000000000000000000000202';

function buildProvider(): Provider {
  return {
    getFeeData: vi.fn().mockResolvedValue({ gasPrice: 100n }),
    getBlockNumber: vi.fn().mockResolvedValue(120),
  } as unknown as Provider;
}

function buildSigner(provider: Provider): Signer {
  return {
    provider,
  } as unknown as Signer;
}

describe('executePayout', () => {
  it('should block when status is not None', async () => {
    const escrow = {
      getStatus: vi.fn().mockResolvedValue(1n),
      payout: vi.fn(),
    };
    const provider = buildProvider();

    const result = await executePayout({
      orderId: ORDER_ID,
      creatorAddress: CREATOR,
      providerAddress: PROVIDER,
      grossAmount: '1000000',
      signer: buildSigner(provider),
      deps: { escrowContract: escrow as never },
      provider,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(IdempotencyViolationError);
      expect(escrow.payout).not.toHaveBeenCalled();
    }
  });

  it('should execute payout successfully', async () => {
    const tx = {
      hash: '0xabc',
      wait: vi.fn().mockResolvedValue({ confirmations: 2 }),
    };
    const escrow = {
      getStatus: vi.fn().mockResolvedValue(0n),
      payout: vi.fn().mockResolvedValue(tx),
    };
    const provider = buildProvider();

    const result = await executePayout({
      orderId: ORDER_ID,
      creatorAddress: CREATOR,
      providerAddress: PROVIDER,
      grossAmount: '1000000',
      signer: buildSigner(provider),
      deps: { escrowContract: escrow as never },
      provider,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.txHash).toBe('0xabc');
      expect(result.netAmount).toBe('850000');
      expect(result.feeAmount).toBe('150000');
    }
  });

  it('should return ContractInteractionError on revert', async () => {
    const escrow = {
      getStatus: vi.fn().mockResolvedValue(0n),
      payout: vi.fn().mockRejectedValue(new Error('revert')),
    };
    const provider = buildProvider();

    const result = await executePayout({
      orderId: ORDER_ID,
      creatorAddress: CREATOR,
      providerAddress: PROVIDER,
      grossAmount: '1000000',
      signer: buildSigner(provider),
      deps: { escrowContract: escrow as never },
      provider,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ContractInteractionError);
    }
  });
});

describe('executeRefund', () => {
  it('should block when status is not None', async () => {
    const escrow = {
      getStatus: vi.fn().mockResolvedValue(2n),
      refund: vi.fn(),
    };
    const provider = buildProvider();

    const result = await executeRefund({
      orderId: ORDER_ID,
      creatorAddress: CREATOR,
      amount: '1000000',
      signer: buildSigner(provider),
      deps: { escrowContract: escrow as never },
      provider,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(IdempotencyViolationError);
      expect(escrow.refund).not.toHaveBeenCalled();
    }
  });

  it('should execute refund successfully', async () => {
    const tx = {
      hash: '0xdef',
      wait: vi.fn().mockResolvedValue({ confirmations: 1 }),
    };
    const escrow = {
      getStatus: vi.fn().mockResolvedValue(0n),
      refund: vi.fn().mockResolvedValue(tx),
    };
    const provider = buildProvider();

    const result = await executeRefund({
      orderId: ORDER_ID,
      creatorAddress: CREATOR,
      amount: '1000000',
      signer: buildSigner(provider),
      deps: { escrowContract: escrow as never },
      provider,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.txHash).toBe('0xdef');
      expect(result.amount).toBe('1000000');
    }
  });

  it('should return ContractInteractionError on refund failure', async () => {
    const escrow = {
      getStatus: vi.fn().mockResolvedValue(0n),
      refund: vi.fn().mockRejectedValue(new Error('revert')),
    };
    const provider = buildProvider();

    const result = await executeRefund({
      orderId: ORDER_ID,
      creatorAddress: CREATOR,
      amount: '1000000',
      signer: buildSigner(provider),
      deps: { escrowContract: escrow as never },
      provider,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ContractInteractionError);
    }
  });
});

describe('executeRecordEscrow', () => {
  it('should block when escrow already recorded', async () => {
    const escrow = {
      getStatus: vi.fn().mockResolvedValue(0n),
      escrowedAmounts: vi.fn().mockResolvedValue(1n),
      recordEscrow: vi.fn(),
    };
    const provider = buildProvider();

    const result = await executeRecordEscrow({
      orderId: ORDER_ID,
      amount: '1000000',
      signer: buildSigner(provider),
      deps: { escrowContract: escrow as never },
      provider,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(IdempotencyViolationError);
      expect(escrow.recordEscrow).not.toHaveBeenCalled();
    }
  });

  it('should record escrow successfully', async () => {
    const tx = {
      hash: '0xaaa',
      wait: vi.fn().mockResolvedValue({ confirmations: 1 }),
    };
    const escrow = {
      getStatus: vi.fn().mockResolvedValue(0n),
      escrowedAmounts: vi.fn().mockResolvedValue(0n),
      recordEscrow: vi.fn().mockResolvedValue(tx),
    };
    const provider = buildProvider();

    const result = await executeRecordEscrow({
      orderId: ORDER_ID,
      amount: '1000000',
      signer: buildSigner(provider),
      deps: { escrowContract: escrow as never },
      provider,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.txHash).toBe('0xaaa');
      expect(result.amount).toBe('1000000');
    }
  });
});

describe('retry helpers', () => {
  it('should stop retry on idempotency', async () => {
    const escrow = {
      getStatus: vi.fn().mockResolvedValue(1n),
    };
    const provider = buildProvider();

    const result = await executePayoutWithRetry(
      {
        orderId: ORDER_ID,
        creatorAddress: CREATOR,
        providerAddress: PROVIDER,
        grossAmount: '1000000',
        signer: buildSigner(provider),
        deps: { escrowContract: escrow as never },
        provider,
      },
      2
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(IdempotencyViolationError);
    }
  });

  it('should return last failure after retries', async () => {
    const escrow = {
      getStatus: vi.fn().mockResolvedValue(0n),
      refund: vi.fn().mockRejectedValue(new Error('revert')),
    };
    const provider = buildProvider();

    const result = await executeRefundWithRetry(
      {
        orderId: ORDER_ID,
        creatorAddress: CREATOR,
        amount: '1000000',
        signer: buildSigner(provider),
        deps: { escrowContract: escrow as never },
        provider,
      },
      2
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ContractInteractionError);
    }
  });
});
