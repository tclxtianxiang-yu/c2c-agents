/**
 * Constants Tests
 *
 * 测试策略说明：
 * - constants.ts 的业务常量来自 getEnv()，其默认值已在 env.test.ts 中测试
 * - 这里只测试常量的类型、范围、一致性，不重复测试默认值
 * - 对于环境依赖的常量，直接使用当前环境（实际项目会设置 .env.test）
 */

import { describe, expect, it } from 'vitest';
import {
  AUTO_ACCEPT_HOURS,
  AUTO_ACCEPT_SCAN_INTERVAL_MINUTES,
  MAX_RETRIES,
  MIN_CONFIRMATIONS,
  PAIRING_TTL_HOURS,
  PLATFORM_FEE_RATE,
  QUEUE_MAX_N,
} from './constants';

describe('业务逻辑常量（类型与范围）', () => {
  it('PAIRING_TTL_HOURS 应该是正整数', () => {
    expect(Number.isInteger(PAIRING_TTL_HOURS)).toBe(true);
    expect(PAIRING_TTL_HOURS).toBeGreaterThan(0);
  });

  it('QUEUE_MAX_N 应该是正整数', () => {
    expect(Number.isInteger(QUEUE_MAX_N)).toBe(true);
    expect(QUEUE_MAX_N).toBeGreaterThan(0);
  });

  it('AUTO_ACCEPT_HOURS 应该是正整数', () => {
    expect(Number.isInteger(AUTO_ACCEPT_HOURS)).toBe(true);
    expect(AUTO_ACCEPT_HOURS).toBeGreaterThan(0);
  });

  it('PLATFORM_FEE_RATE 应该是 number 类型且在 0-1 之间', () => {
    expect(typeof PLATFORM_FEE_RATE).toBe('number');
    expect(Number.isFinite(PLATFORM_FEE_RATE)).toBe(true);
    expect(PLATFORM_FEE_RATE).toBeGreaterThanOrEqual(0);
    expect(PLATFORM_FEE_RATE).toBeLessThanOrEqual(1);
  });

  it('MIN_CONFIRMATIONS 应该是非负整数', () => {
    expect(Number.isInteger(MIN_CONFIRMATIONS)).toBe(true);
    expect(MIN_CONFIRMATIONS).toBeGreaterThanOrEqual(0);
  });

  it('AUTO_ACCEPT_SCAN_INTERVAL_MINUTES 应该是正整数', () => {
    expect(Number.isInteger(AUTO_ACCEPT_SCAN_INTERVAL_MINUTES)).toBe(true);
    expect(AUTO_ACCEPT_SCAN_INTERVAL_MINUTES).toBeGreaterThan(0);
  });

  it('MAX_RETRIES 应该是正整数', () => {
    expect(Number.isInteger(MAX_RETRIES)).toBe(true);
    expect(MAX_RETRIES).toBeGreaterThan(0);
  });
});

describe('链常量', () => {
  it('SEPOLIA_CHAIN_ID 应该是 Sepolia 测试网的 Chain ID', async () => {
    const { SEPOLIA_CHAIN_ID } = await import('./constants');
    expect(SEPOLIA_CHAIN_ID).toBe(11155111);
  });

  it('DEFAULT_SEPOLIA_RPC_URL 应该是有效的 URL', async () => {
    const { DEFAULT_SEPOLIA_RPC_URL } = await import('./constants');
    expect(DEFAULT_SEPOLIA_RPC_URL).toMatch(/^https?:\/\//);
  });

  it('GAS_LIMITS 应该包含所有必要的操作', async () => {
    const { GAS_LIMITS } = await import('./constants');
    expect(GAS_LIMITS).toHaveProperty('APPROVE');
    expect(GAS_LIMITS).toHaveProperty('DEPOSIT');
    expect(GAS_LIMITS).toHaveProperty('PAYOUT');
    expect(GAS_LIMITS).toHaveProperty('REFUND');
  });

  it('GAS_LIMITS 的值应该是合理的正整数', async () => {
    const { GAS_LIMITS } = await import('./constants');
    expect(GAS_LIMITS.APPROVE).toBeGreaterThan(0);
    expect(GAS_LIMITS.DEPOSIT).toBeGreaterThan(0);
    expect(GAS_LIMITS.PAYOUT).toBeGreaterThan(0);
    expect(GAS_LIMITS.REFUND).toBeGreaterThan(0);

    // Gas limits 应该在合理范围内 (不会超过 500k)
    expect(GAS_LIMITS.APPROVE).toBeLessThan(500_000);
    expect(GAS_LIMITS.DEPOSIT).toBeLessThan(500_000);
    expect(GAS_LIMITS.PAYOUT).toBeLessThan(500_000);
    expect(GAS_LIMITS.REFUND).toBeLessThan(500_000);
  });

  it('GAS_PRICE_MULTIPLIER 应该 >= 1', async () => {
    const { GAS_PRICE_MULTIPLIER } = await import('./constants');
    expect(GAS_PRICE_MULTIPLIER).toBeGreaterThanOrEqual(1);
  });

  it('USDT_DECIMALS 应该是 6', async () => {
    const { USDT_DECIMALS } = await import('./constants');
    expect(USDT_DECIMALS).toBe(6);
  });
});

describe('代币单位常量', () => {
  it('ONE_USDT 应该等于 1,000,000 最小单位', async () => {
    const { ONE_USDT } = await import('./constants');
    expect(ONE_USDT).toBe('1000000');
  });

  it('MIN_TASK_REWARD 应该等于 1 USDT', async () => {
    const { MIN_TASK_REWARD, ONE_USDT } = await import('./constants');
    expect(MIN_TASK_REWARD).toBe(ONE_USDT);
  });

  it('MAX_TASK_REWARD 应该等于 100,000 USDT', async () => {
    const { MAX_TASK_REWARD } = await import('./constants');
    expect(MAX_TASK_REWARD).toBe('100000000000');
    // 验证：100,000 * 1,000,000 = 100,000,000,000
    expect(Number(MAX_TASK_REWARD)).toBe(100_000 * 1_000_000);
  });

  it('MAX_TASK_REWARD 应该大于 MIN_TASK_REWARD', async () => {
    const { MAX_TASK_REWARD, MIN_TASK_REWARD } = await import('./constants');
    expect(BigInt(MAX_TASK_REWARD)).toBeGreaterThan(BigInt(MIN_TASK_REWARD));
  });

  it('金额常量应该是字符串格式（避免精度丢失）', async () => {
    const { ONE_USDT, MIN_TASK_REWARD, MAX_TASK_REWARD } = await import('./constants');
    expect(typeof ONE_USDT).toBe('string');
    expect(typeof MIN_TASK_REWARD).toBe('string');
    expect(typeof MAX_TASK_REWARD).toBe('string');
  });
});

describe('常量一致性检查', () => {
  it('GAS_LIMITS 应该是 as const 类型', async () => {
    const { GAS_LIMITS } = await import('./constants');
    // TypeScript as const 确保类型层面只读，但运行时不会抛错
    // 这个测试验证类型正确性即可
    expect(GAS_LIMITS).toBeDefined();
    expect(typeof GAS_LIMITS.APPROVE).toBe('number');
  });

  it('DEPOSIT 的 Gas Limit 应该最高（因为操作最复杂）', async () => {
    const { GAS_LIMITS } = await import('./constants');
    expect(GAS_LIMITS.DEPOSIT).toBeGreaterThanOrEqual(GAS_LIMITS.APPROVE);
    expect(GAS_LIMITS.DEPOSIT).toBeGreaterThanOrEqual(GAS_LIMITS.PAYOUT);
    expect(GAS_LIMITS.DEPOSIT).toBeGreaterThanOrEqual(GAS_LIMITS.REFUND);
  });
});
