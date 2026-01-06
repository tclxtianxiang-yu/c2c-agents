import { MockUSDT__factory } from '@c2c-agents/contracts/typechain-types/factories/contracts/MockUSDT__factory';
import type { Provider } from 'ethers';
import { describe, expect, it, vi } from 'vitest';
import { PaymentVerificationError } from '../errors';
import { verifyPayment } from './payment-verification';

const TX_HASH = `0x${'11'.repeat(32)}`;
const TOKEN_ADDRESS = '0x0000000000000000000000000000000000000011';
const FROM = '0x0000000000000000000000000000000000000022';
const TO = '0x0000000000000000000000000000000000000033';

function buildTransferLog(amount: bigint, overrides?: { from?: string; to?: string }) {
  const iface = MockUSDT__factory.createInterface();
  const event = iface.getEvent('Transfer');
  const encoded = iface.encodeEventLog(event, [
    overrides?.from ?? FROM,
    overrides?.to ?? TO,
    amount,
  ]);

  return {
    address: TOKEN_ADDRESS,
    topics: encoded.topics,
    data: encoded.data,
  };
}

function buildProvider(receipt: unknown, blockNumber: number): Provider {
  return {
    getTransactionReceipt: vi.fn().mockResolvedValue(receipt),
    getBlockNumber: vi.fn().mockResolvedValue(blockNumber),
  } as unknown as Provider;
}

describe('verifyPayment', () => {
  it('should fail when transaction status is failed', async () => {
    const receipt = {
      status: 0,
      blockNumber: 100,
      logs: [],
    };
    const provider = buildProvider(receipt, 120);

    const result = await verifyPayment({
      txHash: TX_HASH,
      expectedFrom: FROM,
      expectedTo: TO,
      expectedAmount: '1000000',
      tokenAddress: TOKEN_ADDRESS,
      provider,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(PaymentVerificationError);
    }
  });

  it('should fail when receipt is null', async () => {
    const provider = buildProvider(null, 120);

    const result = await verifyPayment({
      txHash: TX_HASH,
      expectedFrom: FROM,
      expectedTo: TO,
      expectedAmount: '1000000',
      tokenAddress: TOKEN_ADDRESS,
      provider,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(PaymentVerificationError);
    }
  });

  it('should fail when confirmations are insufficient', async () => {
    const receipt = {
      status: 1,
      blockNumber: 100,
      logs: [buildTransferLog(1000000n)],
    };
    const provider = buildProvider(receipt, 100);

    const result = await verifyPayment({
      txHash: TX_HASH,
      expectedFrom: FROM,
      expectedTo: TO,
      expectedAmount: '1000000',
      tokenAddress: TOKEN_ADDRESS,
      provider,
      minConfirmations: 2,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(PaymentVerificationError);
      expect(result.confirmations).toBe(1);
    }
  });

  it('should fail when from address mismatches', async () => {
    const receipt = {
      status: 1,
      blockNumber: 100,
      logs: [buildTransferLog(1000000n, { from: '0x0000000000000000000000000000000000000044' })],
    };
    const provider = buildProvider(receipt, 105);

    const result = await verifyPayment({
      txHash: TX_HASH,
      expectedFrom: FROM,
      expectedTo: TO,
      expectedAmount: '1000000',
      tokenAddress: TOKEN_ADDRESS,
      provider,
      minConfirmations: 3,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(PaymentVerificationError);
    }
  });

  it('should fail when to address mismatches', async () => {
    const receipt = {
      status: 1,
      blockNumber: 100,
      logs: [buildTransferLog(1000000n, { to: '0x0000000000000000000000000000000000000055' })],
    };
    const provider = buildProvider(receipt, 105);

    const result = await verifyPayment({
      txHash: TX_HASH,
      expectedFrom: FROM,
      expectedTo: TO,
      expectedAmount: '1000000',
      tokenAddress: TOKEN_ADDRESS,
      provider,
      minConfirmations: 3,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(PaymentVerificationError);
    }
  });

  it('should fail when amount mismatches', async () => {
    const receipt = {
      status: 1,
      blockNumber: 100,
      logs: [buildTransferLog(999999n)],
    };
    const provider = buildProvider(receipt, 105);

    const result = await verifyPayment({
      txHash: TX_HASH,
      expectedFrom: FROM,
      expectedTo: TO,
      expectedAmount: '1000000',
      tokenAddress: TOKEN_ADDRESS,
      provider,
      minConfirmations: 3,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(PaymentVerificationError);
      expect(result.actualAmount).toBe('999999');
    }
  });

  it('should succeed when transfer matches', async () => {
    const receipt = {
      status: 1,
      blockNumber: 100,
      logs: [buildTransferLog(1000000n)],
    };
    const provider = buildProvider(receipt, 105);

    const result = await verifyPayment({
      txHash: TX_HASH,
      expectedFrom: FROM,
      expectedTo: TO,
      expectedAmount: '1000000',
      tokenAddress: TOKEN_ADDRESS,
      provider,
      minConfirmations: 3,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.actualAmount).toBe('1000000');
      expect(result.confirmations).toBe(6);
    }
  });
});
