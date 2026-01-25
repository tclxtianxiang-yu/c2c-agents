#!/usr/bin/env tsx

/**
 * 自动生成 apps/ 下各项目所需的环境变量文件
 *
 * 用法：
 *   pnpm tsx scripts/generate-env.ts
 *
 * 前置条件：
 *   - 根目录存在 .env 文件
 *
 * 输出：
 *   - apps/api/.env
 *   - apps/web/.env.local
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// 读取根目录 .env 文件
const rootEnvPath = resolve(rootDir, '.env');
if (!existsSync(rootEnvPath)) {
  console.error('❌ 根目录 .env 文件不存在，请先创建或复制 .env.example');
  process.exit(1);
}

const rootEnv = readFileSync(rootEnvPath, 'utf-8');

// 解析环境变量
function parseEnv(content: string): Map<string, string> {
  const env = new Map<string, string>();
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // 跳过注释和空行
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      env.set(key, value);
    }
  }

  return env;
}

// 生成环境变量文件内容
function generateEnvContent(
  variables: string[],
  envMap: Map<string, string>,
  header: string
): string {
  const lines: string[] = [];
  lines.push(`# ${'='.repeat(60)}`);
  lines.push(`# ${header}`);
  lines.push('# 此文件由 scripts/generate-env.ts 自动生成');
  lines.push('# 请勿手动编辑，修改根目录 .env 后重新运行生成脚本');
  lines.push(`# ${'='.repeat(60)}`);
  lines.push('');

  for (const key of variables) {
    const value = envMap.get(key) || '';
    lines.push(`${key}=${value}`);
  }

  return `${lines.join('\n')}\n`;
}

const envMap = parseEnv(rootEnv);

// API 后端需要的环境变量
const apiEnvVars = [
  'NODE_ENV',
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CHAIN_RPC_URL',
  'MOCK_USDT_ADDRESS',
  'ESCROW_ADDRESS',
  'PLATFORM_OPERATOR_PRIVATE_KEY',
  'MIN_CONFIRMATIONS',
  'QUEUE_MAX_N',
  'PAIRING_TTL_HOURS',
  'AUTO_ACCEPT_HOURS',
  'AUTO_ACCEPT_SCAN_INTERVAL_MINUTES',
  'PLATFORM_FEE_RATE',
  'ADMIN_USERNAME',
  'ADMIN_PASSWORD_HASH',
];

// Web 前端需要的环境变量
const webEnvVars = [
  'NEXT_PUBLIC_CHAIN_ID',
  'NEXT_PUBLIC_CHAIN_RPC_URL',
  'NEXT_PUBLIC_MOCK_USDT_ADDRESS',
  'NEXT_PUBLIC_ESCROW_ADDRESS',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID',
  'NEXT_PUBLIC_API_BASE_URL',
  'NEXT_PUBLIC_QUEUE_MAX_N',
];

// 生成 API .env
const apiEnvPath = resolve(rootDir, 'apps/api/.env');
const apiEnvContent = generateEnvContent(apiEnvVars, envMap, 'API Backend Environment Variables');
writeFileSync(apiEnvPath, apiEnvContent);
console.log('✅ 已生成 apps/api/.env');

// 生成 Web .env.local
const webEnvPath = resolve(rootDir, 'apps/web/.env.local');
const webEnvContent = generateEnvContent(webEnvVars, envMap, 'Web Frontend Environment Variables');
writeFileSync(webEnvPath, webEnvContent);
console.log('✅ 已生成 apps/web/.env.local');

// Contracts 项目直接从根目录读取 .env，无需单独生成
console.log('ℹ️  apps/contracts 从根目录 .env 读取配置，无需单独生成');

console.log('\n🎉 环境变量文件生成完成！');
console.log('\n⚠️  提醒：');
console.log('  1. 请确保根目录 .env 中的敏感信息（私钥、密码等）已正确配置');
console.log('  2. 生成的文件已自动添加到 .gitignore，不会被提交到 git');
console.log('  3. 如需修改环境变量，请编辑根目录 .env 后重新运行此脚本');
