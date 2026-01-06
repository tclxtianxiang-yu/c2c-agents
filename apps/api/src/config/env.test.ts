import { validateApiEnv } from './env';

const validEnv = {
  CHAIN_RPC_URL: 'https://example.com',
  MOCK_USDT_ADDRESS: `0x${'1'.repeat(40)}`,
  ESCROW_ADDRESS: `0x${'2'.repeat(40)}`,
  PLATFORM_OPERATOR_PRIVATE_KEY: `${'a'.repeat(64)}`,
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
};

describe('validateApiEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, ...validEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('应该拒绝空的 CHAIN_RPC_URL', () => {
    process.env.CHAIN_RPC_URL = '';
    expect(() => validateApiEnv()).toThrow('CHAIN_RPC_URL is required');
  });

  it('应该拒绝零地址', () => {
    process.env.MOCK_USDT_ADDRESS = '0x0000000000000000000000000000000000000000';
    expect(() => validateApiEnv()).toThrow('MOCK_USDT_ADDRESS must not be zero address');
  });

  it('应该拒绝非 http/https 的 CHAIN_RPC_URL', () => {
    process.env.CHAIN_RPC_URL = 'ftp://example.com';
    expect(() => validateApiEnv()).toThrow('CHAIN_RPC_URL must be a valid http/https URL');
  });

  it('应该允许无 0x 前缀的私钥并自动补全', () => {
    const env = validateApiEnv();
    expect(env.operatorPrivateKey.startsWith('0x')).toBe(true);
    expect(env.operatorPrivateKey.length).toBe(66);
  });

  it('应该在参数合法时通过校验', () => {
    process.env.PLATFORM_OPERATOR_PRIVATE_KEY = `0x${'b'.repeat(64)}`;
    const env = validateApiEnv();
    expect(env.chainRpcUrl).toBe(validEnv.CHAIN_RPC_URL);
    expect(env.mockUsdtAddress).toBe(validEnv.MOCK_USDT_ADDRESS);
    expect(env.escrowAddress).toBe(validEnv.ESCROW_ADDRESS);
  });
});
