/**
 * Business Constants
 *
 * 业务常量配置，支持通过环境变量覆盖默认值
 */

// ============================================================
// 辅助函数：安全解析数值
// ============================================================

/**
 * 安全解析环境变量为数字，避免 NaN
 * @param value 环境变量值
 * @param defaultValue 默认值
 * @returns 解析后的数字（如果解析失败则返回默认值）
 */
function parseNumber(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const num = Number(value);
  return Number.isFinite(num) ? num : defaultValue;
}

// ============================================================
// 业务逻辑常量
// ============================================================

/** Pairing 状态 TTL（小时） */
export const PAIRING_TTL_HOURS = parseNumber(process.env.PAIRING_TTL_HOURS, 24);

/** 队列最大容量 N（每个 Agent 最多接 N 个任务） */
export const QUEUE_MAX_N = parseNumber(process.env.QUEUE_MAX_N, 10);

/** 自动验收时长（小时） */
export const AUTO_ACCEPT_HOURS = parseNumber(process.env.AUTO_ACCEPT_HOURS, 24);

/**
 * 平台手续费率（0.15 = 15%）
 *
 * ⚠️ 注意：此常量为 number 类型，可直接传给 calculateFee()
 * @example
 * ```typescript
 * import { PLATFORM_FEE_RATE } from '@c2c-agents/config';
 * import { calculateFee } from '@c2c-agents/shared';
 *
 * const { feeAmount, netAmount } = calculateFee('1000000', PLATFORM_FEE_RATE);
 * ```
 */
export const PLATFORM_FEE_RATE = parseNumber(process.env.PLATFORM_FEE_RATE, 0.15);

/** 最小确认数（链上交易确认数） */
export const MIN_CONFIRMATIONS = parseNumber(process.env.MIN_CONFIRMATIONS, 1);

/** 自动验收扫描间隔（分钟） */
export const AUTO_ACCEPT_SCAN_INTERVAL_MINUTES = parseNumber(
  process.env.AUTO_ACCEPT_SCAN_INTERVAL_MINUTES,
  5
);

/** Gas Price 倍数（用于加速交易确认） */
export const GAS_PRICE_MULTIPLIER = parseNumber(process.env.GAS_PRICE_MULTIPLIER, 1.2);

/** 链上操作最大重试次数 */
export const MAX_RETRIES = parseNumber(process.env.MAX_RETRIES, 3);

// ============================================================
// 链常量（Sepolia 测试网）
// ============================================================

/** Sepolia 测试网 Chain ID */
export const SEPOLIA_CHAIN_ID = 11155111;

/** Sepolia RPC URL（默认使用公共节点） */
export const DEFAULT_SEPOLIA_RPC_URL = 'https://rpc.sepolia.org';

/** Mock USDT 合约地址（从环境变量读取） */
export const MOCK_USDT_ADDRESS = process.env.MOCK_USDT_ADDRESS || '';

/** Escrow 合约地址（从环境变量读取） */
export const ESCROW_ADDRESS = process.env.ESCROW_ADDRESS || '';

/** Gas Limits（合约调用预估值） */
export const GAS_LIMITS = {
  /** USDT approve 操作 */
  APPROVE: 60_000,
  /** Escrow deposit 操作（Task 创建） */
  DEPOSIT: 120_000,
  /** Escrow payout 操作（Agent 收款） */
  PAYOUT: 100_000,
  /** Escrow refund 操作（退款） */
  REFUND: 100_000,
} as const;

/** USDT 代币精度（Sepolia 上的 MockUSDT） */
export const USDT_DECIMALS = 6;

// ============================================================
// 代币单位常量（用于金额转换）
// ============================================================

/** 1 USDT = 1,000,000 最小单位 */
export const ONE_USDT = '1000000';

/** 最小任务金额（1 USDT） */
export const MIN_TASK_REWARD = ONE_USDT;

/** 最大任务金额（100,000 USDT = 100,000,000,000 最小单位） */
export const MAX_TASK_REWARD = '100000000000';
