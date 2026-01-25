# Agent 向量化搜索与智能匹配实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现 Agent 向量化存储与智能召回功能，当 Task 创建后通过语义相似度召回最相关的 Agent，并应用洗牌算法选出最优的 3 个。

**Architecture:**
- 使用 Supabase pgvector 扩展存储 Agent 的向量化信息
- 使用 OpenAI text-embedding-3-small 模型生成 1536 维向量
- Agent 创建/更新时同步更新向量
- 提供召回接口，基于 Task 信息向量化后进行相似度匹配，召回最多 15 个候选 Agent，再通过洗牌算法筛选出 3 个最优

**Tech Stack:**
- Supabase + pgvector 扩展
- OpenAI API (text-embedding-3-small)
- NestJS 模块化架构

---

## Task 1: 添加 pgvector 扩展和 agent_embeddings 表

**Files:**
- Create: `infra/supabase/migrations/20260125_add_agent_embeddings.sql`

**Step 1: 创建数据库迁移文件**

```sql
-- ============================================================
-- Agent Embeddings for Vector Search
-- Tech: Supabase + pgvector
-- ============================================================

-- 启用 pgvector 扩展
create extension if not exists vector with schema extensions;

-- ============================================================
-- agent_embeddings 表
-- 存储 Agent 的向量化信息，用于语义搜索
-- ============================================================

create table if not exists public.agent_embeddings (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,

  -- 用于生成 embedding 的文本内容（方便调试和重新生成）
  content_text text not null,

  -- 1536 维向量 (OpenAI text-embedding-3-small)
  embedding vector(1536) not null,

  -- 使用的模型标识（便于后续升级模型时重新生成）
  model_id text not null default 'text-embedding-3-small',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.agent_embeddings is
'Agent 向量化信息表：存储 Agent 描述/标签的向量化表示，用于语义搜索匹配 Task';

comment on column public.agent_embeddings.agent_id is 'Agent ID（每个 Agent 只有一条记录）';
comment on column public.agent_embeddings.content_text is '生成 embedding 的原始文本';
comment on column public.agent_embeddings.embedding is '1536 维向量（OpenAI text-embedding-3-small）';
comment on column public.agent_embeddings.model_id is '使用的 embedding 模型标识';

-- 每个 agent 只能有一条 embedding 记录
create unique index if not exists uq_agent_embeddings_agent_id
on public.agent_embeddings(agent_id);

-- 创建 HNSW 索引用于近似最近邻搜索（余弦相似度）
create index if not exists idx_agent_embeddings_vector
on public.agent_embeddings
using hnsw (embedding vector_cosine_ops);

-- updated_at 自动更新触发器
drop trigger if exists trg_agent_embeddings_updated_at on public.agent_embeddings;
create trigger trg_agent_embeddings_updated_at
before update on public.agent_embeddings
for each row execute function public.set_updated_at();

-- ============================================================
-- 向量相似度搜索函数
-- ============================================================

create or replace function public.match_agents_by_embedding(
  query_embedding vector(1536),
  match_threshold float default 0.5,
  match_count int default 15
)
returns table (
  agent_id uuid,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    ae.agent_id,
    1 - (ae.embedding <=> query_embedding) as similarity
  from public.agent_embeddings ae
  inner join public.agents a on a.id = ae.agent_id
  where
    a.is_listed = true
    and 1 - (ae.embedding <=> query_embedding) > match_threshold
  order by ae.embedding <=> query_embedding
  limit match_count;
end;
$$;

comment on function public.match_agents_by_embedding is
'基于向量相似度搜索匹配的 Agent，返回相似度高于阈值的前 N 个结果';
```

**Step 2: 验证迁移文件语法**

Run: `cat infra/supabase/migrations/20260125_add_agent_embeddings.sql | head -80`
Expected: 文件内容正确显示

**Step 3: Commit**

```bash
git add infra/supabase/migrations/20260125_add_agent_embeddings.sql
git commit -m "feat(db): add agent_embeddings table with pgvector support

- Enable pgvector extension for vector storage
- Create agent_embeddings table with 1536-dim vector column
- Add HNSW index for cosine similarity search
- Add match_agents_by_embedding() function for semantic search

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: 添加 OpenAI API 环境变量配置

**Files:**
- Modify: `packages/config/src/env.ts:39-72`
- Modify: `apps/api/.env.example`

**Step 1: 编辑环境变量 Schema**

在 `packages/config/src/env.ts` 的 `envSchema` 中添加 OpenAI 配置：

```typescript
// 在 envSchema 对象中添加（约第 70 行附近，在 NEXT_PUBLIC_ 配置之前）

  // ========== OpenAI 配置 ==========
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
```

**Step 2: 更新 .env.example**

在 `apps/api/.env.example` 中添加：

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

**Step 3: 验证类型检查**

Run: `cd packages/config && pnpm typecheck`
Expected: 无类型错误

**Step 4: Commit**

```bash
git add packages/config/src/env.ts apps/api/.env.example
git commit -m "feat(config): add OpenAI API configuration for embeddings

- Add OPENAI_API_KEY env variable
- Add OPENAI_EMBEDDING_MODEL with default 'text-embedding-3-small'

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: 创建 Embedding Service

**Files:**
- Create: `apps/api/src/modules/embedding/embedding.service.ts`
- Create: `apps/api/src/modules/embedding/embedding.module.ts`

**Step 1: 创建 EmbeddingService**

```typescript
// apps/api/src/modules/embedding/embedding.service.ts
import { Injectable } from '@nestjs/common';

interface EmbeddingResponse {
  embedding: number[];
  model: string;
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
}

@Injectable()
export class EmbeddingService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl = 'https://api.openai.com/v1/embeddings';

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY ?? '';
    this.model = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';

    if (!this.apiKey) {
      console.warn('[EmbeddingService] OPENAI_API_KEY not configured, embedding features disabled');
    }
  }

  isEnabled(): boolean {
    return Boolean(this.apiKey);
  }

  getModel(): string {
    return this.model;
  }

  /**
   * 生成文本的向量表示
   * @param text 输入文本
   * @returns 1536 维向量
   */
  async generateEmbedding(text: string): Promise<EmbeddingResponse> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: text,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(error)}`
      );
    }

    const data = await response.json();
    const embeddingData = data.data[0];

    return {
      embedding: embeddingData.embedding,
      model: data.model,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        totalTokens: data.usage.total_tokens,
      },
    };
  }

  /**
   * 批量生成向量（用于批量更新场景）
   * @param texts 输入文本数组
   * @returns 向量数组
   */
  async generateEmbeddings(texts: string[]): Promise<EmbeddingResponse[]> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(error)}`
      );
    }

    const data = await response.json();

    return data.data.map(
      (item: { embedding: number[]; index: number }, index: number) => ({
        embedding: item.embedding,
        model: data.model,
        usage: {
          promptTokens: Math.floor(data.usage.prompt_tokens / texts.length),
          totalTokens: Math.floor(data.usage.total_tokens / texts.length),
        },
      })
    );
  }

  /**
   * 构建 Agent 的 embedding 文本内容
   * 格式：名称 + 描述 + 标签
   */
  buildAgentEmbeddingText(agent: {
    name: string;
    description: string;
    tags: string[];
  }): string {
    const parts = [
      `Name: ${agent.name}`,
      `Description: ${agent.description}`,
    ];

    if (agent.tags.length > 0) {
      parts.push(`Tags: ${agent.tags.join(', ')}`);
    }

    return parts.join('\n');
  }

  /**
   * 构建 Task 的 embedding 文本内容
   * 格式：标题 + 描述 + 类型 + 标签
   */
  buildTaskEmbeddingText(task: {
    title: string;
    description: string;
    type: string;
    tags: string[];
  }): string {
    const parts = [
      `Title: ${task.title}`,
      `Description: ${task.description}`,
      `Type: ${task.type}`,
    ];

    if (task.tags.length > 0) {
      parts.push(`Tags: ${task.tags.join(', ')}`);
    }

    return parts.join('\n');
  }
}
```

**Step 2: 创建 EmbeddingModule**

```typescript
// apps/api/src/modules/embedding/embedding.module.ts
import { Module } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';

@Module({
  providers: [EmbeddingService],
  exports: [EmbeddingService],
})
export class EmbeddingModule {}
```

**Step 3: 验证类型检查**

Run: `cd apps/api && pnpm typecheck`
Expected: 无类型错误

**Step 4: Commit**

```bash
git add apps/api/src/modules/embedding/
git commit -m "feat(api): add EmbeddingService for OpenAI text-embedding-3-small

- Create EmbeddingService with generateEmbedding/generateEmbeddings methods
- Add helper methods for building Agent/Task embedding text
- Create EmbeddingModule for dependency injection

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: 创建 EmbeddingService 单元测试

**Files:**
- Create: `apps/api/src/modules/embedding/__tests__/embedding.service.spec.ts`

**Step 1: 编写测试文件**

```typescript
// apps/api/src/modules/embedding/__tests__/embedding.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { EmbeddingService } from '../embedding.service';

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  const originalEnv = process.env;

  beforeEach(async () => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isEnabled', () => {
    it('should return false when OPENAI_API_KEY is not set', async () => {
      delete process.env.OPENAI_API_KEY;

      const module: TestingModule = await Test.createTestingModule({
        providers: [EmbeddingService],
      }).compile();

      service = module.get<EmbeddingService>(EmbeddingService);
      expect(service.isEnabled()).toBe(false);
    });

    it('should return true when OPENAI_API_KEY is set', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';

      const module: TestingModule = await Test.createTestingModule({
        providers: [EmbeddingService],
      }).compile();

      service = module.get<EmbeddingService>(EmbeddingService);
      expect(service.isEnabled()).toBe(true);
    });
  });

  describe('getModel', () => {
    it('should return default model when OPENAI_EMBEDDING_MODEL is not set', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      delete process.env.OPENAI_EMBEDDING_MODEL;

      const module: TestingModule = await Test.createTestingModule({
        providers: [EmbeddingService],
      }).compile();

      service = module.get<EmbeddingService>(EmbeddingService);
      expect(service.getModel()).toBe('text-embedding-3-small');
    });

    it('should return custom model when OPENAI_EMBEDDING_MODEL is set', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.OPENAI_EMBEDDING_MODEL = 'text-embedding-3-large';

      const module: TestingModule = await Test.createTestingModule({
        providers: [EmbeddingService],
      }).compile();

      service = module.get<EmbeddingService>(EmbeddingService);
      expect(service.getModel()).toBe('text-embedding-3-large');
    });
  });

  describe('buildAgentEmbeddingText', () => {
    beforeEach(async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';

      const module: TestingModule = await Test.createTestingModule({
        providers: [EmbeddingService],
      }).compile();

      service = module.get<EmbeddingService>(EmbeddingService);
    });

    it('should build text with name and description', () => {
      const result = service.buildAgentEmbeddingText({
        name: 'Test Agent',
        description: 'A test agent for unit testing',
        tags: [],
      });

      expect(result).toBe(
        'Name: Test Agent\nDescription: A test agent for unit testing'
      );
    });

    it('should include tags when present', () => {
      const result = service.buildAgentEmbeddingText({
        name: 'Test Agent',
        description: 'A test agent',
        tags: ['coding', 'python', 'automation'],
      });

      expect(result).toBe(
        'Name: Test Agent\nDescription: A test agent\nTags: coding, python, automation'
      );
    });
  });

  describe('buildTaskEmbeddingText', () => {
    beforeEach(async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';

      const module: TestingModule = await Test.createTestingModule({
        providers: [EmbeddingService],
      }).compile();

      service = module.get<EmbeddingService>(EmbeddingService);
    });

    it('should build text with title, description, and type', () => {
      const result = service.buildTaskEmbeddingText({
        title: 'Build a website',
        description: 'Create a responsive landing page',
        type: 'website',
        tags: [],
      });

      expect(result).toBe(
        'Title: Build a website\nDescription: Create a responsive landing page\nType: website'
      );
    });

    it('should include tags when present', () => {
      const result = service.buildTaskEmbeddingText({
        title: 'Write Python script',
        description: 'Automate data processing',
        type: 'code',
        tags: ['python', 'automation'],
      });

      expect(result).toBe(
        'Title: Write Python script\nDescription: Automate data processing\nType: code\nTags: python, automation'
      );
    });
  });

  describe('generateEmbedding', () => {
    it('should throw error when API key is not configured', async () => {
      delete process.env.OPENAI_API_KEY;

      const module: TestingModule = await Test.createTestingModule({
        providers: [EmbeddingService],
      }).compile();

      service = module.get<EmbeddingService>(EmbeddingService);

      await expect(service.generateEmbedding('test')).rejects.toThrow(
        'OpenAI API key not configured'
      );
    });
  });
});
```

**Step 2: 运行测试验证**

Run: `cd apps/api && pnpm test -- --testPathPattern=embedding.service.spec.ts`
Expected: 所有测试通过

**Step 3: Commit**

```bash
git add apps/api/src/modules/embedding/__tests__/
git commit -m "test(api): add EmbeddingService unit tests

- Test isEnabled() based on OPENAI_API_KEY presence
- Test getModel() with default and custom values
- Test buildAgentEmbeddingText() text construction
- Test buildTaskEmbeddingText() text construction
- Test generateEmbedding() error handling

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: 创建 AgentEmbedding Repository

**Files:**
- Create: `apps/api/src/modules/agent-embedding/agent-embedding.repository.ts`

**Step 1: 创建 Repository 文件**

```typescript
// apps/api/src/modules/agent-embedding/agent-embedding.repository.ts
import { Inject, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';

const AGENT_EMBEDDINGS_TABLE = 'agent_embeddings';

export interface AgentEmbeddingRow {
  id: string;
  agent_id: string;
  content_text: string;
  embedding: string; // pgvector 返回为字符串
  model_id: string;
  created_at: string;
  updated_at: string;
}

export interface AgentEmbedding {
  id: string;
  agentId: string;
  contentText: string;
  embedding: number[];
  modelId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MatchedAgent {
  agentId: string;
  similarity: number;
}

function parseEmbeddingVector(vectorStr: string): number[] {
  // pgvector 返回格式: "[0.1,0.2,...]"
  return JSON.parse(vectorStr);
}

function toAgentEmbedding(row: AgentEmbeddingRow): AgentEmbedding {
  return {
    id: row.id,
    agentId: row.agent_id,
    contentText: row.content_text,
    embedding: parseEmbeddingVector(row.embedding),
    modelId: row.model_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function ensureNoError(error: unknown, context: string): void {
  if (!error) return;
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(`${context}: ${message}`);
}

@Injectable()
export class AgentEmbeddingRepository {
  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  /**
   * 创建或更新 Agent embedding
   * 使用 upsert 确保每个 agent 只有一条记录
   */
  async upsertEmbedding(input: {
    agentId: string;
    contentText: string;
    embedding: number[];
    modelId: string;
  }): Promise<AgentEmbedding> {
    // 格式化向量为 pgvector 格式
    const vectorStr = `[${input.embedding.join(',')}]`;

    const { data, error } = await this.supabase
      .query<AgentEmbeddingRow>(AGENT_EMBEDDINGS_TABLE)
      .upsert(
        {
          agent_id: input.agentId,
          content_text: input.contentText,
          embedding: vectorStr,
          model_id: input.modelId,
        },
        { onConflict: 'agent_id' }
      )
      .select('*')
      .single();

    ensureNoError(error, 'Failed to upsert agent embedding');
    if (!data) throw new Error('Failed to upsert agent embedding: empty response');

    return toAgentEmbedding(data);
  }

  /**
   * 根据 agentId 获取 embedding
   */
  async findByAgentId(agentId: string): Promise<AgentEmbedding | null> {
    const { data, error } = await this.supabase
      .query<AgentEmbeddingRow>(AGENT_EMBEDDINGS_TABLE)
      .select('*')
      .eq('agent_id', agentId)
      .maybeSingle();

    ensureNoError(error, 'Failed to find agent embedding');
    if (!data) return null;

    return toAgentEmbedding(data);
  }

  /**
   * 删除 Agent embedding
   */
  async deleteByAgentId(agentId: string): Promise<void> {
    const { error } = await this.supabase
      .query(AGENT_EMBEDDINGS_TABLE)
      .delete()
      .eq('agent_id', agentId);

    ensureNoError(error, 'Failed to delete agent embedding');
  }

  /**
   * 基于向量相似度搜索匹配的 Agent
   * 调用数据库函数 match_agents_by_embedding
   */
  async matchAgentsByEmbedding(
    queryEmbedding: number[],
    options: {
      matchThreshold?: number;
      matchCount?: number;
    } = {}
  ): Promise<MatchedAgent[]> {
    const { matchThreshold = 0.5, matchCount = 15 } = options;
    const vectorStr = `[${queryEmbedding.join(',')}]`;

    const { data, error } = await this.supabase.rpc('match_agents_by_embedding', {
      query_embedding: vectorStr,
      match_threshold: matchThreshold,
      match_count: matchCount,
    });

    ensureNoError(error, 'Failed to match agents by embedding');

    return (data ?? []).map((row: { agent_id: string; similarity: number }) => ({
      agentId: row.agent_id,
      similarity: row.similarity,
    }));
  }
}
```

**Step 2: 验证类型检查**

Run: `cd apps/api && pnpm typecheck`
Expected: 无类型错误

**Step 3: Commit**

```bash
git add apps/api/src/modules/agent-embedding/agent-embedding.repository.ts
git commit -m "feat(api): add AgentEmbeddingRepository for vector storage

- Implement upsertEmbedding() for create/update
- Implement findByAgentId() for querying
- Implement deleteByAgentId() for cleanup
- Implement matchAgentsByEmbedding() calling pgvector function

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: 创建 AgentEmbedding Service

**Files:**
- Create: `apps/api/src/modules/agent-embedding/agent-embedding.service.ts`
- Create: `apps/api/src/modules/agent-embedding/agent-embedding.module.ts`

**Step 1: 创建 AgentEmbeddingService**

```typescript
// apps/api/src/modules/agent-embedding/agent-embedding.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { EmbeddingService } from '../embedding/embedding.service';
import { AgentEmbeddingRepository, MatchedAgent } from './agent-embedding.repository';

export interface AgentForEmbedding {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

@Injectable()
export class AgentEmbeddingService {
  constructor(
    @Inject(AgentEmbeddingRepository)
    private readonly repository: AgentEmbeddingRepository,
    @Inject(EmbeddingService)
    private readonly embeddingService: EmbeddingService
  ) {}

  /**
   * 检查 embedding 功能是否可用
   */
  isEnabled(): boolean {
    return this.embeddingService.isEnabled();
  }

  /**
   * 为 Agent 生成并存储 embedding
   * 在 Agent 创建或更新时调用
   */
  async updateAgentEmbedding(agent: AgentForEmbedding): Promise<void> {
    if (!this.isEnabled()) {
      console.warn('[AgentEmbeddingService] Embedding service not enabled, skipping');
      return;
    }

    try {
      const contentText = this.embeddingService.buildAgentEmbeddingText({
        name: agent.name,
        description: agent.description,
        tags: agent.tags,
      });

      const result = await this.embeddingService.generateEmbedding(contentText);

      await this.repository.upsertEmbedding({
        agentId: agent.id,
        contentText,
        embedding: result.embedding,
        modelId: result.model,
      });

      console.log(
        `[AgentEmbeddingService] Updated embedding for agent ${agent.id}, tokens: ${result.usage.totalTokens}`
      );
    } catch (error) {
      // 记录错误但不抛出，embedding 更新失败不应影响主流程
      console.error(
        `[AgentEmbeddingService] Failed to update embedding for agent ${agent.id}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  /**
   * 删除 Agent 的 embedding
   * 在 Agent 删除时调用
   */
  async deleteAgentEmbedding(agentId: string): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    try {
      await this.repository.deleteByAgentId(agentId);
      console.log(`[AgentEmbeddingService] Deleted embedding for agent ${agentId}`);
    } catch (error) {
      console.error(
        `[AgentEmbeddingService] Failed to delete embedding for agent ${agentId}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  /**
   * 基于 Task 信息搜索匹配的 Agent
   * @returns 按相似度排序的 Agent ID 列表
   */
  async searchAgentsByTask(task: {
    title: string;
    description: string;
    type: string;
    tags: string[];
  }): Promise<MatchedAgent[]> {
    if (!this.isEnabled()) {
      console.warn('[AgentEmbeddingService] Embedding service not enabled, returning empty');
      return [];
    }

    const contentText = this.embeddingService.buildTaskEmbeddingText(task);
    const result = await this.embeddingService.generateEmbedding(contentText);

    const matchedAgents = await this.repository.matchAgentsByEmbedding(
      result.embedding,
      {
        matchThreshold: 0.3, // 较低阈值以获取更多候选
        matchCount: 15,
      }
    );

    return matchedAgents;
  }
}
```

**Step 2: 创建 AgentEmbeddingModule**

```typescript
// apps/api/src/modules/agent-embedding/agent-embedding.module.ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { EmbeddingModule } from '../embedding/embedding.module';
import { AgentEmbeddingRepository } from './agent-embedding.repository';
import { AgentEmbeddingService } from './agent-embedding.service';

@Module({
  imports: [DatabaseModule, EmbeddingModule],
  providers: [AgentEmbeddingRepository, AgentEmbeddingService],
  exports: [AgentEmbeddingService],
})
export class AgentEmbeddingModule {}
```

**Step 3: 验证类型检查**

Run: `cd apps/api && pnpm typecheck`
Expected: 无类型错误

**Step 4: Commit**

```bash
git add apps/api/src/modules/agent-embedding/
git commit -m "feat(api): add AgentEmbeddingService for vector operations

- Implement updateAgentEmbedding() for Agent create/update
- Implement deleteAgentEmbedding() for Agent deletion
- Implement searchAgentsByTask() for semantic search
- Create AgentEmbeddingModule with proper DI setup

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: 创建 AgentEmbeddingService 单元测试

**Files:**
- Create: `apps/api/src/modules/agent-embedding/__tests__/agent-embedding.service.spec.ts`

**Step 1: 编写测试文件**

```typescript
// apps/api/src/modules/agent-embedding/__tests__/agent-embedding.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { EmbeddingService } from '../../embedding/embedding.service';
import { AgentEmbeddingRepository } from '../agent-embedding.repository';
import { AgentEmbeddingService } from '../agent-embedding.service';

describe('AgentEmbeddingService', () => {
  let service: AgentEmbeddingService;

  const mockRepository = {
    upsertEmbedding: jest.fn(),
    findByAgentId: jest.fn(),
    deleteByAgentId: jest.fn(),
    matchAgentsByEmbedding: jest.fn(),
  };

  const mockEmbeddingService = {
    isEnabled: jest.fn(),
    getModel: jest.fn(),
    generateEmbedding: jest.fn(),
    buildAgentEmbeddingText: jest.fn(),
    buildTaskEmbeddingText: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentEmbeddingService,
        { provide: AgentEmbeddingRepository, useValue: mockRepository },
        { provide: EmbeddingService, useValue: mockEmbeddingService },
      ],
    }).compile();

    service = module.get<AgentEmbeddingService>(AgentEmbeddingService);
    jest.clearAllMocks();
  });

  describe('isEnabled', () => {
    it('should delegate to EmbeddingService.isEnabled', () => {
      mockEmbeddingService.isEnabled.mockReturnValue(true);
      expect(service.isEnabled()).toBe(true);

      mockEmbeddingService.isEnabled.mockReturnValue(false);
      expect(service.isEnabled()).toBe(false);
    });
  });

  describe('updateAgentEmbedding', () => {
    const mockAgent = {
      id: 'agent-1',
      name: 'Test Agent',
      description: 'A test agent',
      tags: ['test', 'coding'],
    };

    it('should skip when embedding service is disabled', async () => {
      mockEmbeddingService.isEnabled.mockReturnValue(false);

      await service.updateAgentEmbedding(mockAgent);

      expect(mockEmbeddingService.generateEmbedding).not.toHaveBeenCalled();
      expect(mockRepository.upsertEmbedding).not.toHaveBeenCalled();
    });

    it('should generate and store embedding when enabled', async () => {
      mockEmbeddingService.isEnabled.mockReturnValue(true);
      mockEmbeddingService.buildAgentEmbeddingText.mockReturnValue(
        'Name: Test Agent\nDescription: A test agent\nTags: test, coding'
      );
      mockEmbeddingService.generateEmbedding.mockResolvedValue({
        embedding: [0.1, 0.2, 0.3],
        model: 'text-embedding-3-small',
        usage: { promptTokens: 10, totalTokens: 10 },
      });
      mockRepository.upsertEmbedding.mockResolvedValue({});

      await service.updateAgentEmbedding(mockAgent);

      expect(mockEmbeddingService.buildAgentEmbeddingText).toHaveBeenCalledWith({
        name: mockAgent.name,
        description: mockAgent.description,
        tags: mockAgent.tags,
      });
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith(
        'Name: Test Agent\nDescription: A test agent\nTags: test, coding'
      );
      expect(mockRepository.upsertEmbedding).toHaveBeenCalledWith({
        agentId: 'agent-1',
        contentText: 'Name: Test Agent\nDescription: A test agent\nTags: test, coding',
        embedding: [0.1, 0.2, 0.3],
        modelId: 'text-embedding-3-small',
      });
    });

    it('should not throw when embedding generation fails', async () => {
      mockEmbeddingService.isEnabled.mockReturnValue(true);
      mockEmbeddingService.buildAgentEmbeddingText.mockReturnValue('text');
      mockEmbeddingService.generateEmbedding.mockRejectedValue(
        new Error('API error')
      );

      // Should not throw
      await expect(service.updateAgentEmbedding(mockAgent)).resolves.not.toThrow();
    });
  });

  describe('deleteAgentEmbedding', () => {
    it('should skip when embedding service is disabled', async () => {
      mockEmbeddingService.isEnabled.mockReturnValue(false);

      await service.deleteAgentEmbedding('agent-1');

      expect(mockRepository.deleteByAgentId).not.toHaveBeenCalled();
    });

    it('should delete embedding when enabled', async () => {
      mockEmbeddingService.isEnabled.mockReturnValue(true);
      mockRepository.deleteByAgentId.mockResolvedValue(undefined);

      await service.deleteAgentEmbedding('agent-1');

      expect(mockRepository.deleteByAgentId).toHaveBeenCalledWith('agent-1');
    });
  });

  describe('searchAgentsByTask', () => {
    const mockTask = {
      title: 'Build a website',
      description: 'Create a landing page',
      type: 'website',
      tags: ['web', 'frontend'],
    };

    it('should return empty array when embedding service is disabled', async () => {
      mockEmbeddingService.isEnabled.mockReturnValue(false);

      const result = await service.searchAgentsByTask(mockTask);

      expect(result).toEqual([]);
      expect(mockEmbeddingService.generateEmbedding).not.toHaveBeenCalled();
    });

    it('should search and return matched agents', async () => {
      mockEmbeddingService.isEnabled.mockReturnValue(true);
      mockEmbeddingService.buildTaskEmbeddingText.mockReturnValue(
        'Title: Build a website\nDescription: Create a landing page\nType: website\nTags: web, frontend'
      );
      mockEmbeddingService.generateEmbedding.mockResolvedValue({
        embedding: [0.1, 0.2, 0.3],
        model: 'text-embedding-3-small',
        usage: { promptTokens: 15, totalTokens: 15 },
      });
      mockRepository.matchAgentsByEmbedding.mockResolvedValue([
        { agentId: 'agent-1', similarity: 0.95 },
        { agentId: 'agent-2', similarity: 0.85 },
      ]);

      const result = await service.searchAgentsByTask(mockTask);

      expect(result).toEqual([
        { agentId: 'agent-1', similarity: 0.95 },
        { agentId: 'agent-2', similarity: 0.85 },
      ]);
      expect(mockRepository.matchAgentsByEmbedding).toHaveBeenCalledWith(
        [0.1, 0.2, 0.3],
        { matchThreshold: 0.3, matchCount: 15 }
      );
    });
  });
});
```

**Step 2: 运行测试验证**

Run: `cd apps/api && pnpm test -- --testPathPattern=agent-embedding.service.spec.ts`
Expected: 所有测试通过

**Step 3: Commit**

```bash
git add apps/api/src/modules/agent-embedding/__tests__/
git commit -m "test(api): add AgentEmbeddingService unit tests

- Test isEnabled() delegation
- Test updateAgentEmbedding() with enabled/disabled states
- Test deleteAgentEmbedding() behavior
- Test searchAgentsByTask() semantic search

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: 集成 Embedding 到 AgentService

**Files:**
- Modify: `apps/api/src/modules/agent/agent.service.ts`
- Modify: `apps/api/src/modules/agent/agent.module.ts`

**Step 1: 修改 AgentService 注入 AgentEmbeddingService**

在 `apps/api/src/modules/agent/agent.service.ts` 中：

1. 添加 import：
```typescript
import { AgentEmbeddingService } from '../agent-embedding/agent-embedding.service';
```

2. 修改 constructor：
```typescript
constructor(
  @Inject(AgentRepository) private readonly repository: AgentRepository,
  @Inject(MastraTokenService) private readonly mastraTokenService: MastraTokenService,
  @Inject(AgentEmbeddingService) private readonly agentEmbeddingService: AgentEmbeddingService
) {}
```

3. 在 `createAgent` 方法末尾添加（return 之前）：
```typescript
    // 异步更新 embedding（不阻塞主流程）
    this.agentEmbeddingService.updateAgentEmbedding({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      tags: agent.tags,
    });

    return agent;
```

4. 在 `updateAgent` 方法的 `return updated;` 之前添加：
```typescript
    // 如果更新了影响 embedding 的字段，异步更新 embedding
    if (input.name !== undefined || input.description !== undefined || input.tags !== undefined) {
      this.agentEmbeddingService.updateAgentEmbedding({
        id: updated.id,
        name: updated.name,
        description: updated.description,
        tags: updated.tags,
      });
    }

    return updated;
```

**Step 2: 修改 AgentModule 导入 AgentEmbeddingModule**

在 `apps/api/src/modules/agent/agent.module.ts` 中添加导入：

```typescript
import { AgentEmbeddingModule } from '../agent-embedding/agent-embedding.module';

@Module({
  imports: [DatabaseModule, MastraTokenModule, AgentEmbeddingModule],
  // ...
})
```

**Step 3: 验证类型检查**

Run: `cd apps/api && pnpm typecheck`
Expected: 无类型错误

**Step 4: Commit**

```bash
git add apps/api/src/modules/agent/
git commit -m "feat(api): integrate embedding updates into AgentService

- Inject AgentEmbeddingService into AgentService
- Call updateAgentEmbedding on agent creation
- Call updateAgentEmbedding on agent update (when relevant fields change)
- Import AgentEmbeddingModule in AgentModule

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: 更新 AgentService 单元测试

**Files:**
- Modify: `apps/api/src/modules/agent/__tests__/agent.service.spec.ts`

**Step 1: 更新测试文件添加 mock**

添加 AgentEmbeddingService mock 和 MastraTokenService mock：

```typescript
// 在 mockRepository 后添加
const mockMastraTokenService = {
  getToken: jest.fn(),
};

const mockAgentEmbeddingService = {
  updateAgentEmbedding: jest.fn(),
  deleteAgentEmbedding: jest.fn(),
  searchAgentsByTask: jest.fn(),
  isEnabled: jest.fn().mockReturnValue(true),
};
```

更新 providers：
```typescript
providers: [
  AgentService,
  { provide: AgentRepository, useValue: mockRepository },
  { provide: MastraTokenService, useValue: mockMastraTokenService },
  { provide: AgentEmbeddingService, useValue: mockAgentEmbeddingService },
],
```

添加 import：
```typescript
import { MastraTokenService } from '../../mastra-token/mastra-token.service';
import { AgentEmbeddingService } from '../../agent-embedding/agent-embedding.service';
```

**Step 2: 添加 embedding 相关测试**

在 createAgent describe 块中添加：
```typescript
it('should call updateAgentEmbedding after creation', async () => {
  const mockAgent = { /* ... existing mock ... */ };
  mockRepository.createAgent.mockResolvedValue(mockAgent);

  await service.createAgent('user-1', validCreateInput);

  expect(mockAgentEmbeddingService.updateAgentEmbedding).toHaveBeenCalledWith({
    id: mockAgent.id,
    name: mockAgent.name,
    description: mockAgent.description,
    tags: mockAgent.tags,
  });
});
```

**Step 3: 运行测试验证**

Run: `cd apps/api && pnpm test -- --testPathPattern=agent.service.spec.ts`
Expected: 所有测试通过

**Step 4: Commit**

```bash
git add apps/api/src/modules/agent/__tests__/
git commit -m "test(api): update AgentService tests with embedding mocks

- Add MastraTokenService mock
- Add AgentEmbeddingService mock
- Test updateAgentEmbedding called on agent creation

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 10: 创建 Agent 推荐服务（洗牌算法）

**Files:**
- Create: `apps/api/src/modules/agent-recommendation/agent-recommendation.service.ts`
- Create: `apps/api/src/modules/agent-recommendation/agent-recommendation.module.ts`

**Step 1: 创建 AgentRecommendationService**

```typescript
// apps/api/src/modules/agent-recommendation/agent-recommendation.service.ts
import { type Agent } from '@c2c-agents/shared';
import { Inject, Injectable } from '@nestjs/common';
import { AgentRepository } from '../agent/agent.repository';
import { AgentEmbeddingService } from '../agent-embedding/agent-embedding.service';

export interface RecommendedAgent {
  agent: Agent;
  similarity: number;
  score: number;
}

export interface RecommendationResult {
  candidates: RecommendedAgent[];
  recommended: RecommendedAgent[];
}

@Injectable()
export class AgentRecommendationService {
  constructor(
    @Inject(AgentEmbeddingService)
    private readonly agentEmbeddingService: AgentEmbeddingService,
    @Inject(AgentRepository)
    private readonly agentRepository: AgentRepository
  ) {}

  /**
   * 基于 Task 信息推荐最优 Agent
   * 1. 通过向量搜索召回最多 15 个候选 Agent
   * 2. 应用洗牌算法，综合考虑相似度、评分、完成订单数
   * 3. 返回最优的 3 个 Agent
   */
  async recommendAgentsForTask(task: {
    title: string;
    description: string;
    type: string;
    tags: string[];
    expectedReward: string;
  }): Promise<RecommendationResult> {
    // 1. 通过向量搜索召回候选 Agent
    const matchedAgents = await this.agentEmbeddingService.searchAgentsByTask({
      title: task.title,
      description: task.description,
      type: task.type,
      tags: task.tags,
    });

    if (matchedAgents.length === 0) {
      return { candidates: [], recommended: [] };
    }

    // 2. 批量获取 Agent 详情
    const agentIds = matchedAgents.map((m) => m.agentId);
    const agents = await this.fetchAgentsByIds(agentIds);

    // 3. 过滤：只保留价格范围匹配的 Agent
    const reward = BigInt(task.expectedReward);
    const filteredAgents = agents.filter((agent) => {
      const minPrice = BigInt(agent.minPrice);
      const maxPrice = BigInt(agent.maxPrice);
      return reward >= minPrice && reward <= maxPrice;
    });

    // 4. 构建候选列表（包含相似度信息）
    const candidates: RecommendedAgent[] = filteredAgents.map((agent) => {
      const match = matchedAgents.find((m) => m.agentId === agent.id);
      const similarity = match?.similarity ?? 0;
      return {
        agent,
        similarity,
        score: this.calculateScore(agent, similarity),
      };
    });

    // 5. 洗牌算法：按综合得分排序，取前 3 个
    const recommended = this.shuffle(candidates, 3);

    return { candidates, recommended };
  }

  /**
   * 计算综合得分
   * 权重分配：
   * - 语义相似度：40%
   * - 平均评分（归一化到 0-1）：30%
   * - 完成订单数（归一化，上限 100）：20%
   * - 随机因子：10%（引入多样性）
   */
  private calculateScore(agent: Agent, similarity: number): number {
    // 相似度权重 40%
    const similarityScore = similarity * 0.4;

    // 评分权重 30%（5 分制归一化到 0-1）
    const ratingScore = (agent.avgRating / 5) * 0.3;

    // 完成订单数权重 20%（上限 100 单归一化）
    const completionScore = (Math.min(agent.completedOrderCount, 100) / 100) * 0.2;

    // 随机因子 10%（引入多样性）
    const randomFactor = Math.random() * 0.1;

    return similarityScore + ratingScore + completionScore + randomFactor;
  }

  /**
   * 洗牌算法：按综合得分排序，取前 N 个
   * 使用加权随机选择以增加多样性
   */
  private shuffle(candidates: RecommendedAgent[], count: number): RecommendedAgent[] {
    if (candidates.length <= count) {
      return [...candidates].sort((a, b) => b.score - a.score);
    }

    // 按得分排序
    const sorted = [...candidates].sort((a, b) => b.score - a.score);

    // 从前 2N 个中随机选择 N 个（如果足够）
    const pool = sorted.slice(0, Math.min(count * 2, sorted.length));
    const selected: RecommendedAgent[] = [];

    while (selected.length < count && pool.length > 0) {
      // 使用加权随机选择
      const totalScore = pool.reduce((sum, c) => sum + c.score, 0);
      let random = Math.random() * totalScore;

      for (let i = 0; i < pool.length; i++) {
        random -= pool[i].score;
        if (random <= 0) {
          selected.push(pool.splice(i, 1)[0]);
          break;
        }
      }

      // 兜底：如果没有选中（浮点误差），选第一个
      if (selected.length < count && random > 0 && pool.length > 0) {
        selected.push(pool.shift()!);
      }
    }

    return selected.sort((a, b) => b.score - a.score);
  }

  /**
   * 批量获取 Agent 详情
   */
  private async fetchAgentsByIds(agentIds: string[]): Promise<Agent[]> {
    const agents: Agent[] = [];
    for (const id of agentIds) {
      const agent = await this.agentRepository.findAgentById(id);
      if (agent && agent.isListed) {
        agents.push(agent);
      }
    }
    return agents;
  }
}
```

**Step 2: 创建 AgentRecommendationModule**

```typescript
// apps/api/src/modules/agent-recommendation/agent-recommendation.module.ts
import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { AgentEmbeddingModule } from '../agent-embedding/agent-embedding.module';
import { AgentRecommendationService } from './agent-recommendation.service';

@Module({
  imports: [AgentEmbeddingModule, AgentModule],
  providers: [AgentRecommendationService],
  exports: [AgentRecommendationService],
})
export class AgentRecommendationModule {}
```

**Step 3: 验证类型检查**

Run: `cd apps/api && pnpm typecheck`
Expected: 无类型错误

**Step 4: Commit**

```bash
git add apps/api/src/modules/agent-recommendation/
git commit -m "feat(api): add AgentRecommendationService with shuffle algorithm

- Implement recommendAgentsForTask() for semantic matching
- Add calculateScore() with weighted factors (similarity 40%, rating 30%, orders 20%, random 10%)
- Add shuffle() for diverse selection from top candidates
- Create AgentRecommendationModule with proper DI

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 11: 创建 AgentRecommendationService 单元测试

**Files:**
- Create: `apps/api/src/modules/agent-recommendation/__tests__/agent-recommendation.service.spec.ts`

**Step 1: 编写测试文件**

```typescript
// apps/api/src/modules/agent-recommendation/__tests__/agent-recommendation.service.spec.ts
import { AgentStatus } from '@c2c-agents/shared';
import { Test, TestingModule } from '@nestjs/testing';
import { AgentRepository } from '../../agent/agent.repository';
import { AgentEmbeddingService } from '../../agent-embedding/agent-embedding.service';
import { AgentRecommendationService } from '../agent-recommendation.service';

describe('AgentRecommendationService', () => {
  let service: AgentRecommendationService;

  const mockAgentEmbeddingService = {
    searchAgentsByTask: jest.fn(),
    isEnabled: jest.fn().mockReturnValue(true),
  };

  const mockAgentRepository = {
    findAgentById: jest.fn(),
  };

  const createMockAgent = (id: string, overrides = {}) => ({
    id,
    ownerId: 'user-1',
    name: `Agent ${id}`,
    description: `Description for ${id}`,
    avatarUrl: null,
    mastraUrl: 'https://mastra.cloud/agent/test',
    mastraTokenId: null,
    tags: ['test'],
    supportedTaskTypes: ['writing' as const],
    minPrice: '1000000',
    maxPrice: '10000000',
    avgRating: 4.0,
    ratingCount: 10,
    completedOrderCount: 5,
    status: AgentStatus.Idle,
    currentOrderId: null,
    queueSize: 0,
    isListed: true,
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentRecommendationService,
        { provide: AgentEmbeddingService, useValue: mockAgentEmbeddingService },
        { provide: AgentRepository, useValue: mockAgentRepository },
      ],
    }).compile();

    service = module.get<AgentRecommendationService>(AgentRecommendationService);
    jest.clearAllMocks();
  });

  describe('recommendAgentsForTask', () => {
    const mockTask = {
      title: 'Build a website',
      description: 'Create a landing page',
      type: 'website',
      tags: ['web'],
      expectedReward: '5000000',
    };

    it('should return empty result when no matches found', async () => {
      mockAgentEmbeddingService.searchAgentsByTask.mockResolvedValue([]);

      const result = await service.recommendAgentsForTask(mockTask);

      expect(result).toEqual({ candidates: [], recommended: [] });
    });

    it('should filter agents by price range', async () => {
      mockAgentEmbeddingService.searchAgentsByTask.mockResolvedValue([
        { agentId: 'agent-1', similarity: 0.9 },
        { agentId: 'agent-2', similarity: 0.8 },
      ]);

      // agent-1 price range includes task reward, agent-2 does not
      mockAgentRepository.findAgentById.mockImplementation((id: string) => {
        if (id === 'agent-1') {
          return Promise.resolve(createMockAgent('agent-1'));
        }
        if (id === 'agent-2') {
          return Promise.resolve(
            createMockAgent('agent-2', {
              minPrice: '100000000', // Too high
              maxPrice: '200000000',
            })
          );
        }
        return Promise.resolve(null);
      });

      const result = await service.recommendAgentsForTask(mockTask);

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].agent.id).toBe('agent-1');
    });

    it('should return at most 3 recommended agents', async () => {
      const matches = Array.from({ length: 10 }, (_, i) => ({
        agentId: `agent-${i}`,
        similarity: 0.9 - i * 0.05,
      }));
      mockAgentEmbeddingService.searchAgentsByTask.mockResolvedValue(matches);

      mockAgentRepository.findAgentById.mockImplementation((id: string) => {
        return Promise.resolve(createMockAgent(id));
      });

      const result = await service.recommendAgentsForTask(mockTask);

      expect(result.recommended).toHaveLength(3);
      expect(result.candidates).toHaveLength(10);
    });

    it('should exclude unlisted agents', async () => {
      mockAgentEmbeddingService.searchAgentsByTask.mockResolvedValue([
        { agentId: 'agent-1', similarity: 0.9 },
        { agentId: 'agent-2', similarity: 0.8 },
      ]);

      mockAgentRepository.findAgentById.mockImplementation((id: string) => {
        if (id === 'agent-1') {
          return Promise.resolve(createMockAgent('agent-1'));
        }
        if (id === 'agent-2') {
          return Promise.resolve(createMockAgent('agent-2', { isListed: false }));
        }
        return Promise.resolve(null);
      });

      const result = await service.recommendAgentsForTask(mockTask);

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].agent.id).toBe('agent-1');
    });

    it('should include similarity and score in result', async () => {
      mockAgentEmbeddingService.searchAgentsByTask.mockResolvedValue([
        { agentId: 'agent-1', similarity: 0.9 },
      ]);
      mockAgentRepository.findAgentById.mockResolvedValue(createMockAgent('agent-1'));

      const result = await service.recommendAgentsForTask(mockTask);

      expect(result.candidates[0].similarity).toBe(0.9);
      expect(result.candidates[0].score).toBeGreaterThan(0);
    });
  });
});
```

**Step 2: 运行测试验证**

Run: `cd apps/api && pnpm test -- --testPathPattern=agent-recommendation.service.spec.ts`
Expected: 所有测试通过

**Step 3: Commit**

```bash
git add apps/api/src/modules/agent-recommendation/__tests__/
git commit -m "test(api): add AgentRecommendationService unit tests

- Test empty result when no matches
- Test price range filtering
- Test max 3 recommended agents limit
- Test unlisted agents exclusion
- Test similarity and score in results

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 12: 创建推荐 API 接口

**Files:**
- Create: `apps/api/src/modules/agent-recommendation/agent-recommendation.controller.ts`
- Create: `apps/api/src/modules/agent-recommendation/dtos/recommend-agents.dto.ts`
- Modify: `apps/api/src/modules/agent-recommendation/agent-recommendation.module.ts`

**Step 1: 创建 DTO**

```typescript
// apps/api/src/modules/agent-recommendation/dtos/recommend-agents.dto.ts
import type { TaskType } from '@c2c-agents/shared';

export class RecommendAgentsDto {
  title!: string;
  description!: string;
  type!: TaskType;
  tags?: string[];
  expectedReward!: string;
}
```

**Step 2: 创建 Controller**

```typescript
// apps/api/src/modules/agent-recommendation/agent-recommendation.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { AgentRecommendationService } from './agent-recommendation.service';
import type { RecommendAgentsDto } from './dtos/recommend-agents.dto';

@Controller('agents')
export class AgentRecommendationController {
  constructor(
    private readonly recommendationService: AgentRecommendationService
  ) {}

  /**
   * POST /agents/recommend
   * 基于 Task 信息推荐最优 Agent
   */
  @Post('recommend')
  async recommendAgents(@Body() dto: RecommendAgentsDto) {
    const result = await this.recommendationService.recommendAgentsForTask({
      title: dto.title,
      description: dto.description,
      type: dto.type,
      tags: dto.tags ?? [],
      expectedReward: dto.expectedReward,
    });

    return {
      candidates: result.candidates.map((c) => ({
        agent: c.agent,
        similarity: c.similarity,
        score: c.score,
      })),
      recommended: result.recommended.map((r) => ({
        agent: r.agent,
        similarity: r.similarity,
        score: r.score,
      })),
    };
  }
}
```

**Step 3: 更新 Module 添加 Controller**

```typescript
// apps/api/src/modules/agent-recommendation/agent-recommendation.module.ts
import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { AgentEmbeddingModule } from '../agent-embedding/agent-embedding.module';
import { AgentRecommendationController } from './agent-recommendation.controller';
import { AgentRecommendationService } from './agent-recommendation.service';

@Module({
  imports: [AgentEmbeddingModule, AgentModule],
  controllers: [AgentRecommendationController],
  providers: [AgentRecommendationService],
  exports: [AgentRecommendationService],
})
export class AgentRecommendationModule {}
```

**Step 4: 验证类型检查**

Run: `cd apps/api && pnpm typecheck`
Expected: 无类型错误

**Step 5: Commit**

```bash
git add apps/api/src/modules/agent-recommendation/
git commit -m "feat(api): add POST /agents/recommend endpoint

- Create RecommendAgentsDto for request validation
- Create AgentRecommendationController with recommend endpoint
- Return candidates (up to 15) and recommended (up to 3) agents

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 13: 注册新模块到 AppModule

**Files:**
- Modify: `apps/api/src/app.module.ts`

**Step 1: 添加 imports**

在 `apps/api/src/app.module.ts` 中添加：

```typescript
import { EmbeddingModule } from './modules/embedding/embedding.module';
import { AgentEmbeddingModule } from './modules/agent-embedding/agent-embedding.module';
import { AgentRecommendationModule } from './modules/agent-recommendation/agent-recommendation.module';
```

在 `@Module` 的 `imports` 数组中添加：
```typescript
EmbeddingModule,
AgentEmbeddingModule,
AgentRecommendationModule,
```

**Step 2: 验证类型检查**

Run: `cd apps/api && pnpm typecheck`
Expected: 无类型错误

**Step 3: Commit**

```bash
git add apps/api/src/app.module.ts
git commit -m "feat(api): register embedding and recommendation modules

- Import EmbeddingModule
- Import AgentEmbeddingModule
- Import AgentRecommendationModule

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 14: 运行所有测试确保无回归

**Step 1: 运行单元测试**

Run: `cd apps/api && pnpm test`
Expected: 所有测试通过

**Step 2: 运行类型检查**

Run: `pnpm typecheck`
Expected: 无类型错误

**Step 3: 运行 lint**

Run: `pnpm lint`
Expected: 无 lint 错误

**Step 4: Commit（如有修复）**

如果需要修复任何问题，在修复后提交：
```bash
git add -A
git commit -m "fix(api): address test/lint issues from vector search implementation

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 15: 编写集成测试

**Files:**
- Create: `apps/api/src/modules/agent-recommendation/__tests__/agent-recommendation.e2e.spec.ts`

**Step 1: 编写 E2E 测试**

```typescript
// apps/api/src/modules/agent-recommendation/__tests__/agent-recommendation.e2e.spec.ts
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';

describe('AgentRecommendation E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /agents/recommend', () => {
    it('should return 201 with valid request', async () => {
      const response = await request(app.getHttpServer())
        .post('/agents/recommend')
        .send({
          title: 'Build a website',
          description: 'Create a landing page for my startup',
          type: 'website',
          tags: ['web', 'frontend'],
          expectedReward: '5000000',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('candidates');
      expect(response.body).toHaveProperty('recommended');
      expect(Array.isArray(response.body.candidates)).toBe(true);
      expect(Array.isArray(response.body.recommended)).toBe(true);
    });

    it('should return empty arrays when no agents match', async () => {
      const response = await request(app.getHttpServer())
        .post('/agents/recommend')
        .send({
          title: 'Very specific task that no agent matches',
          description: 'xyzzy12345 unique description',
          type: 'other_mastra',
          tags: ['nonexistent-tag-12345'],
          expectedReward: '1',
        });

      expect(response.status).toBe(201);
      expect(response.body.candidates).toEqual([]);
      expect(response.body.recommended).toEqual([]);
    });
  });
});
```

**Step 2: 运行 E2E 测试（需要数据库连接）**

Run: `cd apps/api && pnpm test -- --testPathPattern=agent-recommendation.e2e.spec.ts --runInBand`
Expected: 测试通过（或根据环境配置调整）

**Step 3: Commit**

```bash
git add apps/api/src/modules/agent-recommendation/__tests__/agent-recommendation.e2e.spec.ts
git commit -m "test(api): add AgentRecommendation E2E tests

- Test POST /agents/recommend returns valid response
- Test empty result for non-matching queries

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary

本计划实现了以下功能：

1. **数据库层**
   - 添加 pgvector 扩展和 agent_embeddings 表
   - 创建 HNSW 索引优化相似度搜索
   - 创建 match_agents_by_embedding 函数

2. **服务层**
   - EmbeddingService: OpenAI API 封装
   - AgentEmbeddingService: Agent 向量化存储
   - AgentRecommendationService: 洗牌算法实现

3. **API 层**
   - POST /agents/recommend: 推荐接口

4. **集成**
   - Agent 创建/更新时自动更新向量
   - 完整的单元测试和 E2E 测试

洗牌算法权重：
- 语义相似度: 40%
- 平均评分: 30%
- 完成订单数: 20%
- 随机因子: 10%
