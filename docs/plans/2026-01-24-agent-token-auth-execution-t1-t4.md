# Agent Token Auth - Tasks 1-4 Execution Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 执行 Agent Token 鉴权功能的前 4 个 Task（数据库 + 共享库基础设施）

**变更说明:** SQL 迁移通过 Supabase MCP 直接部署，不创建本地迁移文件

**Supabase Project:** `c2c_agent` (ID: `dydurrxapjjifztmxmih`)

---

## Task 1: 通过 Supabase MCP 部署数据库迁移

**目标:** 创建 `agent_token_status` 枚举和 `agent_tokens` 表

**Step 1: 部署迁移**

使用 `mcp__plugin_supabase_supabase__apply_migration` 工具执行以下 SQL：

```sql
-- Token status enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'agent_token_status') then
    create type public.agent_token_status as enum ('active', 'revoked', 'expired');
  end if;
end$$;

comment on type public.agent_token_status is
'Agent Token 状态：active=可用; revoked=已吊销; expired=已过期';

-- Agent tokens table
create table if not exists public.agent_tokens (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  token_prefix text not null,
  token_hash text not null,
  name text not null,
  status public.agent_token_status not null default 'active',
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.agent_tokens is
'Agent API Tokens: 用于认证对 Agent mastraUrl 的请求。Token 以 SHA-256 哈希存储以保证安全。';

-- 索引
create index if not exists idx_agent_tokens_agent on public.agent_tokens(agent_id);
create index if not exists idx_agent_tokens_status on public.agent_tokens(status);
create index if not exists idx_agent_tokens_agent_status on public.agent_tokens(agent_id, status);
create unique index if not exists uq_agent_tokens_hash on public.agent_tokens(token_hash);

-- updated_at 触发器
drop trigger if exists trg_agent_tokens_updated_at on public.agent_tokens;
create trigger trg_agent_tokens_updated_at
before update on public.agent_tokens
for each row execute function public.set_updated_at();
```

**Migration 参数:**
- `project_id`: `dydurrxapjjifztmxmih`
- `name`: `add_agent_tokens`

**Step 2: 验证部署**

使用 `mcp__plugin_supabase_supabase__list_tables` 确认 `agent_tokens` 表已创建。

**Step 3: 无需 Commit**（直接部署到云端，不创建本地文件）

---

## Task 2: 添加 AgentTokenStatus 枚举

**Files:**
- Create: `packages/shared/src/enums/agent-token-status.ts`
- Create: `packages/shared/src/enums/agent-token-status.test.ts`
- Modify: `packages/shared/src/enums/index.ts`

**Step 1: 写失败的测试**

```typescript
// packages/shared/src/enums/agent-token-status.test.ts
import { describe, expect, it } from 'vitest';
import { AgentTokenStatus } from './agent-token-status';

describe('AgentTokenStatus', () => {
  it('should have all required status values', () => {
    expect(AgentTokenStatus.Active).toBe('active');
    expect(AgentTokenStatus.Revoked).toBe('revoked');
    expect(AgentTokenStatus.Expired).toBe('expired');
  });

  it('should have exactly 3 status values', () => {
    const values = Object.values(AgentTokenStatus);
    expect(values).toHaveLength(3);
  });
});
```

**Step 2: 运行测试验证失败**

Run: `cd packages/shared && pnpm test agent-token-status`
Expected: FAIL with "Cannot find module"

**Step 3: 创建 AgentTokenStatus 枚举**

```typescript
// packages/shared/src/enums/agent-token-status.ts
/**
 * Agent Token 状态枚举
 * 对应数据库 agent_token_status enum
 */
export enum AgentTokenStatus {
  Active = 'active',
  Revoked = 'revoked',
  Expired = 'expired',
}
```

**Step 4: 导出枚举**

在 `packages/shared/src/enums/index.ts` 添加：

```typescript
export * from './agent-token-status';
```

**Step 5: 运行测试验证通过**

Run: `cd packages/shared && pnpm test agent-token-status`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/shared/src/enums/agent-token-status.ts packages/shared/src/enums/agent-token-status.test.ts packages/shared/src/enums/index.ts
git commit -m "$(cat <<'EOF'
feat(shared): add AgentTokenStatus enum

Add enum for agent token lifecycle states: Active, Revoked, Expired.
Corresponds to database agent_token_status type.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 添加 AgentToken 类型和错误码

**Files:**
- Modify: `packages/shared/src/types/index.ts`
- Modify: `packages/shared/src/errors/index.ts`

**Step 1: 添加 AgentToken 类型**

在 `packages/shared/src/types/index.ts` 文件末尾添加：

```typescript
// ============================================================
// Agent Token Types
// ============================================================

import type { AgentTokenStatus } from '../enums';

/**
 * AgentToken DTO - Agent API Token
 * 用于 Mastra Agent 调用鉴权
 */
export interface AgentToken {
  id: string; // uuid
  agentId: string; // uuid → agents.id

  name: string; // Token 名称（用户自定义）
  tokenPrefix: string; // Token 前 17 字符（UI 展示用）

  status: AgentTokenStatus; // active | revoked | expired

  expiresAt: string | null; // timestamptz → ISO 8601 | null
  lastUsedAt: string | null; // timestamptz → ISO 8601 | null

  createdAt: string; // timestamptz → ISO 8601
  revokedAt: string | null; // timestamptz → ISO 8601 | null
}

/**
 * CreateAgentTokenResponse - 创建 Token 响应
 * rawToken 只在创建时返回一次，之后无法再次获取
 */
export interface CreateAgentTokenResponse {
  token: AgentToken;
  rawToken: string; // 原始 Token（48 字符，cagt_前缀 + 43 字符 base64url）
}
```

**Step 2: 添加错误码**

在 `packages/shared/src/errors/index.ts` 的 `ErrorCode` enum 中添加：

```typescript
  // Agent Token 错误 (6000-6999)
  AGENT_TOKEN_INVALID = 'AGENT_TOKEN_INVALID',
  AGENT_TOKEN_REVOKED = 'AGENT_TOKEN_REVOKED',
  AGENT_TOKEN_EXPIRED = 'AGENT_TOKEN_EXPIRED',
  AGENT_TOKEN_LIMIT_EXCEEDED = 'AGENT_TOKEN_LIMIT_EXCEEDED',
  AGENT_TOKEN_NOT_FOUND = 'AGENT_TOKEN_NOT_FOUND',
```

**Step 3: 运行类型检查**

Run: `cd packages/shared && pnpm typecheck`
Expected: 无错误

**Step 4: Commit**

```bash
git add packages/shared/src/types/index.ts packages/shared/src/errors/index.ts
git commit -m "$(cat <<'EOF'
feat(shared): add AgentToken type and error codes

- Add AgentToken interface with all required fields
- Add CreateAgentTokenResponse for token creation
- Add 5 new error codes for token operations

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 添加 Token 工具函数

**Files:**
- Create: `packages/shared/src/utils/agent-token.ts`
- Create: `packages/shared/src/utils/agent-token.test.ts`
- Create or Modify: `packages/shared/src/utils/index.ts`
- Modify: `packages/shared/src/index.ts` (确保导出)

**Step 1: 写失败的测试**

```typescript
// packages/shared/src/utils/agent-token.test.ts
import { describe, expect, it } from 'vitest';
import {
  generateAgentToken,
  hashAgentToken,
  getTokenPrefix,
  isValidAgentTokenFormat,
} from './agent-token';

describe('generateAgentToken', () => {
  it('should generate a 48-character token', () => {
    const token = generateAgentToken();
    expect(token).toHaveLength(48);
  });

  it('should start with cagt_ prefix', () => {
    const token = generateAgentToken();
    expect(token.startsWith('cagt_')).toBe(true);
  });

  it('should generate unique tokens', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateAgentToken());
    }
    expect(tokens.size).toBe(100);
  });

  it('should only contain valid base64url characters after prefix', () => {
    const token = generateAgentToken();
    const suffix = token.slice(5);
    expect(/^[A-Za-z0-9_-]+$/.test(suffix)).toBe(true);
  });
});

describe('hashAgentToken', () => {
  it('should return a 64-character hex string', () => {
    const token = 'cagt_abcdef123456789012345678901234567890123';
    const hash = hashAgentToken(token);
    expect(hash).toHaveLength(64);
    expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
  });

  it('should produce consistent hash for same input', () => {
    const token = 'cagt_test123456789012345678901234567890123456';
    const hash1 = hashAgentToken(token);
    const hash2 = hashAgentToken(token);
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different inputs', () => {
    const token1 = 'cagt_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const token2 = 'cagt_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    expect(hashAgentToken(token1)).not.toBe(hashAgentToken(token2));
  });
});

describe('getTokenPrefix', () => {
  it('should return first 17 characters', () => {
    const token = 'cagt_abcdef123456789012345678901234567890123';
    const prefix = getTokenPrefix(token);
    expect(prefix).toBe('cagt_abcdef12345');
    expect(prefix).toHaveLength(17);
  });
});

describe('isValidAgentTokenFormat', () => {
  it('should return true for valid tokens', () => {
    const token = generateAgentToken();
    expect(isValidAgentTokenFormat(token)).toBe(true);
  });

  it('should return false for tokens without cagt_ prefix', () => {
    expect(isValidAgentTokenFormat('abcd_123456789012345678901234567890123')).toBe(false);
  });

  it('should return false for tokens with wrong length', () => {
    expect(isValidAgentTokenFormat('cagt_tooshort')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isValidAgentTokenFormat('')).toBe(false);
  });
});
```

**Step 2: 运行测试验证失败**

Run: `cd packages/shared && pnpm test agent-token`
Expected: FAIL with "Cannot find module"

**Step 3: 创建工具函数**

```typescript
// packages/shared/src/utils/agent-token.ts
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
```

**Step 4: 创建或更新 utils/index.ts**

检查 `packages/shared/src/utils/index.ts` 是否存在，如果不存在则创建：

```typescript
// packages/shared/src/utils/index.ts
export * from './agent-token';
```

如果已存在，添加导出行：

```typescript
export * from './agent-token';
```

**Step 5: 确保主入口导出 utils**

检查 `packages/shared/src/index.ts`，确保包含：

```typescript
export * from './utils';
```

**Step 6: 运行测试验证通过**

Run: `cd packages/shared && pnpm test agent-token`
Expected: PASS

**Step 7: Commit**

```bash
git add packages/shared/src/utils/
git commit -m "$(cat <<'EOF'
feat(shared): add agent token utilities

- generateAgentToken(): creates cagt_<base64url> tokens (48 chars)
- hashAgentToken(): SHA-256 hash for secure storage
- getTokenPrefix(): first 17 chars for UI display
- isValidAgentTokenFormat(): validation helper

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Verification After Tasks 1-4

完成 Tasks 1-4 后，执行验证：

```bash
# 1. 构建共享库
cd packages/shared && pnpm build

# 2. 运行所有 shared 包测试
cd packages/shared && pnpm test

# 3. 类型检查
cd packages/shared && pnpm typecheck
```

---

## Summary - Tasks 1-4

| Task | 内容 | 产出 |
|------|------|------|
| 1 | 数据库迁移（Supabase MCP 部署） | `agent_tokens` 表 + `agent_token_status` 枚举 |
| 2 | AgentTokenStatus 枚举 | `packages/shared/src/enums/agent-token-status.ts` |
| 3 | AgentToken 类型 + 错误码 | 类型定义 + 5 个新错误码 |
| 4 | Token 工具函数 | 生成、哈希、验证函数 |

**后续 Tasks 5-11** 将在 API 模块中实现 Repository、Service、Controller、Guard 和测试。
