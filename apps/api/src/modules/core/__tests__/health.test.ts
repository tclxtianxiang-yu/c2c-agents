import { getProvider } from '@c2c-agents/shared/chain';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { JsonRpcProvider } from 'ethers';
import type { SupabaseService } from '../../../database/supabase.service';
import { HealthController } from '../health.controller';

jest.mock('@c2c-agents/shared/chain');

const mockedGetProvider = jest.mocked(getProvider);

describe('HealthController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CHAIN_RPC_URL = 'https://example.com/rpc';
    process.env.MOCK_USDT_ADDRESS = '0x0000000000000000000000000000000000000001';
    process.env.ESCROW_ADDRESS = '0x0000000000000000000000000000000000000002';
    process.env.PLATFORM_OPERATOR_PRIVATE_KEY =
      '0x0000000000000000000000000000000000000000000000000000000000000001';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  });

  it('returns ok when database and rpc are healthy', async () => {
    const mockSupabaseService = {
      checkHealth: jest.fn<() => Promise<{ ok: boolean }>>(() => Promise.resolve({ ok: true })),
    } as unknown as SupabaseService;

    mockedGetProvider.mockReturnValue({
      getBlockNumber: jest.fn(() => Promise.resolve(123)),
    } as unknown as JsonRpcProvider);

    const controller = new HealthController(mockSupabaseService);
    const result = await controller.getHealth();

    expect(result.status).toBe('ok');
    expect(result.checks.database.status).toBe('ok');
    expect(result.checks.rpc.status).toBe('ok');
  });

  it('returns degraded when rpc check fails', async () => {
    const mockSupabaseService = {
      checkHealth: jest.fn<() => Promise<{ ok: boolean }>>(() => Promise.resolve({ ok: true })),
    } as unknown as SupabaseService;

    mockedGetProvider.mockReturnValue({
      getBlockNumber: jest.fn(() => Promise.reject(new Error('RPC down'))),
    } as unknown as JsonRpcProvider);

    const controller = new HealthController(mockSupabaseService);
    const result = await controller.getHealth();

    expect(result.status).toBe('degraded');
    expect(result.checks.rpc.status).toBe('error');
  });
});
