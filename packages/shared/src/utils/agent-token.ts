import { createHash, randomBytes } from 'node:crypto';

const TOKEN_PREFIX = 'cagt_';
const TOKEN_RANDOM_BYTES = 32;
const TOKEN_TOTAL_LENGTH = 48;
const TOKEN_PREFIX_DISPLAY_LENGTH = 17;

/**
 * 生成 Agent API Token
 * 格式: cagt_<43-char-base64url>
 */
export function generateAgentToken(): string {
  const randomPart = randomBytes(TOKEN_RANDOM_BYTES)
    .toString('base64url')
    .slice(0, TOKEN_TOTAL_LENGTH - TOKEN_PREFIX.length);
  return `${TOKEN_PREFIX}${randomPart}`;
}

/**
 * 计算 Token 的 SHA-256 哈希
 */
export function hashAgentToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * 获取 Token 的展示前缀
 */
export function getTokenPrefix(token: string): string {
  return token.slice(0, TOKEN_PREFIX_DISPLAY_LENGTH);
}

/**
 * 验证 Token 格式是否有效
 */
export function isValidAgentTokenFormat(token: string): boolean {
  if (!token || token.length !== TOKEN_TOTAL_LENGTH) {
    return false;
  }
  if (!token.startsWith(TOKEN_PREFIX)) {
    return false;
  }
  const suffix = token.slice(TOKEN_PREFIX.length);
  return /^[A-Za-z0-9_-]+$/.test(suffix);
}
