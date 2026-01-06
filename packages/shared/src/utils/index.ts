/**
 * Shared Utility Functions
 *
 * 包含金额转换、时间计算、地址验证、UUID 转换等通用工具函数
 */

import Decimal from 'decimal.js';
import { getAddress, keccak256, toBytes } from 'viem';

// ============================================================
// 金额转换工具（基于 decimal.js，确保精度安全）
// ============================================================

/**
 * UI 金额 → 最小单位整数（链上存储格式）
 *
 * @param amount - UI 显示金额（如 "123.45"）
 * @param decimals - 代币精度（USDT 通常为 6）
 * @returns 最小单位整数字符串（如 "123450000"）
 * @throws Error 如果 amount 为负数
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
 * toMinUnit('-10', 6) // => throws Error (负数)
 * ```
 */
export function toMinUnit(amount: string, decimals: number): string {
  // 校验 decimals 参数
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new Error(`Invalid decimals: must be a non-negative integer, got ${decimals}`);
  }

  const decimal = new Decimal(amount);

  // 校验金额非负
  if (decimal.isNegative()) {
    throw new Error(`Amount must be non-negative, got: ${amount}`);
  }

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
 * @throws Error 如果 minUnitAmount 为负数
 * @throws Error 如果 decimals 不是非负整数
 *
 * @example
 * ```typescript
 * fromMinUnit('123450000', 6) // => '123.450000'
 * fromMinUnit('1', 6) // => '0.000001'
 * fromMinUnit('1000000000000000000', 18) // => '1.000000000000000000'
 * fromMinUnit('123', -1) // => throws Error (decimals 非法)
 * fromMinUnit('-100', 6) // => throws Error (负数)
 * ```
 */
export function fromMinUnit(minUnitAmount: string, decimals: number): string {
  // 校验 decimals 参数
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new Error(`Invalid decimals: must be a non-negative integer, got ${decimals}`);
  }

  const decimal = new Decimal(minUnitAmount);

  // 校验金额非负
  if (decimal.isNegative()) {
    throw new Error(`Amount must be non-negative, got: ${minUnitAmount}`);
  }

  const divisor = new Decimal(10).pow(decimals);
  // 使用 toFixed 避免科学计数法输出，确保 UI 友好
  return decimal.div(divisor).toFixed(decimals);
}

/**
 * 计算手续费（平台抽成）
 *
 * @param grossAmount - 总金额（最小单位整数字符串）
 * @param feeRate - 手续费率（0-1 之间的数字，如 0.15 表示 15%）
 * @returns { feeAmount: 手续费, netAmount: 净收入 }
 *
 * @throws Error 如果 grossAmount 为负数
 * @throws Error 如果 feeRate 不在 [0, 1] 范围内
 *
 * @example
 * ```typescript
 * calculateFee('1000000', 0.15) // => { feeAmount: '150000', netAmount: '850000' }
 * calculateFee('1000000', 0) // => { feeAmount: '0', netAmount: '1000000' }
 * ```
 */
export function calculateFee(
  grossAmount: string,
  feeRate: number
): { feeAmount: string; netAmount: string } {
  // 校验 grossAmount 非负
  const gross = new Decimal(grossAmount);
  if (gross.isNegative()) {
    throw new Error(`Gross amount must be non-negative, got: ${grossAmount}`);
  }

  // 校验 feeRate 范围 [0, 1]
  if (!Number.isFinite(feeRate) || feeRate < 0 || feeRate > 1) {
    throw new Error(`Fee rate must be between 0 and 1, got: ${feeRate}`);
  }

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
 * 标准化 EVM 地址（转换为 EIP-55 checksum 格式）
 *
 * ⚠️ **设计决策**:
 * - 使用 viem 的 getAddress() 实现**宽容的格式化**策略
 * - 自动修正错误的 checksum（提升用户体验）
 * - 只在地址格式完全无效时抛错（长度不对、非十六进制等）
 * - 如需严格 checksum 验证，请使用 viem 的 isAddress() 函数
 *
 * @param address - 原始地址（支持全小写、全大写、mixed-case）
 * @returns 标准化地址（EIP-55 checksum 格式）
 *
 * @throws Error 如果地址格式无效（长度、十六进制等）
 *
 * @example
 * ```typescript
 * normalizeAddress('0xabc0000000000000000000000000000000000000')
 * // => '0xAbC0000000000000000000000000000000000000' (checksum)
 *
 * normalizeAddress('0x5aAEb6053f3E94C9b9A09f33669435E7Ef1BeAed') // 错误 checksum
 * // => '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed' (自动修正)
 * ```
 */
export function normalizeAddress(address: string): string {
  try {
    // viem 的 getAddress 会：
    // 1. 验证地址格式（长度、十六进制）
    // 2. 自动修正为正确的 EIP-55 checksum 格式（宽容策略）
    // 3. 只在格式完全无效时抛错
    return getAddress(address);
  } catch {
    throw new Error(`Invalid EVM address: ${address}`);
  }
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
 * ⚠️ **重要**:
 * 1. 使用 keccak256(abi.encodePacked(uuid)) 算法，与合约端保持一致
 * 2. UUID 字符串格式：包含连字符的标准格式（"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"）
 * 3. 合约端必须使用相同的字符串格式（含连字符）进行 keccak256 计算
 * 4. 此函数返回的 bytes32 用作链上 payout/refund 的 settlement key
 *
 * @param uuid - 标准 UUID（含连字符，如 "550e8400-e29b-41d4-a716-446655440000"）
 * @returns bytes32 字符串（keccak256 hash，0x + 64 位十六进制）
 *
 * @throws Error 如果 UUID 格式不正确
 *
 * @example
 * ```typescript
 * // 后端生成 settlement key
 * const orderId = '550e8400-e29b-41d4-a716-446655440000';
 * const settlementKey = uuidToBytes32(orderId);
 * // => '0x...' (keccak256 hash)
 *
 * // 合约端对应 Solidity 代码：
 * // bytes32 orderKey = keccak256(abi.encodePacked("550e8400-e29b-41d4-a716-446655440000"));
 * ```
 */
export function uuidToBytes32(uuid: string): string {
  // 验证 UUID 格式
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(uuid)) {
    throw new Error(`Invalid UUID format: ${uuid}`);
  }

  // 使用 keccak256(abi.encodePacked(uuid)) 算法
  // 注意: abi.encodePacked 对 string 类型是直接 UTF-8 编码
  return keccak256(toBytes(uuid));
}

// ============================================================
// Delivery 验证工具
// ============================================================

/**
 * 验证 Delivery 内容是否有效
 *
 * 业务规则：contentText、externalUrl、attachments 至少一项非空
 * - contentText: 去除首尾空白后必须非空
 * - externalUrl: 去除首尾空白后必须非空
 * - attachments: 数组长度 > 0（可选参数，默认 []）
 *
 * @param delivery - Delivery 对象（包含 contentText, externalUrl, attachments?）
 * @returns true 如果内容有效
 * @throws Error 如果内容无效（包含详细错误信息）
 *
 * @example
 * ```typescript
 * // ✅ 文本内容
 * validateDeliveryContent({
 *   contentText: 'Task completed',
 *   externalUrl: null,
 *   attachments: []
 * });
 *
 * // ✅ 仅附件（attachments 可选）
 * validateDeliveryContent({
 *   contentText: null,
 *   externalUrl: null,
 *   attachments: [{ id: '...', name: 'file.pdf' }]
 * });
 *
 * // ✅ 外链（带空格会被 trim）
 * validateDeliveryContent({
 *   contentText: null,
 *   externalUrl: '  https://example.com/result  ',
 *   // attachments 可省略
 * });
 *
 * // ❌ 空白文本且无其他内容
 * validateDeliveryContent({
 *   contentText: '   ',
 *   externalUrl: null,
 *   attachments: []
 * }); // throws Error
 * ```
 */
export function validateDeliveryContent(delivery: {
  contentText: string | null;
  externalUrl: string | null;
  attachments?: unknown[] | null;
}): true {
  const hasContentText = delivery.contentText !== null && delivery.contentText.trim() !== '';
  const hasExternalUrl = delivery.externalUrl !== null && delivery.externalUrl.trim() !== '';
  const attachments = delivery.attachments ?? [];
  const hasAttachments = attachments.length > 0;

  if (!hasContentText && !hasExternalUrl && !hasAttachments) {
    throw new Error(
      'Delivery content validation failed: at least one of contentText, externalUrl, or attachments must be non-empty'
    );
  }

  return true;
}
