# Mastra Access Token Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让 Agent 发布者（B 用户）能够在平台中管理从 Mastra Cloud 生成的 Access Token，在发布 Agent 时选择 Token 关联，平台在执行 Agent 时使用该 Token 进行鉴权。

**Architecture:**
- 创建 `mastra_tokens` 表存储用户的 Mastra Cloud Access Token（明文存储，因为需要转发给 Mastra）
- 修改 `agents` 表添加 `mastra_token_id` 外键关联
- Agent 创建/编辑表单中添加 Token 选择器（下拉框 + 内联新增按钮）
- Agent 执行时读取关联的 Token，作为 Authorization Bearer 传递给 Mastra SDK

**Tech Stack:** NestJS + Supabase/PostgreSQL + Next.js (React) + packages/shared 共享类型

---

## 数据模型设计

### mastra_tokens 表

```sql
CREATE TABLE IF NOT EXISTS public.mastra_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name text NOT NULL,                    -- 用户定义名称 (e.g., "Production", "Development")
  token text NOT NULL,                   -- Mastra Cloud Access Token (明文存储)

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_mastra_tokens_owner ON public.mastra_tokens(owner_id);

-- updated_at 触发器
DROP TRIGGER IF EXISTS trg_mastra_tokens_updated_at ON public.mastra_tokens;
CREATE TRIGGER trg_mastra_tokens_updated_at
BEFORE UPDATE ON public.mastra_tokens
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

### agents 表修改

```sql
-- 添加 mastra_token_id 列
ALTER TABLE public.agents
ADD COLUMN IF NOT EXISTS mastra_token_id uuid REFERENCES public.mastra_tokens(id) ON SET NULL;

-- 索引
CREATE INDEX IF NOT EXISTS idx_agents_mastra_token ON public.agents(mastra_token_id);
```

---

## Task 1: 创建数据库迁移文件

**Files:**
- Create: `infra/supabase/migrations/20260124_add_mastra_tokens.sql`

**Step 1: 创建迁移文件**

```sql
-- ============================================================
-- Migration: Add Mastra Access Tokens for Agent Authentication
-- File: infra/supabase/migrations/20260124_add_mastra_tokens.sql
-- ============================================================

-- Mastra tokens table (stores external Mastra Cloud access tokens)
CREATE TABLE IF NOT EXISTS public.mastra_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name text NOT NULL,                    -- User-defined name (e.g., "Production", "Development")
  token text NOT NULL,                   -- Mastra Cloud Access Token (plain text for forwarding)

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.mastra_tokens IS
'Mastra Cloud Access Tokens: User-managed tokens from Mastra Cloud for agent authentication.';

COMMENT ON COLUMN public.mastra_tokens.owner_id IS 'B user who owns this token';
COMMENT ON COLUMN public.mastra_tokens.name IS 'User-defined name for identification';
COMMENT ON COLUMN public.mastra_tokens.token IS 'Mastra Cloud access token (plain text)';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mastra_tokens_owner ON public.mastra_tokens(owner_id);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_mastra_tokens_updated_at ON public.mastra_tokens;
CREATE TRIGGER trg_mastra_tokens_updated_at
BEFORE UPDATE ON public.mastra_tokens
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add mastra_token_id to agents table
ALTER TABLE public.agents
ADD COLUMN IF NOT EXISTS mastra_token_id uuid REFERENCES public.mastra_tokens(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.agents.mastra_token_id IS 'Associated Mastra Cloud token for API authentication';

-- Index for agent → token lookup
CREATE INDEX IF NOT EXISTS idx_agents_mastra_token ON public.agents(mastra_token_id);
```

**Step 2: 运行验证（本地 Supabase）**

Run: `cd infra/supabase && supabase db reset`
Expected: 迁移成功应用，无错误

**Step 3: Commit**

```bash
git add infra/supabase/migrations/20260124_add_mastra_tokens.sql
git commit -m "$(cat <<'EOF'
feat(db): add mastra_tokens table and agents.mastra_token_id

- Create mastra_tokens table for storing Mastra Cloud access tokens
- Add mastra_token_id foreign key to agents table
- Add indexes for efficient token and agent lookups

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 添加 MastraToken 共享类型

**Files:**
- Modify: `packages/shared/src/types/index.ts`

**Step 1: 添加 MastraToken 类型**

在 `packages/shared/src/types/index.ts` 文件中，找到 Agent 类型定义附近，添加：

```typescript
// ============================================================
// Mastra Token Types
// ============================================================

/**
 * MastraToken DTO - Mastra Cloud Access Token
 * 用户从 Mastra Cloud 获取的 Access Token，在平台中管理
 */
export interface MastraToken {
  id: string; // uuid
  ownerId: string; // uuid → auth.users（B 用户）

  name: string; // 用户定义名称
  token: string; // Mastra Cloud Access Token

  createdAt: string; // timestamptz → ISO 8601
  updatedAt: string; // timestamptz → ISO 8601
}

/**
 * MastraTokenSummary - 不包含敏感 token 的摘要
 * 用于列表展示和选择器
 */
export interface MastraTokenSummary {
  id: string;
  name: string;
  createdAt: string;
}
```

**Step 2: 修改 Agent 类型添加 mastraTokenId**

在 Agent interface 中添加：

```typescript
export interface Agent {
  // ... existing fields ...

  mastraTokenId: string | null; // uuid | null → mastra_tokens.id

  // ... rest of fields ...
}
```

**Step 3: 运行类型检查**

Run: `cd packages/shared && pnpm typecheck`
Expected: 无错误

**Step 4: Commit**

```bash
git add packages/shared/src/types/index.ts
git commit -m "$(cat <<'EOF'
feat(shared): add MastraToken types and Agent.mastraTokenId

- Add MastraToken interface for full token data
- Add MastraTokenSummary for safe list display (no token field)
- Add mastraTokenId field to Agent interface

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 创建 MastraTokenRepository

**Files:**
- Create: `apps/api/src/modules/mastra-token/mastra-token.repository.ts`

**Step 1: 创建 Repository**

```typescript
// apps/api/src/modules/mastra-token/mastra-token.repository.ts
import type { MastraToken, MastraTokenSummary } from '@c2c-agents/shared';
import { Inject, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';

const MASTRA_TOKENS_TABLE = 'mastra_tokens';

type MastraTokenRow = {
  id: string;
  owner_id: string;
  name: string;
  token: string;
  created_at: string;
  updated_at: string;
};

export type CreateMastraTokenInput = {
  ownerId: string;
  name: string;
  token: string;
};

export type UpdateMastraTokenInput = {
  name?: string;
  token?: string;
};

function toMastraToken(row: MastraTokenRow): MastraToken {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    token: row.token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMastraTokenSummary(row: MastraTokenRow): MastraTokenSummary {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
  };
}

function ensureNoError(error: unknown, context: string): void {
  if (!error) return;
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(`${context}: ${message}`);
}

@Injectable()
export class MastraTokenRepository {
  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  async create(input: CreateMastraTokenInput): Promise<MastraToken> {
    const { data, error } = await this.supabase
      .query<MastraTokenRow>(MASTRA_TOKENS_TABLE)
      .insert({
        owner_id: input.ownerId,
        name: input.name,
        token: input.token,
      })
      .select('*')
      .single();

    ensureNoError(error, 'Failed to create mastra token');
    if (!data) throw new Error('Failed to create mastra token: empty response');

    return toMastraToken(data);
  }

  async findById(tokenId: string): Promise<MastraToken | null> {
    const { data, error } = await this.supabase
      .query<MastraTokenRow>(MASTRA_TOKENS_TABLE)
      .select('*')
      .eq('id', tokenId)
      .maybeSingle();

    ensureNoError(error, 'Failed to find mastra token by id');
    if (!data) return null;

    return toMastraToken(data);
  }

  async findByOwnerId(ownerId: string): Promise<MastraToken[]> {
    const { data, error } = await this.supabase
      .query<MastraTokenRow>(MASTRA_TOKENS_TABLE)
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    ensureNoError(error, 'Failed to find mastra tokens by owner id');

    return (data ?? []).map(toMastraToken);
  }

  async findSummariesByOwnerId(ownerId: string): Promise<MastraTokenSummary[]> {
    const { data, error } = await this.supabase
      .query<MastraTokenRow>(MASTRA_TOKENS_TABLE)
      .select('id, name, created_at')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    ensureNoError(error, 'Failed to find mastra token summaries');

    return (data ?? []).map(toMastraTokenSummary);
  }

  async update(tokenId: string, input: UpdateMastraTokenInput): Promise<MastraToken> {
    const updateData: Record<string, string> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.token !== undefined) updateData.token = input.token;

    const { data, error } = await this.supabase
      .query<MastraTokenRow>(MASTRA_TOKENS_TABLE)
      .update(updateData)
      .eq('id', tokenId)
      .select('*')
      .single();

    ensureNoError(error, 'Failed to update mastra token');
    if (!data) throw new Error('Failed to update mastra token: empty response');

    return toMastraToken(data);
  }

  async delete(tokenId: string): Promise<void> {
    const { error } = await this.supabase
      .query(MASTRA_TOKENS_TABLE)
      .delete()
      .eq('id', tokenId);

    ensureNoError(error, 'Failed to delete mastra token');
  }

  async countByOwnerId(ownerId: string): Promise<number> {
    const { count, error } = await this.supabase
      .query(MASTRA_TOKENS_TABLE)
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', ownerId);

    ensureNoError(error, 'Failed to count mastra tokens');

    return count ?? 0;
  }
}
```

**Step 2: Commit**

```bash
git add apps/api/src/modules/mastra-token/mastra-token.repository.ts
git commit -m "$(cat <<'EOF'
feat(api): add MastraTokenRepository

CRUD operations for mastra_tokens table:
- create(): insert new token
- findById(): lookup single token
- findByOwnerId(): list user's tokens
- findSummariesByOwnerId(): list without sensitive token field
- update(): modify name or token
- delete(): remove token
- countByOwnerId(): for limit enforcement

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 创建 MastraTokenService

**Files:**
- Create: `apps/api/src/modules/mastra-token/dtos/create-mastra-token.dto.ts`
- Create: `apps/api/src/modules/mastra-token/dtos/update-mastra-token.dto.ts`
- Create: `apps/api/src/modules/mastra-token/mastra-token.service.ts`

**Step 1: 创建 DTOs**

```typescript
// apps/api/src/modules/mastra-token/dtos/create-mastra-token.dto.ts
export class CreateMastraTokenDto {
  name: string;
  token: string;
}
```

```typescript
// apps/api/src/modules/mastra-token/dtos/update-mastra-token.dto.ts
export class UpdateMastraTokenDto {
  name?: string;
  token?: string;
}
```

**Step 2: 创建 Service**

```typescript
// apps/api/src/modules/mastra-token/mastra-token.service.ts
import type { MastraToken, MastraTokenSummary } from '@c2c-agents/shared';
import { ErrorCode, ValidationError } from '@c2c-agents/shared';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { MastraTokenRepository } from './mastra-token.repository';
import type { CreateMastraTokenDto } from './dtos/create-mastra-token.dto';
import type { UpdateMastraTokenDto } from './dtos/update-mastra-token.dto';

const MAX_TOKENS_PER_USER = 20;

@Injectable()
export class MastraTokenService {
  constructor(
    @Inject(MastraTokenRepository) private readonly tokenRepository: MastraTokenRepository
  ) {}

  async createToken(userId: string, dto: CreateMastraTokenDto): Promise<MastraToken> {
    if (!dto.name || dto.name.trim().length === 0) {
      throw new ValidationError('Token name is required');
    }
    if (dto.name.trim().length > 100) {
      throw new ValidationError('Token name must be 100 characters or less');
    }
    if (!dto.token || dto.token.trim().length === 0) {
      throw new ValidationError('Token value is required');
    }

    const count = await this.tokenRepository.countByOwnerId(userId);
    if (count >= MAX_TOKENS_PER_USER) {
      throw new HttpException(
        {
          code: ErrorCode.BUSINESS_LIMIT_EXCEEDED,
          message: `Maximum ${MAX_TOKENS_PER_USER} tokens per user`,
        },
        400
      );
    }

    return this.tokenRepository.create({
      ownerId: userId,
      name: dto.name.trim(),
      token: dto.token.trim(),
    });
  }

  async listTokens(userId: string): Promise<MastraToken[]> {
    return this.tokenRepository.findByOwnerId(userId);
  }

  async listTokenSummaries(userId: string): Promise<MastraTokenSummary[]> {
    return this.tokenRepository.findSummariesByOwnerId(userId);
  }

  async getToken(userId: string, tokenId: string): Promise<MastraToken> {
    const token = await this.tokenRepository.findById(tokenId);
    if (!token) {
      throw new HttpException(
        { code: ErrorCode.BUSINESS_RESOURCE_NOT_FOUND, message: 'Token not found' },
        404
      );
    }

    if (token.ownerId !== userId) {
      throw new HttpException(
        { code: ErrorCode.AUTH_FORBIDDEN, message: 'Token does not belong to current user' },
        403
      );
    }

    return token;
  }

  async updateToken(
    userId: string,
    tokenId: string,
    dto: UpdateMastraTokenDto
  ): Promise<MastraToken> {
    const token = await this.tokenRepository.findById(tokenId);
    if (!token) {
      throw new HttpException(
        { code: ErrorCode.BUSINESS_RESOURCE_NOT_FOUND, message: 'Token not found' },
        404
      );
    }

    if (token.ownerId !== userId) {
      throw new HttpException(
        { code: ErrorCode.AUTH_FORBIDDEN, message: 'Token does not belong to current user' },
        403
      );
    }

    if (dto.name !== undefined && dto.name.trim().length === 0) {
      throw new ValidationError('Token name cannot be empty');
    }
    if (dto.name !== undefined && dto.name.trim().length > 100) {
      throw new ValidationError('Token name must be 100 characters or less');
    }
    if (dto.token !== undefined && dto.token.trim().length === 0) {
      throw new ValidationError('Token value cannot be empty');
    }

    return this.tokenRepository.update(tokenId, {
      name: dto.name?.trim(),
      token: dto.token?.trim(),
    });
  }

  async deleteToken(userId: string, tokenId: string): Promise<void> {
    const token = await this.tokenRepository.findById(tokenId);
    if (!token) {
      throw new HttpException(
        { code: ErrorCode.BUSINESS_RESOURCE_NOT_FOUND, message: 'Token not found' },
        404
      );
    }

    if (token.ownerId !== userId) {
      throw new HttpException(
        { code: ErrorCode.AUTH_FORBIDDEN, message: 'Token does not belong to current user' },
        403
      );
    }

    await this.tokenRepository.delete(tokenId);
  }

  async getTokenForAgent(tokenId: string): Promise<MastraToken | null> {
    return this.tokenRepository.findById(tokenId);
  }
}
```

**Step 3: Commit**

```bash
git add apps/api/src/modules/mastra-token/dtos/create-mastra-token.dto.ts \
        apps/api/src/modules/mastra-token/dtos/update-mastra-token.dto.ts \
        apps/api/src/modules/mastra-token/mastra-token.service.ts
git commit -m "$(cat <<'EOF'
feat(api): add MastraTokenService

Business logic for mastra token operations:
- createToken(): validate + store with limit enforcement
- listTokens(): full token data for owner
- listTokenSummaries(): safe list without token values
- getToken(): fetch with ownership check
- updateToken(): modify with ownership check
- deleteToken(): remove with ownership check
- getTokenForAgent(): internal use for agent execution

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 创建 MastraTokenController

**Files:**
- Create: `apps/api/src/modules/mastra-token/mastra-token.controller.ts`

**Step 1: 创建 Controller**

```typescript
// apps/api/src/modules/mastra-token/mastra-token.controller.ts
import type { MastraToken, MastraTokenSummary } from '@c2c-agents/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { MastraTokenService } from './mastra-token.service';
import type { CreateMastraTokenDto } from './dtos/create-mastra-token.dto';
import type { UpdateMastraTokenDto } from './dtos/update-mastra-token.dto';

@Controller('mastra-tokens')
export class MastraTokenController {
  constructor(@Inject(MastraTokenService) private readonly tokenService: MastraTokenService) {}

  @Post()
  async createToken(
    @Headers('x-user-id') userId: string,
    @Body() dto: CreateMastraTokenDto
  ): Promise<MastraToken> {
    return this.tokenService.createToken(userId, dto);
  }

  @Get()
  async listTokens(
    @Headers('x-user-id') userId: string,
    @Query('summary') summary?: string
  ): Promise<MastraToken[] | MastraTokenSummary[]> {
    if (summary === 'true') {
      return this.tokenService.listTokenSummaries(userId);
    }
    return this.tokenService.listTokens(userId);
  }

  @Get(':tokenId')
  async getToken(
    @Headers('x-user-id') userId: string,
    @Param('tokenId') tokenId: string
  ): Promise<MastraToken> {
    return this.tokenService.getToken(userId, tokenId);
  }

  @Patch(':tokenId')
  async updateToken(
    @Headers('x-user-id') userId: string,
    @Param('tokenId') tokenId: string,
    @Body() dto: UpdateMastraTokenDto
  ): Promise<MastraToken> {
    return this.tokenService.updateToken(userId, tokenId, dto);
  }

  @Delete(':tokenId')
  @HttpCode(204)
  async deleteToken(
    @Headers('x-user-id') userId: string,
    @Param('tokenId') tokenId: string
  ): Promise<void> {
    await this.tokenService.deleteToken(userId, tokenId);
  }
}
```

**Step 2: Commit**

```bash
git add apps/api/src/modules/mastra-token/mastra-token.controller.ts
git commit -m "$(cat <<'EOF'
feat(api): add MastraTokenController

RESTful endpoints for token management:
- POST /mastra-tokens - create token
- GET /mastra-tokens - list tokens (?summary=true for safe list)
- GET /mastra-tokens/:tokenId - get token details
- PATCH /mastra-tokens/:tokenId - update token
- DELETE /mastra-tokens/:tokenId - delete token

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 创建 MastraTokenModule 并注册

**Files:**
- Create: `apps/api/src/modules/mastra-token/mastra-token.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Step 1: 创建 Module**

```typescript
// apps/api/src/modules/mastra-token/mastra-token.module.ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { MastraTokenController } from './mastra-token.controller';
import { MastraTokenRepository } from './mastra-token.repository';
import { MastraTokenService } from './mastra-token.service';

@Module({
  imports: [DatabaseModule],
  controllers: [MastraTokenController],
  providers: [MastraTokenService, MastraTokenRepository],
  exports: [MastraTokenService],
})
export class MastraTokenModule {}
```

**Step 2: 在 AppModule 中注册**

读取 `apps/api/src/app.module.ts`，在 imports 数组中添加 `MastraTokenModule`：

```typescript
import { MastraTokenModule } from './modules/mastra-token/mastra-token.module';

@Module({
  imports: [
    // ... existing modules ...
    MastraTokenModule,
  ],
  // ...
})
export class AppModule {}
```

**Step 3: Commit**

```bash
git add apps/api/src/modules/mastra-token/mastra-token.module.ts \
        apps/api/src/app.module.ts
git commit -m "$(cat <<'EOF'
feat(api): register MastraTokenModule

- Create MastraTokenModule with controller, service, repository
- Register in AppModule
- Export MastraTokenService for use by AgentModule

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 更新 AgentRepository 支持 mastraTokenId

**Files:**
- Modify: `apps/api/src/modules/agent/agent.repository.ts`

**Step 1: 读取现有 Repository**

先读取 `apps/api/src/modules/agent/agent.repository.ts` 了解当前结构。

**Step 2: 更新类型定义和映射**

在 `AgentRow` 类型中添加 `mastra_token_id` 字段：

```typescript
type AgentRow = {
  // ... existing fields ...
  mastra_token_id: string | null;
};
```

在 `toAgent` 函数中添加映射：

```typescript
function toAgent(row: AgentRow): Agent {
  return {
    // ... existing mappings ...
    mastraTokenId: row.mastra_token_id,
  };
}
```

**Step 3: 更新 create 和 update 方法**

在 `CreateAgentInput` 类型中添加 `mastraTokenId?: string | null`。

在 `create` 方法的 insert 对象中添加：
```typescript
mastra_token_id: input.mastraTokenId ?? null,
```

在 `UpdateAgentInput` 类型中添加 `mastraTokenId?: string | null`。

在 `update` 方法中添加对 `mastraTokenId` 的处理。

**Step 4: Commit**

```bash
git add apps/api/src/modules/agent/agent.repository.ts
git commit -m "$(cat <<'EOF'
feat(api): add mastraTokenId support to AgentRepository

- Add mastra_token_id to AgentRow type
- Map to mastraTokenId in toAgent function
- Support mastraTokenId in create and update methods

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 更新 AgentService 验证 Token 归属

**Files:**
- Modify: `apps/api/src/modules/agent/agent.service.ts`
- Modify: `apps/api/src/modules/agent/dtos/create-agent.dto.ts`
- Modify: `apps/api/src/modules/agent/dtos/update-agent.dto.ts`

**Step 1: 更新 DTOs**

在 `CreateAgentDto` 中添加：
```typescript
mastraTokenId?: string;
```

在 `UpdateAgentDto` 中添加：
```typescript
mastraTokenId?: string | null;
```

**Step 2: 更新 AgentService**

读取 `apps/api/src/modules/agent/agent.service.ts`。

添加 MastraTokenService 依赖注入：
```typescript
import { MastraTokenService } from '../mastra-token/mastra-token.service';

constructor(
  @Inject(AgentRepository) private readonly agentRepository: AgentRepository,
  @Inject(MastraTokenService) private readonly mastraTokenService: MastraTokenService
) {}
```

在 `createAgent` 方法中添加验证：
```typescript
if (dto.mastraTokenId) {
  // 验证 token 存在且属于当前用户
  await this.mastraTokenService.getToken(userId, dto.mastraTokenId);
}
```

在 `updateAgent` 方法中添加验证：
```typescript
if (dto.mastraTokenId !== undefined && dto.mastraTokenId !== null) {
  // 验证 token 存在且属于当前用户
  await this.mastraTokenService.getToken(userId, dto.mastraTokenId);
}
```

**Step 3: 更新 AgentModule 导入**

在 `apps/api/src/modules/agent/agent.module.ts` 中导入 `MastraTokenModule`：
```typescript
import { MastraTokenModule } from '../mastra-token/mastra-token.module';

@Module({
  imports: [DatabaseModule, MastraTokenModule],
  // ...
})
```

**Step 4: Commit**

```bash
git add apps/api/src/modules/agent/agent.service.ts \
        apps/api/src/modules/agent/dtos/create-agent.dto.ts \
        apps/api/src/modules/agent/dtos/update-agent.dto.ts \
        apps/api/src/modules/agent/agent.module.ts
git commit -m "$(cat <<'EOF'
feat(api): validate mastraTokenId in AgentService

- Add mastraTokenId to CreateAgentDto and UpdateAgentDto
- Validate token ownership before associating with agent
- Import MastraTokenModule in AgentModule

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: 创建前端 Token 管理页面

**Files:**
- Create: `apps/web/src/app/tokens/page.tsx`
- Create: `apps/web/src/components/tokens/TokenList.tsx`
- Create: `apps/web/src/components/tokens/TokenForm.tsx`

**Step 1: 创建 Token 列表组件**

```typescript
// apps/web/src/components/tokens/TokenList.tsx
'use client';

import type { MastraToken } from '@c2c-agents/shared';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';

type TokenListProps = {
  tokens: MastraToken[];
  userId: string;
  onDelete: (tokenId: string) => void;
  onEdit: (token: MastraToken) => void;
};

export function TokenList({ tokens, userId, onDelete, onEdit }: TokenListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (tokenId: string) => {
    if (!confirm('确定要删除这个 Token 吗？关联该 Token 的 Agent 将无法正常执行。')) {
      return;
    }
    setDeletingId(tokenId);
    try {
      await apiFetch(`/mastra-tokens/${tokenId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': userId },
      });
      onDelete(tokenId);
    } catch (error) {
      alert(error instanceof Error ? error.message : '删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  if (tokens.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/50 p-8 text-center">
        <p className="text-muted-foreground">暂无 Token，点击上方按钮添加</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {tokens.map((token) => (
        <div
          key={token.id}
          className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
        >
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-foreground">{token.name}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {token.token.slice(0, 20)}...
            </span>
            <span className="text-xs text-muted-foreground">
              创建于 {new Date(token.createdAt).toLocaleDateString('zh-CN')}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onEdit(token)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-primary/40 hover:text-primary"
            >
              编辑
            </button>
            <button
              type="button"
              onClick={() => handleDelete(token.id)}
              disabled={deletingId === token.id}
              className="rounded-lg border border-destructive/40 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              {deletingId === token.id ? '删除中...' : '删除'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Step 2: 创建 Token 表单组件**

```typescript
// apps/web/src/components/tokens/TokenForm.tsx
'use client';

import type { MastraToken } from '@c2c-agents/shared';
import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

type TokenFormProps = {
  userId: string;
  editingToken?: MastraToken | null;
  onSuccess: (token: MastraToken) => void;
  onCancel: () => void;
};

export function TokenForm({ userId, editingToken, onSuccess, onCancel }: TokenFormProps) {
  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!editingToken;

  useEffect(() => {
    if (editingToken) {
      setName(editingToken.name);
      setToken(editingToken.token);
    } else {
      setName('');
      setToken('');
    }
  }, [editingToken]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('请输入 Token 名称');
      return;
    }
    if (!token.trim()) {
      setError('请输入 Token 值');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let result: MastraToken;
      if (isEditing) {
        result = await apiFetch<MastraToken>(`/mastra-tokens/${editingToken.id}`, {
          method: 'PATCH',
          headers: { 'x-user-id': userId },
          body: JSON.stringify({ name: name.trim(), token: token.trim() }),
        });
      } else {
        result = await apiFetch<MastraToken>('/mastra-tokens', {
          method: 'POST',
          headers: { 'x-user-id': userId },
          body: JSON.stringify({ name: name.trim(), token: token.trim() }),
        });
      }
      onSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold">
        {isEditing ? '编辑 Token' : '添加 Token'}
      </h3>

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Token 名称</span>
          <input
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none"
            placeholder="例如：Production"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Mastra Access Token</span>
          <textarea
            className="min-h-[80px] rounded-lg border border-input bg-background p-3 font-mono text-sm focus:border-primary focus:outline-none"
            placeholder="从 Mastra Cloud 复制的 Access Token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <span className="text-xs text-muted-foreground">
            在 Mastra Cloud 项目设置 → Access Token 中生成
          </span>
        </label>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/15 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? '保存中...' : isEditing ? '保存' : '添加'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: 创建 Token 管理页面**

```typescript
// apps/web/src/app/tokens/page.tsx
'use client';

import type { MastraToken } from '@c2c-agents/shared';
import { useEffect, useState } from 'react';
import { TopNav } from '../../components/layout/TopNav';
import { TokenForm } from '../../components/tokens/TokenForm';
import { TokenList } from '../../components/tokens/TokenList';
import { apiFetch } from '../../lib/api';
import { useUserId } from '../../lib/useUserId';

export default function TokensPage() {
  const { userId, isConnected } = useUserId('B');
  const [tokens, setTokens] = useState<MastraToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingToken, setEditingToken] = useState<MastraToken | null>(null);

  useEffect(() => {
    if (!userId) return;

    const fetchTokens = async () => {
      try {
        const data = await apiFetch<MastraToken[]>('/mastra-tokens', {
          headers: { 'x-user-id': userId },
        });
        setTokens(data);
      } catch (error) {
        console.error('Failed to fetch tokens:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTokens();
  }, [userId]);

  const handleSuccess = (token: MastraToken) => {
    if (editingToken) {
      setTokens((prev) => prev.map((t) => (t.id === token.id ? token : t)));
    } else {
      setTokens((prev) => [token, ...prev]);
    }
    setShowForm(false);
    setEditingToken(null);
  };

  const handleDelete = (tokenId: string) => {
    setTokens((prev) => prev.filter((t) => t.id !== tokenId));
  };

  const handleEdit = (token: MastraToken) => {
    setEditingToken(token);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingToken(null);
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(24,36,70,0.6),rgba(10,14,30,0.95))] text-foreground">
      <TopNav />

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
        <section className="rounded-3xl border border-border/70 bg-card/70 p-8 shadow-[0_35px_80px_rgba(8,12,28,0.55)] backdrop-blur">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Settings</p>
              <h1 className="mt-3 text-3xl font-semibold">Mastra Access Tokens</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                管理您的 Mastra Cloud Access Token，用于 Agent 执行时的身份验证。
              </p>
            </div>
            {!showForm && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                disabled={!isConnected}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                + 添加 Token
              </button>
            )}
          </div>
        </section>

        {!isConnected && (
          <div className="rounded-xl border border-warning/40 bg-warning/15 px-4 py-3 text-sm text-warning">
            请先连接 Sepolia 钱包以管理 Token。
          </div>
        )}

        {showForm && userId && (
          <TokenForm
            userId={userId}
            editingToken={editingToken}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        )}

        {loading ? (
          <div className="text-center text-muted-foreground">加载中...</div>
        ) : userId ? (
          <TokenList
            tokens={tokens}
            userId={userId}
            onDelete={handleDelete}
            onEdit={handleEdit}
          />
        ) : null}
      </div>
    </main>
  );
}
```

**Step 4: Commit**

```bash
git add apps/web/src/app/tokens/page.tsx \
        apps/web/src/components/tokens/TokenList.tsx \
        apps/web/src/components/tokens/TokenForm.tsx
git commit -m "$(cat <<'EOF'
feat(web): add Token management page

- Create /tokens page for managing Mastra Access Tokens
- TokenList component with delete and edit actions
- TokenForm component for create and edit operations

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: 创建 Token 选择器组件

**Files:**
- Create: `apps/web/src/components/tokens/TokenSelector.tsx`

**Step 1: 创建选择器组件**

```typescript
// apps/web/src/components/tokens/TokenSelector.tsx
'use client';

import type { MastraToken, MastraTokenSummary } from '@c2c-agents/shared';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { TokenForm } from './TokenForm';

type TokenSelectorProps = {
  userId: string;
  value: string | null;
  onChange: (tokenId: string | null) => void;
};

export function TokenSelector({ userId, value, onChange }: TokenSelectorProps) {
  const [tokens, setTokens] = useState<MastraTokenSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  const fetchTokens = async () => {
    try {
      const data = await apiFetch<MastraTokenSummary[]>('/mastra-tokens?summary=true', {
        headers: { 'x-user-id': userId },
      });
      setTokens(data);
    } catch (error) {
      console.error('Failed to fetch tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, [userId]);

  const handleAddSuccess = (token: MastraToken) => {
    setTokens((prev) => [{ id: token.id, name: token.name, createdAt: token.createdAt }, ...prev]);
    onChange(token.id);
    setShowAddForm(false);
  };

  if (showAddForm) {
    return (
      <div className="flex flex-col gap-4">
        <TokenForm
          userId={userId}
          onSuccess={handleAddSuccess}
          onCancel={() => setShowAddForm(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <select
          className="h-12 flex-1 rounded-lg border border-input bg-card px-4 text-base text-foreground focus:border-primary focus:outline-none"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={loading}
        >
          <option value="">-- 选择 Access Token --</option>
          {tokens.map((token) => (
            <option key={token.id} value={token.id}>
              {token.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="h-12 rounded-lg border border-primary/40 bg-primary/10 px-4 text-sm font-semibold text-primary hover:bg-primary/20"
        >
          + 添加
        </button>
      </div>
      {tokens.length === 0 && !loading && (
        <span className="text-xs text-muted-foreground">
          暂无 Token，请先添加一个 Mastra Access Token
        </span>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/tokens/TokenSelector.tsx
git commit -m "$(cat <<'EOF'
feat(web): add TokenSelector component

- Dropdown to select from user's saved tokens
- Inline "Add" button to create new token without leaving form
- Shows inline TokenForm when adding new token

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: 在 CreateAgentForm 中集成 TokenSelector

**Files:**
- Modify: `apps/web/src/components/agents/CreateAgentForm.tsx`

**Step 1: 读取并修改 CreateAgentForm**

在 `CreateAgentForm.tsx` 中：

1. 导入 TokenSelector：
```typescript
import { TokenSelector } from '../tokens/TokenSelector';
```

2. 添加 state：
```typescript
const [mastraTokenId, setMastraTokenId] = useState<string | null>(null);
```

3. 在 "Mastra Cloud 集成" section 中添加 TokenSelector：
```typescript
{/* Mastra Integration */}
<section className="flex flex-col gap-6">
  <h3 className="flex items-center gap-2 text-xl font-bold text-foreground">
    <span className="text-primary">🔗</span>
    Mastra Cloud 集成
  </h3>

  <label className="flex flex-col gap-2">
    <span className="text-sm font-medium text-foreground">
      Mastra Cloud URL <span className="text-destructive">*</span>
    </span>
    <input
      className="h-12 rounded-lg border border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
      placeholder="https://mastra.cloud/your-agent"
      value={mastraUrl}
      onChange={(e) => setMastraUrl(e.target.value)}
    />
    <span className="text-xs text-muted-foreground">
      您的 Agent 在 Mastra Cloud 的部署地址
    </span>
  </label>

  {userId && (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">
        Access Token <span className="text-destructive">*</span>
      </span>
      <TokenSelector
        userId={userId}
        value={mastraTokenId}
        onChange={setMastraTokenId}
      />
      <span className="text-xs text-muted-foreground">
        用于平台调用您 Agent 时的身份验证
      </span>
    </label>
  )}
</section>
```

4. 在 handleCreate 验证中添加：
```typescript
if (!mastraTokenId) {
  setError('请选择一个 Access Token');
  return;
}
```

5. 在 API 请求 body 中添加：
```typescript
body: JSON.stringify({
  name,
  description,
  avatarUrl: avatarUrl.trim() || undefined,
  mastraUrl: mastraUrl.trim(),
  mastraTokenId,  // 添加这一行
  tags: tagList.length > 0 ? tagList : undefined,
  supportedTaskTypes,
  minPrice: toMinUnit(minPrice, USDT_DECIMALS),
  maxPrice: toMinUnit(maxPrice, USDT_DECIMALS),
}),
```

**Step 2: Commit**

```bash
git add apps/web/src/components/agents/CreateAgentForm.tsx
git commit -m "$(cat <<'EOF'
feat(web): integrate TokenSelector in CreateAgentForm

- Add TokenSelector to Mastra Cloud integration section
- Require token selection before agent creation
- Pass mastraTokenId to API when creating agent

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: 添加导航链接

**Files:**
- Modify: `apps/web/src/components/layout/TopNav.tsx`

**Step 1: 读取并修改 TopNav**

在导航中添加 Token 管理链接：

```typescript
<Link
  href="/tokens"
  className="text-sm text-muted-foreground hover:text-foreground"
>
  Token 管理
</Link>
```

**Step 2: Commit**

```bash
git add apps/web/src/components/layout/TopNav.tsx
git commit -m "$(cat <<'EOF'
feat(web): add Token management link to navigation

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: 编写单元测试

**Files:**
- Create: `apps/api/src/modules/mastra-token/__tests__/mastra-token.service.spec.ts`

**Step 1: 编写测试**

```typescript
// apps/api/src/modules/mastra-token/__tests__/mastra-token.service.spec.ts
import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MastraTokenService } from '../mastra-token.service';
import { MastraTokenRepository } from '../mastra-token.repository';

describe('MastraTokenService', () => {
  let service: MastraTokenService;
  let repository: jest.Mocked<MastraTokenRepository>;

  const mockToken = {
    id: 'token-uuid',
    ownerId: 'user-uuid',
    name: 'Test Token',
    token: 'mst_abc123...',
    createdAt: '2026-01-24T00:00:00Z',
    updatedAt: '2026-01-24T00:00:00Z',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MastraTokenService,
        {
          provide: MastraTokenRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findByOwnerId: jest.fn(),
            findSummariesByOwnerId: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            countByOwnerId: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MastraTokenService>(MastraTokenService);
    repository = module.get(MastraTokenRepository);
  });

  describe('createToken', () => {
    it('should create a token successfully', async () => {
      repository.countByOwnerId.mockResolvedValue(0);
      repository.create.mockResolvedValue(mockToken);

      const result = await service.createToken('user-uuid', {
        name: 'My Token',
        token: 'mst_abc123...',
      });

      expect(result).toEqual(mockToken);
      expect(repository.create).toHaveBeenCalledWith({
        ownerId: 'user-uuid',
        name: 'My Token',
        token: 'mst_abc123...',
      });
    });

    it('should throw if name is empty', async () => {
      await expect(
        service.createToken('user-uuid', { name: '', token: 'abc' })
      ).rejects.toThrow('Token name is required');
    });

    it('should throw if token limit exceeded', async () => {
      repository.countByOwnerId.mockResolvedValue(20);

      await expect(
        service.createToken('user-uuid', { name: 'Test', token: 'abc' })
      ).rejects.toThrow(HttpException);
    });
  });

  describe('getToken', () => {
    it('should return token if owned by user', async () => {
      repository.findById.mockResolvedValue(mockToken);

      const result = await service.getToken('user-uuid', 'token-uuid');

      expect(result).toEqual(mockToken);
    });

    it('should throw 404 if token not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.getToken('user-uuid', 'token-uuid')
      ).rejects.toThrow(HttpException);
    });

    it('should throw 403 if token belongs to different user', async () => {
      repository.findById.mockResolvedValue({
        ...mockToken,
        ownerId: 'other-user-uuid',
      });

      await expect(
        service.getToken('user-uuid', 'token-uuid')
      ).rejects.toThrow(HttpException);
    });
  });

  describe('deleteToken', () => {
    it('should delete token successfully', async () => {
      repository.findById.mockResolvedValue(mockToken);
      repository.delete.mockResolvedValue(undefined);

      await service.deleteToken('user-uuid', 'token-uuid');

      expect(repository.delete).toHaveBeenCalledWith('token-uuid');
    });

    it('should throw if not owner', async () => {
      repository.findById.mockResolvedValue({
        ...mockToken,
        ownerId: 'other-user-uuid',
      });

      await expect(
        service.deleteToken('user-uuid', 'token-uuid')
      ).rejects.toThrow(HttpException);
    });
  });
});
```

**Step 2: 运行测试**

Run: `cd apps/api && pnpm test mastra-token.service.spec`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/api/src/modules/mastra-token/__tests__/mastra-token.service.spec.ts
git commit -m "$(cat <<'EOF'
test(api): add MastraTokenService unit tests

Tests cover:
- createToken: success, validation errors, limit exceeded
- getToken: success, not found, forbidden
- deleteToken: success, forbidden

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Verification

完成所有 Task 后，执行以下验证步骤：

1. **数据库迁移**
   ```bash
   cd infra/supabase && supabase db reset
   ```

2. **构建共享库**
   ```bash
   cd packages/shared && pnpm build
   ```

3. **类型检查**
   ```bash
   pnpm typecheck
   ```

4. **运行测试**
   ```bash
   cd apps/api && pnpm test
   ```

5. **启动开发环境**
   ```bash
   pnpm dev
   ```

6. **手动测试**
   - 访问 `/tokens` 页面，添加一个 Mastra Token
   - 在 Agent 创建页面，验证 Token 选择器正常工作
   - 验证可以在选择器中内联添加新 Token
   - 验证创建 Agent 时 mastraTokenId 正确传递

---

## Summary

本计划实现了 Mastra Access Token 管理机制：

| 组件 | 文件 | 用途 |
|------|------|------|
| **Migration** | `infra/supabase/migrations/20260124_add_mastra_tokens.sql` | 数据库表结构 |
| **Type** | `packages/shared/src/types/index.ts` | MastraToken 类型 |
| **Repository** | `apps/api/src/modules/mastra-token/mastra-token.repository.ts` | 数据库 CRUD |
| **Service** | `apps/api/src/modules/mastra-token/mastra-token.service.ts` | 业务逻辑 |
| **Controller** | `apps/api/src/modules/mastra-token/mastra-token.controller.ts` | REST 端点 |
| **Module** | `apps/api/src/modules/mastra-token/mastra-token.module.ts` | NestJS 模块 |
| **TokenList** | `apps/web/src/components/tokens/TokenList.tsx` | Token 列表组件 |
| **TokenForm** | `apps/web/src/components/tokens/TokenForm.tsx` | Token 表单组件 |
| **TokenSelector** | `apps/web/src/components/tokens/TokenSelector.tsx` | Token 选择器 |
| **TokensPage** | `apps/web/src/app/tokens/page.tsx` | Token 管理页面 |

**API 端点:**
- `POST /mastra-tokens` - 创建 Token
- `GET /mastra-tokens` - 列出 Tokens（?summary=true 不返回 token 值）
- `GET /mastra-tokens/:tokenId` - 获取 Token
- `PATCH /mastra-tokens/:tokenId` - 更新 Token
- `DELETE /mastra-tokens/:tokenId` - 删除 Token

**关键特性:**
- Token 明文存储（需要转发给 Mastra）
- 用户级 Token 管理（不是 Agent 级）
- Agent 创建时选择 Token
- 内联 Token 新增（不离开 Agent 表单）
- 每用户最多 20 个 Token

**后续工作（不在本计划范围）:**
- Agent 执行时使用关联的 Token 调用 Mastra SDK
- Token 验证失败时的错误处理
- Agent 编辑页面的 Token 修改功能
