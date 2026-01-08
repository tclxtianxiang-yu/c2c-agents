import { ContractInteractionError } from '@c2c-agents/shared';
import type { PayoutResult, RecordEscrowResult } from '@c2c-agents/shared/chain';
import { executePayout, executeRecordEscrow, getProvider } from '@c2c-agents/shared/chain';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { JsonRpcProvider } from 'ethers';
import { ChainService } from '../chain.service';

jest.mock('@c2c-agents/shared/chain');

const mockedExecutePayout = jest.mocked(executePayout);
const mockedExecuteRecordEscrow = jest.mocked(executeRecordEscrow);
const mockedGetProvider = jest.mocked(getProvider);

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

    mockedGetProvider.mockReturnValue({
      getBlockNumber: jest.fn(() => Promise.resolve(0)),
    } as unknown as JsonRpcProvider);
  });

  it('returns payout failure when shared executePayout fails', async () => {
    mockedExecutePayout.mockResolvedValue({
      success: false,
      orderKey: '0x123',
      error: new ContractInteractionError('fail'),
    } as PayoutResult);

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
    expect(mockedExecutePayout).toHaveBeenCalledWith(
      expect.objectContaining({
        escrowAddress: process.env.ESCROW_ADDRESS,
        rpcUrl: process.env.CHAIN_RPC_URL,
      })
    );
  });

  it('forwards recordEscrow to shared executeRecordEscrow', async () => {
    mockedExecuteRecordEscrow.mockResolvedValue({
      success: true,
      orderKey: '0x456',
      txHash: '0xabc',
      confirmations: 1,
      amount: '1000',
    } as RecordEscrowResult);

    const service = new ChainService();
    const result = await service.recordEscrow({
      orderId: 'order-2',
      amount: '1000',
    });

    expect(result.success).toBe(true);
    expect(mockedExecuteRecordEscrow).toHaveBeenCalledWith(
      expect.objectContaining({
        escrowAddress: process.env.ESCROW_ADDRESS,
        rpcUrl: process.env.CHAIN_RPC_URL,
      })
    );
  });
});
