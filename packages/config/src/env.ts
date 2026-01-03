import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url().optional(),
  CHAIN_RPC_URL: z.string().url().optional(),
  MOCK_USDT_ADDRESS: z.string().startsWith('0x').optional(),
  ESCROW_ADDRESS: z.string().startsWith('0x').optional(),
  PLATFORM_OPERATOR_PRIVATE_KEY: z.string().startsWith('0x').optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  return envSchema.parse(process.env);
}

// 导出单例
export const env = envSchema.parse(process.env);
