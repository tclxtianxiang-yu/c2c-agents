import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { HealthController } from '../health.controller';

const mockGetProvider = jest.fn();

jest.mock('@c2c-agents/shared/chain', () => ({
  getProvider: (...args: unknown[]) => mockGetProvider(...args),
}));

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
      checkHealth: jest.fn().mockResolvedValue({ ok: true }),
    };

    mockGetProvider.mockReturnValue({
      getBlockNumber: jest.fn().mockResolvedValue(123),
    });

    const controller = new HealthController(mockSupabaseService as never);
    const result = await controller.getHealth();

    expect(result.status).toBe('ok');
    expect(result.checks.database.status).toBe('ok');
    expect(result.checks.rpc.status).toBe('ok');
  });

  it('returns degraded when rpc check fails', async () => {
    const mockSupabaseService = {
      checkHealth: jest.fn().mockResolvedValue({ ok: true }),
    };

    mockGetProvider.mockReturnValue({
      getBlockNumber: jest.fn().mockRejectedValue(new Error('RPC down')),
    });

    const controller = new HealthController(mockSupabaseService as never);
    const result = await controller.getHealth();

    expect(result.status).toBe('degraded');
    expect(result.checks.rpc.status).toBe('error');
  });
});
