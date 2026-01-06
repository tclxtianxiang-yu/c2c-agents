import { ContractInteractionError } from '@c2c-agents/shared';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ChainService } from '../chain.service';

const mockVerifyPayment = jest.fn();
const mockExecutePayout = jest.fn();
const mockExecuteRefund = jest.fn();
const mockExecuteRecordEscrow = jest.fn();
const mockGetProvider = jest.fn();

jest.mock('@c2c-agents/shared/chain', () => ({
  verifyPayment: (...args: unknown[]) => mockVerifyPayment(...args),
  executePayout: (...args: unknown[]) => mockExecutePayout(...args),
  executeRefund: (...args: unknown[]) => mockExecuteRefund(...args),
  executeRecordEscrow: (...args: unknown[]) => mockExecuteRecordEscrow(...args),
  getProvider: (...args: unknown[]) => mockGetProvider(...args),
}));

describe('ChainService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CHAIN_RPC_URL = 'https://example.com/rpc';
    process.env.MOCK_USDT_ADDRESS = '0x0000000000000000000000000000000000000001';
    process.env.ESCROW_ADDRESS = '0x0000000000000000000000000000000000000002';
    process.env.PLATFORM_OPERATOR_PRIVATE_KEY =
      '0x0000000000000000000000000000000000000000000000000000000000000001';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

    mockGetProvider.mockReturnValue({
      getBlockNumber: jest.fn(),
    });
  });

  it('returns payout failure when shared executePayout fails', async () => {
    mockExecutePayout.mockResolvedValue({
      success: false,
      orderKey: '0x123',
      error: new ContractInteractionError('fail'),
    });

    const service = new ChainService();
    const result = await service.executePayout({
      orderId: 'order-1',
      creatorAddress: '0x0000000000000000000000000000000000000003',
      providerAddress: '0x0000000000000000000000000000000000000004',
      grossAmount: '1000',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ContractInteractionError);
    }
    expect(mockExecutePayout).toHaveBeenCalledWith(
      expect.objectContaining({
        escrowAddress: process.env.ESCROW_ADDRESS,
        rpcUrl: process.env.CHAIN_RPC_URL,
      })
    );
  });

  it('forwards recordEscrow to shared executeRecordEscrow', async () => {
    mockExecuteRecordEscrow.mockResolvedValue({
      success: true,
      orderKey: '0x456',
      txHash: '0xabc',
      confirmations: 1,
      amount: '1000',
    });

    const service = new ChainService();
    const result = await service.recordEscrow({
      orderId: 'order-2',
      amount: '1000',
    });

    expect(result.success).toBe(true);
    expect(mockExecuteRecordEscrow).toHaveBeenCalledWith(
      expect.objectContaining({
        escrowAddress: process.env.ESCROW_ADDRESS,
        rpcUrl: process.env.CHAIN_RPC_URL,
      })
    );
  });
});
