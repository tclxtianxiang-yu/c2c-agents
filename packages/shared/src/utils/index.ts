/**
 * Shared Utility Functions
 *
 * 包含金额转换、时间计算、地址验证、UUID 转换等通用工具函数
 */

import Decimal from 'decimal.js';

// ============================================================
// 金额转换工具（基于 decimal.js，确保精度安全）
// ============================================================

/**
 * UI 金额 → 最小单位整数（链上存储格式）
 *
 * @param amount - UI 显示金额（如 "123.45"）
 * @param decimals - 代币精度（USDT 通常为 6）
 * @returns 最小单位整数字符串（如 "123450000"）
 * @throws Error 如果转换后有小数部分（精度超出 decimals）
 * @throws Error 如果 decimals 不是非负整数
 *
 * @example
 * ```typescript
 * toMinUnit('123.45', 6) // => '123450000'
 * toMinUnit('0.000001', 6) // => '1'
 * toMinUnit('1', 18) // => '1000000000000000000'
 * toMinUnit('0.0000001', 6) // => throws Error (精度超出)
 * toMinUnit('123', -1) // => throws Error (decimals 非法)
 * ```
 */
export function toMinUnit(amount: string, decimals: number): string {
  // 校验 decimals 参数
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new Error(`Invalid decimals: must be a non-negative integer, got ${decimals}`);
  }

  const decimal = new Decimal(amount);
  const multiplier = new Decimal(10).pow(decimals);
  const result = decimal.mul(multiplier);

  // 检查是否有小数部分（精度超出）
  if (!result.isInteger()) {
    throw new Error(`Amount precision exceeds ${decimals} decimals: ${amount}`);
  }

  // 使用 ROUND_DOWN 确保不会向上取整（避免多收/多付）
  return result.toFixed(0, Decimal.ROUND_DOWN);
}

/**
 * 最小单位整数 → UI 金额（前端显示格式）
 *
 * @param minUnitAmount - 最小单位整数字符串（如 "123450000"）
 * @param decimals - 代币精度（USDT 通常为 6）
 * @returns UI 显示金额（如 "123.45"）
 * @throws Error 如果 decimals 不是非负整数
 *
 * @example
 * ```typescript
 * fromMinUnit('123450000', 6) // => '123.450000'
 * fromMinUnit('1', 6) // => '0.000001'
 * fromMinUnit('1000000000000000000', 18) // => '1.000000000000000000'
 * fromMinUnit('123', -1) // => throws Error (decimals 非法)
 * ```
 */
export function fromMinUnit(minUnitAmount: string, decimals: number): string {
  // 校验 decimals 参数
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new Error(`Invalid decimals: must be a non-negative integer, got ${decimals}`);
  }

  const decimal = new Decimal(minUnitAmount);
  const divisor = new Decimal(10).pow(decimals);
  // 使用 toFixed 避免科学计数法输出，确保 UI 友好
  return decimal.div(divisor).toFixed(decimals);
}

/**
 * 计算手续费（平台抽成）
 *
 * @param grossAmount - 总金额（最小单位整数字符串）
 * @param feeRate - 手续费率字符串（如 "0.15" 表示 15%）
 * @returns { feeAmount: 手续费, netAmount: 净收入 }
 *
 * @example
 * ```typescript
 * calculateFee('1000000', '0.15') // => { feeAmount: '150000', netAmount: '850000' }
 * calculateFee('1000000', '0') // => { feeAmount: '0', netAmount: '1000000' }
 * ```
 */
export function calculateFee(
  grossAmount: string,
  feeRate: string
): { feeAmount: string; netAmount: string } {
  const gross = new Decimal(grossAmount);
  const rate = new Decimal(feeRate);

  const feeAmount = gross.mul(rate).toFixed(0, Decimal.ROUND_DOWN); // 手续费向下取整
  const netAmount = gross.minus(feeAmount).toFixed(0); // 使用 toFixed(0) 避免科学计数法

  return { feeAmount, netAmount };
}

// ============================================================
// 时间计算工具（统一使用 UTC）
// ============================================================

/**
 * 检查 TTL 是否过期
 *
 * @param createdAt - 创建时间（ISO 8601 字符串或 Date 对象）
 * @param ttlHours - TTL 时长（小时）
 * @returns true 表示已过期
 *
 * @example
 * ```typescript
 * const createdAt = new Date('2026-01-05T10:00:00Z');
 * const now = new Date('2026-01-05T14:00:00Z'); // 4 小时后
 * isTTLExpired(createdAt, 3) // => true
 * isTTLExpired(createdAt, 5) // => false
 * ```
 */
export function isTTLExpired(createdAt: string | Date, ttlHours: number): boolean {
  const createdTime = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const expiresAt = new Date(createdTime.getTime() + ttlHours * 60 * 60 * 1000);
  return Date.now() >= expiresAt.getTime();
}

/**
 * 计算距离过期的剩余毫秒数
 *
 * @param createdAt - 创建时间（ISO 8601 字符串或 Date 对象）
 * @param ttlHours - TTL 时长（小时）
 * @returns 剩余毫秒数（负数表示已过期）
 *
 * @example
 * ```typescript
 * const createdAt = new Date('2026-01-05T10:00:00Z');
 * // 假设当前时间 2026-01-05T11:00:00Z（1 小时后）
 * getRemainingMs(createdAt, 3) // => 7200000 (2 小时 = 2 * 60 * 60 * 1000)
 * ```
 */
export function getRemainingMs(createdAt: string | Date, ttlHours: number): number {
  const createdTime = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const expiresAt = new Date(createdTime.getTime() + ttlHours * 60 * 60 * 1000);
  return expiresAt.getTime() - Date.now();
}

/**
 * 检查是否应该自动验收
 *
 * @param deliveredAt - 交付时间（ISO 8601 字符串或 Date 对象）
 * @param autoAcceptHours - 自动验收时长（小时）
 * @returns true 表示应该自动验收
 *
 * @example
 * ```typescript
 * const deliveredAt = new Date('2026-01-05T10:00:00Z');
 * // 假设当前时间 2026-01-08T10:00:00Z（72 小时后）
 * shouldAutoAccept(deliveredAt, 72) // => true
 * shouldAutoAccept(deliveredAt, 96) // => false
 * ```
 */
export function shouldAutoAccept(deliveredAt: string | Date, autoAcceptHours: number): boolean {
  return isTTLExpired(deliveredAt, autoAcceptHours);
}

// ============================================================
// 地址验证工具（EVM 地址）
// ============================================================

/**
 * 验证 EVM 地址格式
 *
 * @param address - 待验证地址
 * @returns true 表示格式正确（0x + 40 位十六进制）
 *
 * @example
 * ```typescript
 * isValidAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb') // => false (39 位)
 * isValidAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0') // => true
 * isValidAddress('0xinvalid') // => false
 * ```
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * 标准化 EVM 地址（转换为 checksum 格式）
 *
 * 注意：当前为简化实现（转小写），生产环境应使用 ethers.js/viem 的 getAddress()
 *
 * @param address - 原始地址
 * @returns 标准化地址（小写）
 *
 * @example
 * ```typescript
 * normalizeAddress('0xABC123') // => '0xabc123'
 * ```
 */
export function normalizeAddress(address: string): string {
  if (!isValidAddress(address)) {
    throw new Error(`Invalid EVM address: ${address}`);
  }
  return address.toLowerCase();
}

/**
 * 格式化地址显示（缩略格式）
 *
 * @param address - 原始地址
 * @returns 缩略格式（0x1234...5678）
 *
 * @example
 * ```typescript
 * formatAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0')
 * // => '0x742d...bEb0'
 * ```
 */
export function formatAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// ============================================================
// UUID 转换工具（用于合约调用）
// ============================================================

/**
 * UUID → bytes32（用于 Solidity 合约参数）
 *
 * @param uuid - 标准 UUID（如 "550e8400-e29b-41d4-a716-446655440000"）
 * @returns bytes32 字符串（0x 前缀 + 64 位十六进制，左侧补零）
 *
 * @example
 * ```typescript
 * uuidToBytes32('550e8400-e29b-41d4-a716-446655440000')
 * // => '0x00000000000000000000000000000000550e8400e29b41d4a716446655440000'
 * ```
 */
export function uuidToBytes32(uuid: string): string {
  // 移除 UUID 中的连字符
  const hex = uuid.replace(/-/g, '');

  if (hex.length !== 32) {
    throw new Error(`Invalid UUID format: ${uuid}`);
  }

  // 左侧补零到 64 位（32 字节 = 64 个十六进制字符）
  // 使用 padStart 确保 UUID 值在 bytes32 的低位（右侧）
  return `0x${hex.padStart(64, '0')}`;
}
