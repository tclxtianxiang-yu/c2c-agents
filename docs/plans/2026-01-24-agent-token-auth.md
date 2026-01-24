# Agent Token Authentication Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 Mastra Agent 添加 Token 鉴权机制，确保只有授权的 client 能够调用 Agent，保护 Agent 发布者的财产安全。

**Architecture:** 创建 `agent_tokens` 表存储 Token 哈希（不存储原始 Token），Agent 拥有者可生成、管理和吊销 Token。Client 调用 Agent 时通过 Bearer Token 验证，平台验证后代理转发请求到 Mastra Cloud。

**Tech Stack:** NestJS + Supabase/PostgreSQL + Node.js crypto (SHA-256) + packages/shared 共享类型

---

## SQL Migration 设计

以下是需要添加到数据库的 SQL 语句：

```sql
-- ============================================================
-- Migration: Add Agent Tokens for Mastra URL Authentication
-- File: infra/supabase/migrations/20260124_add_agent_tokens.sql
-- ============================================================

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

  -- 关联关系
  agent_id uuid not null references public.agents(id) on delete cascade,

  -- Token 标识（存储前缀用于 UI 显示，NOT 完整 token）
  token_prefix text not null,       -- e.g., "cagt_abc123..." (前 17 字符)
  token_hash text not null,         -- SHA-256 hash of full token

  -- Token 元数据
  name text not null,               -- 用户定义名称 (e.g., "Production", "Development")

  -- 状态与生命周期
  status public.agent_token_status not null default 'active',

  -- 时间戳
  expires_at timestamptz,           -- 可选过期时间 (null = 永不过期)
  last_used_at timestamptz,         -- 每次成功认证时更新
  revoked_at timestamptz,           -- 吊销时间

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.agent_tokens is
'Agent API Tokens: 用于认证对 Agent mastraUrl 的请求。Token 以 SHA-256 哈希存储以保证安全。';

comment on column public.agent_tokens.id is 'Token 记录 ID';
comment on column public.agent_tokens.agent_id is '关联的 Agent ID';
comment on column public.agent_tokens.token_prefix is 'Token 公开前缀用于识别 (e.g., "cagt_abc123...")，在 UI 中帮助用户识别 Token';
comment on column public.agent_tokens.token_hash is 'Token 的 SHA-256 哈希，原始 Token 永不存储';
comment on column public.agent_tokens.name is '用户定义的 Token 名称用于识别';
comment on column public.agent_tokens.status is 'Token 状态: active/revoked/expired';
comment on column public.agent_tokens.expires_at is '可选过期时间戳 (null = 无过期)';
comment on column public.agent_tokens.last_used_at is '此 Token 最后一次用于认证的时间';
comment on column public.agent_tokens.revoked_at is 'Token 被吊销的时间';
comment on column public.agent_tokens.created_at is '创建时间戳';
comment on column public.agent_tokens.updated_at is '最后更新时间戳（触发器管理）';

-- 索引
create index if not exists idx_agent_tokens_agent on public.agent_tokens(agent_id);
create index if not exists idx_agent_tokens_status on public.agent_tokens(status);
create index if not exists idx_agent_tokens_agent_status on public.agent_tokens(agent_id, status);

-- 唯一约束：hash 在所有 token 中必须唯一
create unique index if not exists uq_agent_tokens_hash on public.agent_tokens(token_hash);

-- updated_at 触发器
drop trigger if exists trg_agent_tokens_updated_at on public.agent_tokens;
create trigger trg_agent_tokens_updated_at
before update on public.agent_tokens
for each row execute function public.set_updated_at();
```

---

## Task 1: 创建数据库迁移文件

**Files:**
- Create: `infra/supabase/migrations/20260124_add_agent_tokens.sql`

**Step 1: 创建迁移文件**

使用上方 SQL Migration 设计中的完整 SQL。

**Step 2: 运行验证（本地 Supabase）**

Run: `cd infra/supabase && supabase start && supabase db reset`
Expected: 迁移成功应用，无错误

**Step 3: Commit**

```bash
git add infra/supabase/migrations/20260124_add_agent_tokens.sql
git commit -m "$(cat <<'EOF'
feat(db): add agent_tokens table for Mastra API authentication

- Add agent_token_status enum (active, revoked, expired)
- Create agent_tokens table with SHA-256 hash storage
- Add indexes for efficient token lookup and agent filtering

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

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
- Modify: `packages/shared/src/utils/index.ts`（如果存在）或创建

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

**Step 4: 确保导出**

检查 `packages/shared/src/utils/index.ts` 是否存在，如果不存在则创建：

```typescript
// packages/shared/src/utils/index.ts
export * from './agent-token';
```

如果已存在，添加导出行：

```typescript
export * from './agent-token';
```

**Step 5: 运行测试验证通过**

Run: `cd packages/shared && pnpm test agent-token`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/shared/src/utils/agent-token.ts packages/shared/src/utils/agent-token.test.ts packages/shared/src/utils/index.ts
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

## Task 5: 创建 AgentTokenRepository

**Files:**
- Create: `apps/api/src/modules/agent/agent-token.repository.ts`

**Step 1: 创建 Repository**

```typescript
// apps/api/src/modules/agent/agent-token.repository.ts
import type { AgentToken } from '@c2c-agents/shared';
import { AgentTokenStatus } from '@c2c-agents/shared';
import { Inject, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';

const AGENT_TOKENS_TABLE = 'agent_tokens';

const TOKEN_SELECT_FIELDS = `
  id,
  agent_id,
  name,
  token_prefix,
  status,
  expires_at,
  last_used_at,
  created_at,
  revoked_at
`;

type AgentTokenRow = {
  id: string;
  agent_id: string;
  name: string;
  token_prefix: string;
  status: AgentTokenStatus;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
};

export type CreateAgentTokenInput = {
  agentId: string;
  name: string;
  tokenHash: string;
  tokenPrefix: string;
  expiresAt?: Date | null;
};

function toAgentToken(row: AgentTokenRow): AgentToken {
  return {
    id: row.id,
    agentId: row.agent_id,
    name: row.name,
    tokenPrefix: row.token_prefix,
    status: row.status,
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
  };
}

function ensureNoError(error: unknown, context: string): void {
  if (!error) return;
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(`${context}: ${message}`);
}

@Injectable()
export class AgentTokenRepository {
  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  async create(input: CreateAgentTokenInput): Promise<AgentToken> {
    const { data, error } = await this.supabase
      .query<AgentTokenRow>(AGENT_TOKENS_TABLE)
      .insert({
        agent_id: input.agentId,
        name: input.name,
        token_hash: input.tokenHash,
        token_prefix: input.tokenPrefix,
        expires_at: input.expiresAt?.toISOString() ?? null,
      })
      .select(TOKEN_SELECT_FIELDS)
      .single();

    ensureNoError(error, 'Failed to create agent token');
    if (!data) throw new Error('Failed to create agent token: empty response');

    return toAgentToken(data);
  }

  async findByHash(tokenHash: string): Promise<AgentToken | null> {
    const { data, error } = await this.supabase
      .query<AgentTokenRow & { token_hash: string }>(AGENT_TOKENS_TABLE)
      .select(`${TOKEN_SELECT_FIELDS}`)
      .eq('token_hash', tokenHash)
      .maybeSingle();

    ensureNoError(error, 'Failed to find token by hash');
    if (!data) return null;

    return toAgentToken(data);
  }

  async findById(tokenId: string): Promise<AgentToken | null> {
    const { data, error } = await this.supabase
      .query<AgentTokenRow>(AGENT_TOKENS_TABLE)
      .select(TOKEN_SELECT_FIELDS)
      .eq('id', tokenId)
      .maybeSingle();

    ensureNoError(error, 'Failed to find token by id');
    if (!data) return null;

    return toAgentToken(data);
  }

  async findByAgentId(agentId: string): Promise<AgentToken[]> {
    const { data, error } = await this.supabase
      .query<AgentTokenRow>(AGENT_TOKENS_TABLE)
      .select(TOKEN_SELECT_FIELDS)
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    ensureNoError(error, 'Failed to find tokens by agent id');

    return (data ?? []).map(toAgentToken);
  }

  async countActiveByAgentId(agentId: string): Promise<number> {
    const { count, error } = await this.supabase
      .query(AGENT_TOKENS_TABLE)
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('status', 'active');

    ensureNoError(error, 'Failed to count active tokens');

    return count ?? 0;
  }

  async revoke(tokenId: string): Promise<AgentToken> {
    const { data, error } = await this.supabase
      .query<AgentTokenRow>(AGENT_TOKENS_TABLE)
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
      })
      .eq('id', tokenId)
      .select(TOKEN_SELECT_FIELDS)
      .single();

    ensureNoError(error, 'Failed to revoke token');
    if (!data) throw new Error('Failed to revoke token: empty response');

    return toAgentToken(data);
  }

  async updateLastUsed(tokenId: string): Promise<void> {
    const { error } = await this.supabase
      .query(AGENT_TOKENS_TABLE)
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', tokenId);

    if (error) {
      console.warn(`[AgentTokenRepository] Failed to update last_used_at for token ${tokenId}:`, error);
    }
  }
}
```

**Step 2: Commit**

```bash
git add apps/api/src/modules/agent/agent-token.repository.ts
git commit -m "$(cat <<'EOF'
feat(api): add AgentTokenRepository

CRUD operations for agent_tokens table:
- create(): insert new token with hash
- findByHash(): lookup for verification
- findById(): lookup for management
- findByAgentId(): list agent's tokens
- countActiveByAgentId(): enforce token limits
- revoke(): set status to revoked
- updateLastUsed(): async last_used_at update

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 创建 AgentTokenService

**Files:**
- Create: `apps/api/src/modules/agent/dtos/create-agent-token.dto.ts`
- Create: `apps/api/src/modules/agent/agent-token.service.ts`

**Step 1: 创建 DTO**

```typescript
// apps/api/src/modules/agent/dtos/create-agent-token.dto.ts
export class CreateAgentTokenDto {
  name: string;
  expiresInDays?: number;
}
```

**Step 2: 创建 Service**

```typescript
// apps/api/src/modules/agent/agent-token.service.ts
import {
  AgentTokenStatus,
  ErrorCode,
  ValidationError,
  generateAgentToken,
  getTokenPrefix,
  hashAgentToken,
  isValidAgentTokenFormat,
} from '@c2c-agents/shared';
import type { AgentToken, CreateAgentTokenResponse } from '@c2c-agents/shared';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { AgentRepository } from './agent.repository';
import { AgentTokenRepository } from './agent-token.repository';
import type { CreateAgentTokenDto } from './dtos/create-agent-token.dto';

const MAX_TOKENS_PER_AGENT = 10;

@Injectable()
export class AgentTokenService {
  constructor(
    @Inject(AgentTokenRepository) private readonly tokenRepository: AgentTokenRepository,
    @Inject(AgentRepository) private readonly agentRepository: AgentRepository
  ) {}

  async createToken(
    userId: string,
    agentId: string,
    dto: CreateAgentTokenDto
  ): Promise<CreateAgentTokenResponse> {
    const agent = await this.agentRepository.findAgentById(agentId);
    if (!agent) {
      throw new HttpException(
        { code: ErrorCode.BUSINESS_RESOURCE_NOT_FOUND, message: 'Agent not found' },
        404
      );
    }

    if (agent.ownerId !== userId) {
      throw new HttpException(
        { code: ErrorCode.AUTH_FORBIDDEN, message: 'Agent does not belong to current user' },
        403
      );
    }

    if (!dto.name || dto.name.trim().length === 0) {
      throw new ValidationError('Token name is required');
    }

    if (dto.name.trim().length > 100) {
      throw new ValidationError('Token name must be 100 characters or less');
    }

    if (dto.expiresInDays !== undefined && dto.expiresInDays !== null) {
      if (!Number.isInteger(dto.expiresInDays) || dto.expiresInDays <= 0) {
        throw new ValidationError('expiresInDays must be a positive integer');
      }
      if (dto.expiresInDays > 365) {
        throw new ValidationError('expiresInDays must be 365 days or less');
      }
    }

    const activeCount = await this.tokenRepository.countActiveByAgentId(agentId);
    if (activeCount >= MAX_TOKENS_PER_AGENT) {
      throw new HttpException(
        {
          code: ErrorCode.AGENT_TOKEN_LIMIT_EXCEEDED,
          message: `Maximum ${MAX_TOKENS_PER_AGENT} active tokens per agent`,
        },
        400
      );
    }

    const rawToken = generateAgentToken();
    const tokenHash = hashAgentToken(rawToken);
    const tokenPrefix = getTokenPrefix(rawToken);

    let expiresAt: Date | null = null;
    if (dto.expiresInDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + dto.expiresInDays);
    }

    const token = await this.tokenRepository.create({
      agentId,
      name: dto.name.trim(),
      tokenHash,
      tokenPrefix,
      expiresAt,
    });

    return { token, rawToken };
  }

  async listTokens(userId: string, agentId: string): Promise<AgentToken[]> {
    const agent = await this.agentRepository.findAgentById(agentId);
    if (!agent) {
      throw new HttpException(
        { code: ErrorCode.BUSINESS_RESOURCE_NOT_FOUND, message: 'Agent not found' },
        404
      );
    }

    if (agent.ownerId !== userId) {
      throw new HttpException(
        { code: ErrorCode.AUTH_FORBIDDEN, message: 'Agent does not belong to current user' },
        403
      );
    }

    return this.tokenRepository.findByAgentId(agentId);
  }

  async getToken(userId: string, agentId: string, tokenId: string): Promise<AgentToken> {
    const agent = await this.agentRepository.findAgentById(agentId);
    if (!agent) {
      throw new HttpException(
        { code: ErrorCode.BUSINESS_RESOURCE_NOT_FOUND, message: 'Agent not found' },
        404
      );
    }

    if (agent.ownerId !== userId) {
      throw new HttpException(
        { code: ErrorCode.AUTH_FORBIDDEN, message: 'Agent does not belong to current user' },
        403
      );
    }

    const token = await this.tokenRepository.findById(tokenId);
    if (!token || token.agentId !== agentId) {
      throw new HttpException(
        { code: ErrorCode.AGENT_TOKEN_NOT_FOUND, message: 'Token not found' },
        404
      );
    }

    return token;
  }

  async revokeToken(userId: string, agentId: string, tokenId: string): Promise<AgentToken> {
    const agent = await this.agentRepository.findAgentById(agentId);
    if (!agent) {
      throw new HttpException(
        { code: ErrorCode.BUSINESS_RESOURCE_NOT_FOUND, message: 'Agent not found' },
        404
      );
    }

    if (agent.ownerId !== userId) {
      throw new HttpException(
        { code: ErrorCode.AUTH_FORBIDDEN, message: 'Agent does not belong to current user' },
        403
      );
    }

    const token = await this.tokenRepository.findById(tokenId);
    if (!token || token.agentId !== agentId) {
      throw new HttpException(
        { code: ErrorCode.AGENT_TOKEN_NOT_FOUND, message: 'Token not found' },
        404
      );
    }

    if (token.status === AgentTokenStatus.Revoked) {
      throw new HttpException(
        { code: ErrorCode.AGENT_TOKEN_REVOKED, message: 'Token is already revoked' },
        400
      );
    }

    return this.tokenRepository.revoke(tokenId);
  }

  async verifyToken(rawToken: string, agentId: string): Promise<AgentToken> {
    if (!isValidAgentTokenFormat(rawToken)) {
      throw new HttpException(
        { code: ErrorCode.AGENT_TOKEN_INVALID, message: 'Invalid token format' },
        401
      );
    }

    const tokenHash = hashAgentToken(rawToken);
    const token = await this.tokenRepository.findByHash(tokenHash);

    if (!token) {
      throw new HttpException(
        { code: ErrorCode.AGENT_TOKEN_INVALID, message: 'Invalid token' },
        401
      );
    }

    if (token.agentId !== agentId) {
      throw new HttpException(
        { code: ErrorCode.AGENT_TOKEN_INVALID, message: 'Token does not match agent' },
        401
      );
    }

    if (token.status === AgentTokenStatus.Revoked) {
      throw new HttpException(
        { code: ErrorCode.AGENT_TOKEN_REVOKED, message: 'Token has been revoked' },
        401
      );
    }

    if (token.expiresAt) {
      const expiresAt = new Date(token.expiresAt);
      if (expiresAt < new Date()) {
        throw new HttpException(
          { code: ErrorCode.AGENT_TOKEN_EXPIRED, message: 'Token has expired' },
          401
        );
      }
    }

    this.tokenRepository.updateLastUsed(token.id).catch((err) => {
      console.warn('[AgentTokenService] Failed to update last_used_at:', err);
    });

    return token;
  }
}
```

**Step 3: Commit**

```bash
git add apps/api/src/modules/agent/dtos/create-agent-token.dto.ts apps/api/src/modules/agent/agent-token.service.ts
git commit -m "$(cat <<'EOF'
feat(api): add AgentTokenService

Business logic for agent token operations:
- createToken(): generate + store with ownership check
- listTokens(): list agent's tokens
- getToken(): fetch single token
- revokeToken(): mark as revoked
- verifyToken(): validate for API auth

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 创建 AgentTokenController

**Files:**
- Create: `apps/api/src/modules/agent/agent-token.controller.ts`

**Step 1: 创建 Controller**

```typescript
// apps/api/src/modules/agent/agent-token.controller.ts
import type { AgentToken, CreateAgentTokenResponse } from '@c2c-agents/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { AgentTokenService } from './agent-token.service';
import type { CreateAgentTokenDto } from './dtos/create-agent-token.dto';

@Controller('agents/:agentId/tokens')
export class AgentTokenController {
  constructor(@Inject(AgentTokenService) private readonly tokenService: AgentTokenService) {}

  @Post()
  async createToken(
    @Headers('x-user-id') userId: string,
    @Param('agentId') agentId: string,
    @Body() dto: CreateAgentTokenDto
  ): Promise<CreateAgentTokenResponse> {
    return this.tokenService.createToken(userId, agentId, dto);
  }

  @Get()
  async listTokens(
    @Headers('x-user-id') userId: string,
    @Param('agentId') agentId: string
  ): Promise<AgentToken[]> {
    return this.tokenService.listTokens(userId, agentId);
  }

  @Get(':tokenId')
  async getToken(
    @Headers('x-user-id') userId: string,
    @Param('agentId') agentId: string,
    @Param('tokenId') tokenId: string
  ): Promise<AgentToken> {
    return this.tokenService.getToken(userId, agentId, tokenId);
  }

  @Delete(':tokenId')
  @HttpCode(200)
  async revokeToken(
    @Headers('x-user-id') userId: string,
    @Param('agentId') agentId: string,
    @Param('tokenId') tokenId: string
  ): Promise<AgentToken> {
    return this.tokenService.revokeToken(userId, agentId, tokenId);
  }
}
```

**Step 2: Commit**

```bash
git add apps/api/src/modules/agent/agent-token.controller.ts
git commit -m "$(cat <<'EOF'
feat(api): add AgentTokenController

RESTful endpoints for token management:
- POST /agents/:agentId/tokens - create token
- GET /agents/:agentId/tokens - list tokens
- GET /agents/:agentId/tokens/:tokenId - get token
- DELETE /agents/:agentId/tokens/:tokenId - revoke token

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 创建 AgentTokenGuard

**Files:**
- Create: `apps/api/src/modules/agent/guards/agent-token.guard.ts`

**Step 1: 创建 Guard**

```typescript
// apps/api/src/modules/agent/guards/agent-token.guard.ts
import { ErrorCode } from '@c2c-agents/shared';
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { AgentTokenService } from '../agent-token.service';

@Injectable()
export class AgentTokenGuard implements CanActivate {
  constructor(@Inject(AgentTokenService) private readonly tokenService: AgentTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const authHeader = request.headers.authorization;
    if (!authHeader) {
      throw new HttpException(
        { code: ErrorCode.AUTH_UNAUTHORIZED, message: 'Missing Authorization header' },
        401
      );
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      throw new HttpException(
        { code: ErrorCode.AUTH_UNAUTHORIZED, message: 'Invalid Authorization format. Expected: Bearer <token>' },
        401
      );
    }

    const rawToken = parts[1];

    const agentId = request.params.agentId;
    if (!agentId) {
      throw new HttpException(
        { code: ErrorCode.VALIDATION_FAILED, message: 'Missing agentId in route' },
        400
      );
    }

    const agentToken = await this.tokenService.verifyToken(rawToken, agentId);

    (request as Request & { agentToken: typeof agentToken }).agentToken = agentToken;

    return true;
  }
}
```

**Step 2: Commit**

```bash
git add apps/api/src/modules/agent/guards/agent-token.guard.ts
git commit -m "$(cat <<'EOF'
feat(api): add AgentTokenGuard

NestJS guard for Bearer token authentication:
- Extracts token from Authorization header
- Validates Bearer format
- Calls AgentTokenService.verifyToken()
- Attaches AgentToken to request for downstream use

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: 更新 AgentModule

**Files:**
- Modify: `apps/api/src/modules/agent/agent.module.ts`

**Step 1: 读取当前模块内容**

先读取 `apps/api/src/modules/agent/agent.module.ts` 了解当前结构。

**Step 2: 更新模块**

在模块中注册新的 Controller, Service, Repository, Guard：

```typescript
// apps/api/src/modules/agent/agent.module.ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AgentController } from './agent.controller';
import { AgentRepository } from './agent.repository';
import { AgentService } from './agent.service';
import { AgentTokenController } from './agent-token.controller';
import { AgentTokenRepository } from './agent-token.repository';
import { AgentTokenService } from './agent-token.service';
import { AgentTokenGuard } from './guards/agent-token.guard';

@Module({
  imports: [DatabaseModule],
  controllers: [AgentController, AgentTokenController],
  providers: [
    AgentService,
    AgentRepository,
    AgentTokenService,
    AgentTokenRepository,
    AgentTokenGuard,
  ],
  exports: [AgentService, AgentTokenService, AgentTokenGuard],
})
export class AgentModule {}
```

**Step 3: Commit**

```bash
git add apps/api/src/modules/agent/agent.module.ts
git commit -m "$(cat <<'EOF'
feat(api): register AgentToken components in module

- Add AgentTokenController
- Add AgentTokenService
- Add AgentTokenRepository
- Add AgentTokenGuard
- Export AgentTokenService and AgentTokenGuard

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: 编写单元测试

**Files:**
- Create: `apps/api/src/modules/agent/__tests__/agent-token.service.spec.ts`

**Step 1: 编写测试**

```typescript
// apps/api/src/modules/agent/__tests__/agent-token.service.spec.ts
import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AgentTokenStatus, ErrorCode } from '@c2c-agents/shared';
import { AgentTokenService } from '../agent-token.service';
import { AgentTokenRepository } from '../agent-token.repository';
import { AgentRepository } from '../agent.repository';

describe('AgentTokenService', () => {
  let service: AgentTokenService;
  let tokenRepository: jest.Mocked<AgentTokenRepository>;
  let agentRepository: jest.Mocked<AgentRepository>;

  const mockAgent = {
    id: 'agent-uuid',
    ownerId: 'user-uuid',
    name: 'Test Agent',
    description: 'A test agent',
    avatarUrl: null,
    mastraUrl: 'https://mastra.cloud/agent/test',
    tags: [],
    supportedTaskTypes: ['code' as const],
    minPrice: '1000000',
    maxPrice: '10000000',
    avgRating: 0,
    ratingCount: 0,
    completedOrderCount: 0,
    status: 'Idle' as const,
    currentOrderId: null,
    queueSize: 0,
    isListed: true,
    createdAt: '2026-01-24T00:00:00Z',
    updatedAt: '2026-01-24T00:00:00Z',
  };

  const mockToken = {
    id: 'token-uuid',
    agentId: 'agent-uuid',
    name: 'Test Token',
    tokenPrefix: 'cagt_abc123def45',
    status: AgentTokenStatus.Active,
    expiresAt: null,
    lastUsedAt: null,
    createdAt: '2026-01-24T00:00:00Z',
    revokedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentTokenService,
        {
          provide: AgentTokenRepository,
          useValue: {
            create: jest.fn(),
            findByHash: jest.fn(),
            findById: jest.fn(),
            findByAgentId: jest.fn(),
            countActiveByAgentId: jest.fn(),
            revoke: jest.fn(),
            updateLastUsed: jest.fn(),
          },
        },
        {
          provide: AgentRepository,
          useValue: {
            findAgentById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AgentTokenService>(AgentTokenService);
    tokenRepository = module.get(AgentTokenRepository);
    agentRepository = module.get(AgentRepository);
  });

  describe('createToken', () => {
    it('should create a token successfully', async () => {
      agentRepository.findAgentById.mockResolvedValue(mockAgent);
      tokenRepository.countActiveByAgentId.mockResolvedValue(0);
      tokenRepository.create.mockResolvedValue(mockToken);

      const result = await service.createToken('user-uuid', 'agent-uuid', {
        name: 'My Token',
      });

      expect(result.token).toEqual(mockToken);
      expect(result.rawToken).toHaveLength(48);
      expect(result.rawToken.startsWith('cagt_')).toBe(true);
    });

    it('should throw 404 if agent not found', async () => {
      agentRepository.findAgentById.mockResolvedValue(null);

      await expect(
        service.createToken('user-uuid', 'agent-uuid', { name: 'Test' })
      ).rejects.toThrow(HttpException);
    });

    it('should throw 403 if user does not own agent', async () => {
      agentRepository.findAgentById.mockResolvedValue({
        ...mockAgent,
        ownerId: 'other-user-uuid',
      });

      await expect(
        service.createToken('user-uuid', 'agent-uuid', { name: 'Test' })
      ).rejects.toThrow(HttpException);
    });

    it('should throw if token limit exceeded', async () => {
      agentRepository.findAgentById.mockResolvedValue(mockAgent);
      tokenRepository.countActiveByAgentId.mockResolvedValue(10);

      try {
        await service.createToken('user-uuid', 'agent-uuid', { name: 'Test' });
        fail('Expected exception');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(400);
      }
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', async () => {
      tokenRepository.findByHash.mockResolvedValue(mockToken);
      tokenRepository.updateLastUsed.mockResolvedValue(undefined);

      const result = await service.verifyToken(
        'cagt_validtoken123456789012345678901234567890123',
        'agent-uuid'
      );

      expect(result).toEqual(mockToken);
    });

    it('should throw for invalid format', async () => {
      await expect(
        service.verifyToken('invalid', 'agent-uuid')
      ).rejects.toThrow(HttpException);
    });

    it('should throw for unknown token', async () => {
      tokenRepository.findByHash.mockResolvedValue(null);

      await expect(
        service.verifyToken(
          'cagt_unknown123456789012345678901234567890123',
          'agent-uuid'
        )
      ).rejects.toThrow(HttpException);
    });

    it('should throw for revoked token', async () => {
      tokenRepository.findByHash.mockResolvedValue({
        ...mockToken,
        status: AgentTokenStatus.Revoked,
      });

      await expect(
        service.verifyToken(
          'cagt_revoked123456789012345678901234567890123',
          'agent-uuid'
        )
      ).rejects.toThrow(HttpException);
    });

    it('should throw for expired token', async () => {
      tokenRepository.findByHash.mockResolvedValue({
        ...mockToken,
        expiresAt: '2020-01-01T00:00:00Z',
      });

      await expect(
        service.verifyToken(
          'cagt_expired123456789012345678901234567890123',
          'agent-uuid'
        )
      ).rejects.toThrow(HttpException);
    });

    it('should throw for wrong agent', async () => {
      tokenRepository.findByHash.mockResolvedValue({
        ...mockToken,
        agentId: 'other-agent-uuid',
      });

      await expect(
        service.verifyToken(
          'cagt_wrongagent12345678901234567890123456789',
          'agent-uuid'
        )
      ).rejects.toThrow(HttpException);
    });
  });

  describe('revokeToken', () => {
    it('should revoke a token successfully', async () => {
      agentRepository.findAgentById.mockResolvedValue(mockAgent);
      tokenRepository.findById.mockResolvedValue(mockToken);
      tokenRepository.revoke.mockResolvedValue({
        ...mockToken,
        status: AgentTokenStatus.Revoked,
        revokedAt: '2026-01-24T12:00:00Z',
      });

      const result = await service.revokeToken('user-uuid', 'agent-uuid', 'token-uuid');

      expect(result.status).toBe(AgentTokenStatus.Revoked);
      expect(result.revokedAt).toBeTruthy();
    });

    it('should throw if token already revoked', async () => {
      agentRepository.findAgentById.mockResolvedValue(mockAgent);
      tokenRepository.findById.mockResolvedValue({
        ...mockToken,
        status: AgentTokenStatus.Revoked,
      });

      await expect(
        service.revokeToken('user-uuid', 'agent-uuid', 'token-uuid')
      ).rejects.toThrow(HttpException);
    });
  });
});
```

**Step 2: 运行测试**

Run: `cd apps/api && pnpm test agent-token.service.spec`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/api/src/modules/agent/__tests__/agent-token.service.spec.ts
git commit -m "$(cat <<'EOF'
test(api): add AgentTokenService unit tests

Tests cover:
- createToken: success, not found, forbidden, limit exceeded
- verifyToken: valid, invalid format, unknown, revoked, expired, wrong agent
- revokeToken: success, already revoked

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: 编写 E2E 测试

**Files:**
- Create: `apps/api/src/modules/agent/__tests__/agent-token.e2e.spec.ts`

**Step 1: 编写 E2E 测试**

```typescript
// apps/api/src/modules/agent/__tests__/agent-token.e2e.spec.ts
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';

describe('AgentToken E2E', () => {
  let app: INestApplication;
  let agentId: string;
  let tokenId: string;
  let rawToken: string;

  const testUserId = `test-user-${Date.now()}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Create a test agent first
    const agentResponse = await request(app.getHttpServer())
      .post('/agents')
      .set('x-user-id', testUserId)
      .send({
        name: 'E2E Test Agent',
        description: 'Agent for E2E testing',
        mastraUrl: 'https://mastra.cloud/test',
        supportedTaskTypes: ['code'],
        minPrice: '1000000',
        maxPrice: '10000000',
      });

    agentId = agentResponse.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /agents/:agentId/tokens', () => {
    it('should create a token', async () => {
      const response = await request(app.getHttpServer())
        .post(`/agents/${agentId}/tokens`)
        .set('x-user-id', testUserId)
        .send({ name: 'E2E Test Token' })
        .expect(201);

      expect(response.body.token).toBeDefined();
      expect(response.body.rawToken).toBeDefined();
      expect(response.body.rawToken).toHaveLength(48);
      expect(response.body.rawToken.startsWith('cagt_')).toBe(true);

      tokenId = response.body.token.id;
      rawToken = response.body.rawToken;
    });
  });

  describe('GET /agents/:agentId/tokens', () => {
    it('should list tokens', async () => {
      const response = await request(app.getHttpServer())
        .get(`/agents/${agentId}/tokens`)
        .set('x-user-id', testUserId)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /agents/:agentId/tokens/:tokenId', () => {
    it('should get a single token', async () => {
      const response = await request(app.getHttpServer())
        .get(`/agents/${agentId}/tokens/${tokenId}`)
        .set('x-user-id', testUserId)
        .expect(200);

      expect(response.body.id).toBe(tokenId);
      expect(response.body.name).toBe('E2E Test Token');
    });
  });

  describe('DELETE /agents/:agentId/tokens/:tokenId', () => {
    it('should revoke a token', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/agents/${agentId}/tokens/${tokenId}`)
        .set('x-user-id', testUserId)
        .expect(200);

      expect(response.body.status).toBe('revoked');
      expect(response.body.revokedAt).toBeDefined();
    });
  });
});
```

**Step 2: 运行 E2E 测试**

Run: `cd apps/api && pnpm test:e2e agent-token`
Expected: PASS

**Step 3: 最终 Commit**

```bash
git add apps/api/src/modules/agent/__tests__/agent-token.e2e.spec.ts
git commit -m "$(cat <<'EOF'
test(api): add AgentToken E2E tests

Integration tests for token endpoints:
- POST /agents/:agentId/tokens
- GET /agents/:agentId/tokens
- GET /agents/:agentId/tokens/:tokenId
- DELETE /agents/:agentId/tokens/:tokenId

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Verification

完成所有 Task 后，执行以下验证步骤：

1. **构建共享库**
   ```bash
   cd packages/shared && pnpm build
   ```

2. **运行所有测试**
   ```bash
   pnpm test
   cd apps/api && pnpm test
   ```

3. **启动开发环境验证**
   ```bash
   pnpm dev
   ```

4. **手动测试 API**
   ```bash
   # 创建 Agent (如果没有)
   curl -X POST http://localhost:3001/agents \
     -H "Content-Type: application/json" \
     -H "x-user-id: test-user" \
     -d '{"name":"Test Agent","description":"For token testing","mastraUrl":"https://test.com","supportedTaskTypes":["writing"],"minPrice":"1000000","maxPrice":"10000000"}'

   # 创建 Token
   curl -X POST http://localhost:3001/agents/<agent-id>/tokens \
     -H "Content-Type: application/json" \
     -H "x-user-id: test-user" \
     -d '{"name":"Production Token"}'

   # 列出 Tokens
   curl http://localhost:3001/agents/<agent-id>/tokens \
     -H "x-user-id: test-user"
   ```

---

## Summary

本计划实现了 Mastra Agent Token 鉴权机制：

| 组件 | 文件 | 用途 |
|------|------|------|
| **Enum** | `packages/shared/src/enums/agent-token-status.ts` | Token 生命周期状态 |
| **Type** | `packages/shared/src/types/index.ts` | AgentToken DTO |
| **Errors** | `packages/shared/src/errors/index.ts` | 5 个新错误码 |
| **Utils** | `packages/shared/src/utils/agent-token.ts` | 生成、哈希、验证 |
| **Repository** | `apps/api/src/modules/agent/agent-token.repository.ts` | 数据库 CRUD |
| **Service** | `apps/api/src/modules/agent/agent-token.service.ts` | 业务逻辑 |
| **Controller** | `apps/api/src/modules/agent/agent-token.controller.ts` | REST 端点 |
| **Guard** | `apps/api/src/modules/agent/guards/agent-token.guard.ts` | 认证中间件 |
| **Migration** | `infra/supabase/migrations/20260124_add_agent_tokens.sql` | 数据库 schema |

**安全特性:**
- SHA-256 哈希存储（永不存储原始 token）
- 256 位加密随机熵
- Token 过期支持
- 所有操作的所有权验证
- 每 Agent Token 数量限制（最多 10 个）

**API 端点:**
- `POST /agents/:agentId/tokens` - 创建 Token
- `GET /agents/:agentId/tokens` - 列出 Tokens
- `GET /agents/:agentId/tokens/:tokenId` - 获取 Token
- `DELETE /agents/:agentId/tokens/:tokenId` - 撤销 Token

**保护端点使用示例:**
```typescript
@UseGuards(AgentTokenGuard)
@Post('invoke')
async invokeAgent(@Req() req: Request) {
  const agentToken = req.agentToken; // Guard 验证后可用
  // ... 处理调用
}
```
