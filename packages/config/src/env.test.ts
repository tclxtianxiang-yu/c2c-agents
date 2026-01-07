import { describe, expect, it } from 'vitest';
import { safeValidateEnv } from './env';

describe('环境变量校验', () => {
  describe('safeValidateEnv', () => {
    it('应该通过基本的环境变量校验', () => {
      const result = safeValidateEnv();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.NODE_ENV).toBeDefined();
      }
    });
  });

  describe('费率校验', () => {
    it('应该拒绝超出范围的费率', () => {
      const oldEnv = process.env.PLATFORM_FEE_RATE;

      process.env.PLATFORM_FEE_RATE = '1.1';
      expect(safeValidateEnv().success).toBe(false);

      process.env.PLATFORM_FEE_RATE = '-0.1';
      expect(safeValidateEnv().success).toBe(false);

      if (oldEnv === undefined) {
        delete process.env.PLATFORM_FEE_RATE;
      } else {
        process.env.PLATFORM_FEE_RATE = oldEnv;
      }
    });
  });

  describe('正整数校验', () => {
    it('应该拒绝负数', () => {
      const oldEnv = process.env.PAIRING_TTL_HOURS;

      process.env.PAIRING_TTL_HOURS = '-1';
      expect(safeValidateEnv().success).toBe(false);

      if (oldEnv === undefined) {
        delete process.env.PAIRING_TTL_HOURS;
      } else {
        process.env.PAIRING_TTL_HOURS = oldEnv;
      }
    });

    it('应该拒绝小数', () => {
      const oldEnv = process.env.PAIRING_TTL_HOURS;

      process.env.PAIRING_TTL_HOURS = '1.5';
      expect(safeValidateEnv().success).toBe(false);

      if (oldEnv === undefined) {
        delete process.env.PAIRING_TTL_HOURS;
      } else {
        process.env.PAIRING_TTL_HOURS = oldEnv;
      }
    });

    it('应该拒绝零（正整数要求 > 0）', () => {
      const oldEnv = process.env.PAIRING_TTL_HOURS;

      process.env.PAIRING_TTL_HOURS = '0';
      expect(safeValidateEnv().success).toBe(false);

      if (oldEnv === undefined) {
        delete process.env.PAIRING_TTL_HOURS;
      } else {
        process.env.PAIRING_TTL_HOURS = oldEnv;
      }
    });
  });

  describe('非负整数校验', () => {
    it('应该拒绝负数', () => {
      const oldEnv = process.env.MIN_CONFIRMATIONS;

      process.env.MIN_CONFIRMATIONS = '-1';
      expect(safeValidateEnv().success).toBe(false);

      if (oldEnv === undefined) {
        delete process.env.MIN_CONFIRMATIONS;
      } else {
        process.env.MIN_CONFIRMATIONS = oldEnv;
      }
    });
  });

  describe('Gas 倍数校验', () => {
    it('应该拒绝 < 1 的值', () => {
      const oldEnv = process.env.GAS_PRICE_MULTIPLIER;

      process.env.GAS_PRICE_MULTIPLIER = '0.9';
      expect(safeValidateEnv().success).toBe(false);

      if (oldEnv === undefined) {
        delete process.env.GAS_PRICE_MULTIPLIER;
      } else {
        process.env.GAS_PRICE_MULTIPLIER = oldEnv;
      }
    });
  });
});
