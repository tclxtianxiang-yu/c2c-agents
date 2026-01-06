/**
 * Environment Variables Validation
 *
 * 使用 Zod 校验环境变量，确保类型安全与运行时验证
 */

import { z } from 'zod';

// ============================================================
// 辅助 Schema
// ============================================================

/** EVM 地址 Schema（0x + 40 位十六进制） */
const evmAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM address format');

/** EVM 私钥 Schema（0x + 64 位十六进制） */
const privateKeySchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid private key format');

/** 正整数 Schema */
const positiveIntSchema = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .refine((n) => n > 0, 'Must be a positive integer');

/** 非负整数 Schema */
const nonNegativeIntSchema = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .refine((n) => n >= 0, 'Must be a non-negative integer');

/** 费率 Schema（0-1 之间的数字字符串） */
const feeRateSchema = z
  .string()
  .regex(/^0(\.\d+)?$|^1(\.0+)?$/, 'Fee rate must be between 0 and 1');

// ============================================================
// 环境变量 Schema
// ============================================================

const envSchema = z.object({
  // ========== 通用配置 ==========
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // ========== 数据库配置 ==========
  DATABASE_URL: z.string().url().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // ========== 链配置 ==========
  CHAIN_ID: z.string().default('11155111'), // Sepolia 测试网
  RPC_TIMEOUT_MS: z.string().default('30000'), // RPC 超时时间（毫秒）
  CHAIN_RPC_URL: z.string().url().optional(),
  MOCK_USDT_ADDRESS: evmAddressSchema.optional(),
  ESCROW_ADDRESS: evmAddressSchema.optional(),
  PLATFORM_OPERATOR_PRIVATE_KEY: privateKeySchema.optional(),

  // ========== 业务常量（可选，有默认值） ==========
  PAIRING_TTL_HOURS: positiveIntSchema.optional(),
  QUEUE_MAX_N: positiveIntSchema.optional(),
  AUTO_ACCEPT_HOURS: positiveIntSchema.optional(),
  PLATFORM_FEE_RATE: feeRateSchema.optional(),
  MIN_CONFIRMATIONS: nonNegativeIntSchema.optional(),
  AUTO_ACCEPT_SCAN_INTERVAL_MINUTES: positiveIntSchema.optional(),
  MAX_RETRIES: positiveIntSchema.optional(),
  GAS_PRICE_MULTIPLIER: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .transform(Number)
    .refine((n) => n >= 1, 'Gas price multiplier must be >= 1')
    .optional(),

  // ========== 前端公开配置（NEXT_PUBLIC_ 前缀） ==========
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string().optional(),
  NEXT_PUBLIC_MOCK_USDT_ADDRESS: evmAddressSchema.optional(),
  NEXT_PUBLIC_ESCROW_ADDRESS: evmAddressSchema.optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * 验证环境变量
 *
 * @throws ZodError 如果环境变量格式不正确
 * @returns 解析后的环境变量对象
 */
export function validateEnv(): Env {
  return envSchema.parse(process.env);
}

/**
 * 安全模式验证环境变量（不抛错）
 *
 * @returns { success: true, data: Env } 或 { success: false, error: ZodError }
 */
export function safeValidateEnv() {
  return envSchema.safeParse(process.env);
}

// ============================================================
// 导出单例（延迟初始化，避免在导入时抛错）
// ============================================================

let _env: Env | null = null;

/**
 * 获取环境变量单例
 *
 * 注意：首次访问时会执行校验，如果校验失败会抛出 ZodError
 */
export function getEnv(): Env {
  if (_env === null) {
    _env = validateEnv();
  }
  return _env;
}

/**
 * 重置环境变量缓存（用于测试）
 */
export function resetEnv(): void {
  _env = null;
}

// 默认导出（兼容旧代码）
export const env = new Proxy({} as Env, {
  get(_, prop) {
    return getEnv()[prop as keyof Env];
  },
});
