import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../errors';
import {
  calculateFee,
  formatAddress,
  fromMinUnit,
  getRemainingMs,
  isTTLExpired,
  isValidAddress,
  normalizeAddress,
  shouldAutoAccept,
  toMinUnit,
  uuidToBytes32,
  validateDeliveryContent,
} from './index';

describe('金额转换工具', () => {
  describe('toMinUnit', () => {
    it('应该正确转换标准金额', () => {
      expect(toMinUnit('123.45', 6)).toBe('123450000');
      expect(toMinUnit('0.000001', 6)).toBe('1');
      expect(toMinUnit('1', 18)).toBe('1000000000000000000');
    });

    it('应该处理零值', () => {
      expect(toMinUnit('0', 6)).toBe('0');
      expect(toMinUnit('0.0', 6)).toBe('0');
    });

    it('应该处理大额', () => {
      expect(toMinUnit('1000000000', 6)).toBe('1000000000000000');
    });

    it('应该在精度超出时抛错', () => {
      expect(() => toMinUnit('0.0000001', 6)).toThrow('Amount precision exceeds 6 decimals');
      expect(() => toMinUnit('123.4567', 3)).toThrow('Amount precision exceeds 3 decimals');
    });

    it('应该处理科学计数法输入', () => {
      expect(toMinUnit('1e-6', 6)).toBe('1');
      expect(toMinUnit('1.23e2', 2)).toBe('12300');
    });

    it('应该拒绝负数 decimals', () => {
      expect(() => toMinUnit('123', -1)).toThrow(
        'Invalid decimals: must be a non-negative integer'
      );
      expect(() => toMinUnit('123', -10)).toThrow(
        'Invalid decimals: must be a non-negative integer'
      );
    });

    it('应该拒绝小数 decimals', () => {
      expect(() => toMinUnit('123', 6.5)).toThrow(
        'Invalid decimals: must be a non-negative integer'
      );
      expect(() => toMinUnit('123', 1.1)).toThrow(
        'Invalid decimals: must be a non-negative integer'
      );
    });

    it('应该拒绝 NaN decimals', () => {
      expect(() => toMinUnit('123', NaN)).toThrow(
        'Invalid decimals: must be a non-negative integer'
      );
    });

    it('应该拒绝 Infinity decimals', () => {
      expect(() => toMinUnit('123', Infinity)).toThrow(
        'Invalid decimals: must be a non-negative integer'
      );
    });

    it('应该拒绝负数金额', () => {
      expect(() => toMinUnit('-123.45', 6)).toThrow('Amount must be non-negative');
      expect(() => toMinUnit('-0.000001', 6)).toThrow('Amount must be non-negative');
      expect(() => toMinUnit('-1', 18)).toThrow('Amount must be non-negative');
    });
  });

  describe('fromMinUnit', () => {
    it('应该正确转换最小单位', () => {
      expect(fromMinUnit('123450000', 6)).toBe('123.450000');
      expect(fromMinUnit('1', 6)).toBe('0.000001');
      expect(fromMinUnit('1000000000000000000', 18)).toBe('1.000000000000000000');
    });

    it('应该处理零值', () => {
      expect(fromMinUnit('0', 6)).toBe('0.000000');
    });

    it('应该避免科学计数法（使用 toFixed）', () => {
      const result = fromMinUnit('1', 18);
      expect(result).not.toMatch(/e/i);
      expect(result).toBe('0.000000000000000001');
    });

    it('应该处理大额', () => {
      expect(fromMinUnit('1000000000000000', 6)).toBe('1000000000.000000');
    });

    it('应该拒绝负数 decimals', () => {
      expect(() => fromMinUnit('123', -1)).toThrow(
        'Invalid decimals: must be a non-negative integer'
      );
      expect(() => fromMinUnit('123', -10)).toThrow(
        'Invalid decimals: must be a non-negative integer'
      );
    });

    it('应该拒绝小数 decimals', () => {
      expect(() => fromMinUnit('123', 6.5)).toThrow(
        'Invalid decimals: must be a non-negative integer'
      );
      expect(() => fromMinUnit('123', 1.1)).toThrow(
        'Invalid decimals: must be a non-negative integer'
      );
    });

    it('应该拒绝 NaN decimals', () => {
      expect(() => fromMinUnit('123', NaN)).toThrow(
        'Invalid decimals: must be a non-negative integer'
      );
    });

    it('应该拒绝 Infinity decimals', () => {
      expect(() => fromMinUnit('123', Infinity)).toThrow(
        'Invalid decimals: must be a non-negative integer'
      );
    });

    it('应该拒绝负数金额', () => {
      expect(() => fromMinUnit('-123450000', 6)).toThrow('Amount must be non-negative');
      expect(() => fromMinUnit('-1', 6)).toThrow('Amount must be non-negative');
      expect(() => fromMinUnit('-1000000000000000000', 18)).toThrow('Amount must be non-negative');
    });
  });

  describe('calculateFee', () => {
    it('应该正确计算手续费（使用 number 类型费率）', () => {
      const result = calculateFee('1000000', 0.15);
      expect(result.feeAmount).toBe('150000');
      expect(result.netAmount).toBe('850000');
    });

    it('应该向下取整手续费', () => {
      const result = calculateFee('1000001', 0.15);
      expect(result.feeAmount).toBe('150000'); // 150000.15 向下取整
      expect(result.netAmount).toBe('850001');
    });

    it('应该处理零手续费率', () => {
      const result = calculateFee('1000000', 0);
      expect(result.feeAmount).toBe('0');
      expect(result.netAmount).toBe('1000000');
    });

    it('应该处理 100% 手续费率', () => {
      const result = calculateFee('1000000', 1);
      expect(result.feeAmount).toBe('1000000');
      expect(result.netAmount).toBe('0');
    });

    it('应该避免浮点精度问题', () => {
      // 0.15 在二进制浮点中有精度问题，Decimal.js 确保精确计算
      const result = calculateFee('1000000', 0.15);
      expect(result.feeAmount).toBe('150000'); // 精确值
    });

    it('应该拒绝负数总金额', () => {
      expect(() => calculateFee('-1000000', 0.15)).toThrow('Gross amount must be non-negative');
    });

    it('应该拒绝负数费率', () => {
      expect(() => calculateFee('1000000', -0.15)).toThrow('Fee rate must be between 0 and 1');
    });

    it('应该拒绝大于 1 的费率', () => {
      expect(() => calculateFee('1000000', 1.5)).toThrow('Fee rate must be between 0 and 1');
      expect(() => calculateFee('1000000', 2)).toThrow('Fee rate must be between 0 and 1');
    });

    it('应该拒绝 NaN 费率', () => {
      expect(() => calculateFee('1000000', NaN)).toThrow('Fee rate must be between 0 and 1');
    });

    it('应该拒绝 Infinity 费率', () => {
      expect(() => calculateFee('1000000', Infinity)).toThrow('Fee rate must be between 0 and 1');
      expect(() => calculateFee('1000000', -Infinity)).toThrow('Fee rate must be between 0 and 1');
    });
  });
});

describe('时间计算工具', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isTTLExpired', () => {
    it('应该在未过期时返回 false', () => {
      const createdAt = new Date('2026-01-05T10:00:00Z');
      vi.setSystemTime(new Date('2026-01-05T12:00:00Z')); // 2 小时后
      expect(isTTLExpired(createdAt, 3)).toBe(false);
    });

    it('应该在恰好过期时返回 true', () => {
      const createdAt = new Date('2026-01-05T10:00:00Z');
      vi.setSystemTime(new Date('2026-01-05T13:00:00Z')); // 3 小时后
      expect(isTTLExpired(createdAt, 3)).toBe(true);
    });

    it('应该在已过期时返回 true', () => {
      const createdAt = new Date('2026-01-05T10:00:00Z');
      vi.setSystemTime(new Date('2026-01-05T14:00:00Z')); // 4 小时后
      expect(isTTLExpired(createdAt, 3)).toBe(true);
    });

    it('应该支持 ISO 8601 字符串输入', () => {
      const createdAt = '2026-01-05T10:00:00Z';
      vi.setSystemTime(new Date('2026-01-05T14:00:00Z'));
      expect(isTTLExpired(createdAt, 3)).toBe(true);
    });

    it('应该处理 0 小时 TTL', () => {
      const createdAt = new Date('2026-01-05T10:00:00Z');
      vi.setSystemTime(new Date('2026-01-05T10:00:01Z')); // 1 秒后
      expect(isTTLExpired(createdAt, 0)).toBe(true);
    });

    it('应该在非法时间时抛出 ValidationError', () => {
      expect(() => isTTLExpired('invalid-date', 1)).toThrow(ValidationError);
    });
  });

  describe('getRemainingMs', () => {
    it('应该返回正确的剩余毫秒数', () => {
      const createdAt = new Date('2026-01-05T10:00:00Z');
      vi.setSystemTime(new Date('2026-01-05T11:00:00Z')); // 1 小时后
      const remaining = getRemainingMs(createdAt, 3);
      expect(remaining).toBe(2 * 60 * 60 * 1000); // 2 小时
    });

    it('应该在已过期时返回负数', () => {
      const createdAt = new Date('2026-01-05T10:00:00Z');
      vi.setSystemTime(new Date('2026-01-05T14:00:00Z')); // 4 小时后
      const remaining = getRemainingMs(createdAt, 3);
      expect(remaining).toBeLessThan(0);
      expect(remaining).toBe(-1 * 60 * 60 * 1000); // -1 小时
    });

    it('应该支持 ISO 8601 字符串输入', () => {
      const createdAt = '2026-01-05T10:00:00Z';
      vi.setSystemTime(new Date('2026-01-05T11:00:00Z'));
      const remaining = getRemainingMs(createdAt, 3);
      expect(remaining).toBe(2 * 60 * 60 * 1000);
    });

    it('应该在非法时间时抛出 ValidationError', () => {
      expect(() => getRemainingMs('invalid-date', 1)).toThrow(ValidationError);
    });
  });

  describe('shouldAutoAccept', () => {
    it('应该在自动验收时间已到时返回 true', () => {
      const deliveredAt = new Date('2026-01-05T10:00:00Z');
      vi.setSystemTime(new Date('2026-01-08T10:00:00Z')); // 72 小时后
      expect(shouldAutoAccept(deliveredAt, 72)).toBe(true);
    });

    it('应该在自动验收时间未到时返回 false', () => {
      const deliveredAt = new Date('2026-01-05T10:00:00Z');
      vi.setSystemTime(new Date('2026-01-07T10:00:00Z')); // 48 小时后
      expect(shouldAutoAccept(deliveredAt, 72)).toBe(false);
    });

    it('应该使用 isTTLExpired 相同的逻辑', () => {
      const deliveredAt = new Date('2026-01-05T10:00:00Z');
      const autoAcceptHours = 24;
      vi.setSystemTime(new Date('2026-01-06T10:00:00Z'));

      expect(shouldAutoAccept(deliveredAt, autoAcceptHours)).toBe(
        isTTLExpired(deliveredAt, autoAcceptHours)
      );
    });

    it('应该在非法时间时抛出 ValidationError', () => {
      expect(() => shouldAutoAccept('invalid-date', 1)).toThrow(ValidationError);
    });
  });
});

describe('地址验证工具', () => {
  describe('isValidAddress', () => {
    it('应该验证正确的 EVM 地址', () => {
      expect(isValidAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0')).toBe(true);
      expect(isValidAddress('0x0000000000000000000000000000000000000000')).toBe(true);
      expect(isValidAddress('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')).toBe(true);
    });

    it('应该拒绝错误长度的地址', () => {
      expect(isValidAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb')).toBe(false); // 39 位
      expect(isValidAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb00')).toBe(false); // 41 位
    });

    it('应该拒绝无 0x 前缀的地址', () => {
      expect(isValidAddress('742d35Cc6634C0532925a3b844Bc9e7595f0bEb0')).toBe(false);
    });

    it('应该拒绝包含非十六进制字符的地址', () => {
      expect(isValidAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEbG')).toBe(false);
      expect(isValidAddress('0xinvalid00000000000000000000000000000000')).toBe(false);
    });

    it('应该区分大小写（接受混合大小写）', () => {
      expect(isValidAddress('0xAbCdEf0123456789AbCdEf0123456789AbCdEf01')).toBe(true);
    });
  });

  describe('normalizeAddress', () => {
    it('应该返回 EIP-55 checksum 格式地址', () => {
      // viem getAddress 返回正确的 checksum 格式
      const result = normalizeAddress('0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed');
      expect(result).toBe('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed');
    });

    it('应该接受全小写地址并转换为 checksum', () => {
      const result = normalizeAddress('0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed');
      expect(result).toBe('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed');
    });

    it('应该接受全大写地址并转换为 checksum', () => {
      const result = normalizeAddress('0x5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED');
      expect(result).toBe('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed');
    });

    it('应该接受已经是 checksum 格式的地址', () => {
      const checksumAddress = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
      expect(normalizeAddress(checksumAddress)).toBe(checksumAddress);
    });

    it('应该修正错误的 checksum（viem 会自动修正）', () => {
      // viem 会将错误的 checksum 修正为正确的
      const result = normalizeAddress('0x5aAEb6053f3E94C9b9A09f33669435E7Ef1BeAed');
      expect(result).toBe('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed');
    });

    it('应该在无效地址时抛错', () => {
      expect(() => normalizeAddress('0xinvalid')).toThrow('Invalid EVM address');
      expect(() => normalizeAddress('invalid')).toThrow('Invalid EVM address');
      expect(() => normalizeAddress('0x123')).toThrow('Invalid EVM address');
    });

    it('应该保留 0x 前缀', () => {
      const result = normalizeAddress('0xabc0000000000000000000000000000000000000');
      expect(result).toMatch(/^0x/);
      expect(result).toHaveLength(42); // 0x + 40 characters
    });

    it('应该处理零地址', () => {
      const result = normalizeAddress('0x0000000000000000000000000000000000000000');
      expect(result).toBe('0x0000000000000000000000000000000000000000');
    });
  });

  describe('formatAddress', () => {
    it('应该格式化标准地址', () => {
      expect(formatAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0')).toBe('0x742d...bEb0');
    });

    it('应该保留短地址不变', () => {
      expect(formatAddress('0x123')).toBe('0x123');
      expect(formatAddress('short')).toBe('short');
    });

    it('应该取前 6 位和后 4 位', () => {
      const formatted = formatAddress('0xABCDEF1234567890ABCDEF1234567890ABCDEF12');
      expect(formatted.startsWith('0xABCD')).toBe(true);
      expect(formatted.endsWith('EF12')).toBe(true);
      expect(formatted).toContain('...');
    });
  });
});

describe('UUID 转换工具', () => {
  describe('uuidToBytes32', () => {
    it('应该使用 keccak256(abi.encodePacked(uuid)) 算法', () => {
      // 验证返回格式：0x + 64 位十六进制（keccak256 hash）
      const result = uuidToBytes32('550e8400-e29b-41d4-a716-446655440000');
      expect(result).toMatch(/^0x[0-9a-f]{64}$/);
      expect(result).toHaveLength(66); // 0x + 64 位
    });

    it('应该返回确定性的 hash（相同 UUID 返回相同结果）', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const result1 = uuidToBytes32(uuid);
      const result2 = uuidToBytes32(uuid);
      expect(result1).toBe(result2);
    });

    it('应该为不同 UUID 返回不同 hash', () => {
      const result1 = uuidToBytes32('550e8400-e29b-41d4-a716-446655440000');
      const result2 = uuidToBytes32('650e8400-e29b-41d4-a716-446655440000');
      expect(result1).not.toBe(result2);
    });

    it('应该在无效 UUID 格式时抛错', () => {
      expect(() => uuidToBytes32('invalid-uuid')).toThrow('Invalid UUID format');
      expect(() => uuidToBytes32('550e8400-e29b-41d4')).toThrow('Invalid UUID format');
      expect(() => uuidToBytes32('not-a-uuid')).toThrow('Invalid UUID format');
    });

    it('应该支持小写 UUID', () => {
      const result = uuidToBytes32('550e8400-e29b-41d4-a716-446655440000');
      expect(result).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it('应该支持大写 UUID', () => {
      const result = uuidToBytes32('550E8400-E29B-41D4-A716-446655440000');
      expect(result).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it('应该正确处理全零 UUID', () => {
      const result = uuidToBytes32('00000000-0000-0000-0000-000000000000');
      expect(result).toMatch(/^0x[0-9a-f]{64}$/);
      expect(result).toHaveLength(66);
    });

    it('应该正确处理全 F UUID', () => {
      const result = uuidToBytes32('ffffffff-ffff-ffff-ffff-ffffffffffff');
      expect(result).toMatch(/^0x[0-9a-f]{64}$/);
      expect(result).toHaveLength(66);
    });
  });
});

describe('Delivery 验证工具', () => {
  describe('validateDeliveryContent', () => {
    it('应该接受非空文本内容', () => {
      expect(
        validateDeliveryContent({
          contentText: 'Task completed',
          externalUrl: null,
          attachments: [],
        })
      ).toBe(true);
    });

    it('应该接受非空外链', () => {
      expect(
        validateDeliveryContent({
          contentText: null,
          externalUrl: 'https://example.com/result',
          attachments: [],
        })
      ).toBe(true);
    });

    it('应该接受仅附件交付', () => {
      expect(
        validateDeliveryContent({
          contentText: null,
          externalUrl: null,
          attachments: [{ id: 'file-1', name: 'report.pdf' }],
        })
      ).toBe(true);
    });

    it('应该接受多项内容同时存在', () => {
      expect(
        validateDeliveryContent({
          contentText: 'See attached files',
          externalUrl: 'https://example.com/demo',
          attachments: [{ id: 'file-1' }],
        })
      ).toBe(true);
    });

    it('应该拒绝空白文本（仅空格）', () => {
      expect(() =>
        validateDeliveryContent({
          contentText: '   ',
          externalUrl: null,
          attachments: [],
        })
      ).toThrow('Delivery content validation failed');
    });

    it('应该拒绝空白文本（制表符和换行）', () => {
      expect(() =>
        validateDeliveryContent({
          contentText: '\t\n  \n\t',
          externalUrl: null,
          attachments: [],
        })
      ).toThrow('Delivery content validation failed');
    });

    it('应该拒绝空字符串文本', () => {
      expect(() =>
        validateDeliveryContent({
          contentText: '',
          externalUrl: null,
          attachments: [],
        })
      ).toThrow('Delivery content validation failed');
    });

    it('应该拒绝所有内容为空', () => {
      expect(() =>
        validateDeliveryContent({
          contentText: null,
          externalUrl: null,
          attachments: [],
        })
      ).toThrow('Delivery content validation failed');
    });

    it('应该拒绝空字符串外链（视为无效）', () => {
      expect(() =>
        validateDeliveryContent({
          contentText: null,
          externalUrl: '',
          attachments: [],
        })
      ).toThrow('Delivery content validation failed');
    });

    it('应该正确处理 contentText 有空格但有有效字符的情况', () => {
      expect(
        validateDeliveryContent({
          contentText: '  Task done  ',
          externalUrl: null,
          attachments: [],
        })
      ).toBe(true);
    });

    it('应该接受 attachments 为 undefined', () => {
      expect(
        validateDeliveryContent({
          contentText: 'Task completed',
          externalUrl: null,
          attachments: undefined,
        })
      ).toBe(true);
    });

    it('应该接受 attachments 为 null', () => {
      expect(
        validateDeliveryContent({
          contentText: 'Task completed',
          externalUrl: null,
          attachments: null,
        })
      ).toBe(true);
    });

    it('应该拒绝所有内容为空（attachments 为 undefined）', () => {
      expect(() =>
        validateDeliveryContent({
          contentText: null,
          externalUrl: null,
          attachments: undefined,
        })
      ).toThrow('Delivery content validation failed');
    });

    it('应该拒绝所有内容为空（attachments 为 null）', () => {
      expect(() =>
        validateDeliveryContent({
          contentText: null,
          externalUrl: null,
          attachments: null,
        })
      ).toThrow('Delivery content validation failed');
    });

    it('应该拒绝空白 externalUrl（仅空格）', () => {
      expect(() =>
        validateDeliveryContent({
          contentText: null,
          externalUrl: '   ',
          attachments: [],
        })
      ).toThrow('Delivery content validation failed');
    });

    it('应该拒绝空白 externalUrl（制表符和换行）', () => {
      expect(() =>
        validateDeliveryContent({
          contentText: null,
          externalUrl: '\t\n  \n\t',
          attachments: [],
        })
      ).toThrow('Delivery content validation failed');
    });

    it('应该接受带空格的有效 externalUrl', () => {
      expect(
        validateDeliveryContent({
          contentText: null,
          externalUrl: '  https://example.com/result  ',
          attachments: [],
        })
      ).toBe(true);
    });
  });
});
