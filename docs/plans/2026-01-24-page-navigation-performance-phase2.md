# 页面导航性能优化 Phase 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `/agents` 和 `/agents/[id]` 页面从 Server Component 转换为 Client Component，实现即时导航

**Architecture:** 采用与 `/agent` 页面相同的优化模式：将 async Server Component 改为 Client Component + useEffect 数据获取 + Loading/Error 状态处理

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript

---

## 背景

经测试发现：
- `/workbench` 和 `/wallet` 页面已经是 Client Component，无需优化
- `/agents` 页面是 Server Component，有 `getAgents()` 服务端数据获取
- `/agents/[id]` 页面是 Server Component，有 `fetchAgent()` 服务端数据获取

这两个页面会导致导航时 2-3 秒白屏，需要改为 Client Component 实现即时导航。

---

### Task 1: 优化 /agents 列表页面

**Files:**
- Modify: `apps/web/src/app/agents/page.tsx`
- Create: `apps/web/src/components/pages/AgentsListPage.tsx`

**Step 1: 创建 AgentsListPage Client Component**

创建文件 `apps/web/src/components/pages/AgentsListPage.tsx`：

```typescript
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AgentSummary } from '@/components/agents/AgentCard';
import { AgentMarket } from '@/components/agents/AgentMarket';
import { TopNav } from '@/components/layout/TopNav';
import { apiFetch } from '@/lib/api';

export function AgentsListPage() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch<AgentSummary[]>('/agents?isListed=true')
      .then(setAgents)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load agents');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <TopNav />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <output className="text-center text-muted-foreground">加载中...</output>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="text-center text-destructive">{error}</div>
            <button
              type="button"
              onClick={fetchAgents}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              重试
            </button>
          </div>
        )}

        {!loading && !error && <AgentMarket agents={agents} />}
      </div>
    </main>
  );
}
```

**Step 2: 简化 page.tsx**

修改 `apps/web/src/app/agents/page.tsx`：

```typescript
import { AgentsListPage } from '@/components/pages/AgentsListPage';

export default function AgentsPage() {
  return <AgentsListPage />;
}
```

**Step 3: 运行类型检查**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: 测试导航**

在浏览器中从首页导航到 `/agents`，确认：
- 立即显示 Loading 状态
- 页面无白屏延迟

**Step 5: Commit**

```bash
git add apps/web/src/app/agents/page.tsx apps/web/src/components/pages/AgentsListPage.tsx
git commit -m "perf(web): convert /agents to client component for instant navigation"
```

---

### Task 2: 优化 /agents/[id] 详情页面

**Files:**
- Modify: `apps/web/src/app/agents/[id]/page.tsx`
- Create: `apps/web/src/components/pages/AgentDetailPage.tsx`

**Step 1: 创建 AgentDetailPage Client Component**

创建文件 `apps/web/src/components/pages/AgentDetailPage.tsx`：

```typescript
'use client';

import type { Agent } from '@c2c-agents/shared';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AboutAgent } from '@/app/agents/[id]/_components/AboutAgent';
import { ActionButtons } from '@/app/agents/[id]/_components/ActionButtons';
import { AgentHeader } from '@/app/agents/[id]/_components/AgentHeader';
import { MastraIntegration } from '@/app/agents/[id]/_components/MastraIntegration';
import { ProviderControls } from '@/app/agents/[id]/_components/ProviderControls';
import { RecentActivity } from '@/app/agents/[id]/_components/RecentActivity';

type AgentDetailPageProps = {
  agentId: string;
};

export function AgentDetailPage({ agentId }: AgentDetailPageProps) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgent = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch<Agent>(`/agents/${agentId}`)
      .then(setAgent)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load agent');
      })
      .finally(() => setLoading(false));
  }, [agentId]);

  useEffect(() => {
    fetchAgent();
  }, [fetchAgent]);

  if (loading) {
    return (
      <main className="min-h-screen bg-background px-4 py-12 text-foreground">
        <div className="mx-auto w-full max-w-7xl">
          <output className="text-center text-muted-foreground block py-12">
            加载中...
          </output>
        </div>
      </main>
    );
  }

  if (error || !agent) {
    return (
      <main className="min-h-screen bg-background px-4 py-12 text-foreground">
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-border bg-card p-8 shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            {error ? 'Error' : 'Agent Not Found'}
          </p>
          <h1 className="mt-4 text-2xl font-semibold">
            {error ?? '无法找到该 Agent'}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            请求的 Agent ID: <span className="font-mono text-foreground">{agentId}</span>
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              href="/agents"
              className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:border-primary/40 hover:text-primary"
            >
              返回市场
            </Link>
            {error && (
              <button
                type="button"
                onClick={fetchAgent}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-semibold"
              >
                重试
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto w-full max-w-7xl">
        {/* Breadcrumb */}
        <nav className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/agents" className="hover:text-foreground">
            Marketplace
          </Link>
          <span>/</span>
          <Link href="/agents" className="hover:text-foreground">
            AI Agents
          </Link>
          <span>/</span>
          <span className="text-foreground">{agent.name}</span>
        </nav>

        {/* Agent Header */}
        <AgentHeader agent={agent} />

        {/* Main Content Grid */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_400px]">
          {/* Left Column */}
          <div className="space-y-6">
            <AboutAgent agent={agent} />
            <MastraIntegration agent={agent} />
            <RecentActivity agentId={agent.id} />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <ActionButtons agent={agent} />
            <ProviderControls agent={agent} />
          </div>
        </div>
      </div>
    </main>
  );
}
```

**Step 2: 简化 page.tsx**

修改 `apps/web/src/app/agents/[id]/page.tsx`：

```typescript
'use client';

import { use } from 'react';
import { AgentDetailPage } from '@/components/pages/AgentDetailPage';

type AgentDetailPageWrapperProps = {
  params: Promise<{
    id: string;
  }>;
};

export default function AgentDetailPageWrapper({ params }: AgentDetailPageWrapperProps) {
  const { id } = use(params);
  return <AgentDetailPage agentId={id} />;
}
```

**Step 3: 运行类型检查**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: 测试导航**

在浏览器中从 `/agents` 列表页点击 Agent 卡片的详情链接，确认：
- 立即显示 Loading 状态
- 页面无白屏延迟

**Step 5: Commit**

```bash
git add apps/web/src/app/agents/[id]/page.tsx apps/web/src/components/pages/AgentDetailPage.tsx
git commit -m "perf(web): convert /agents/[id] to client component for instant navigation"
```

---

### Task 3: 验证与清理

**Step 1: 运行全项目检查**

```bash
pnpm check
pnpm typecheck
```

Expected: PASS

**Step 2: 浏览器测试所有导航路径**

测试以下导航路径的性能：
- 首页 → /agents（应即时显示 Loading）
- /agents → /agents/[id]（应即时显示 Loading）
- /agents/[id] → /agents（应即时导航）
- 任意页面 → /agent（已优化，应即时显示 Loading）

**Step 3: Final Commit (if needed)**

如果有任何修复，创建最终提交。

---

## 预期结果

| 页面 | 优化前 | 优化后 |
|------|--------|--------|
| `/agents` | 2-3s 白屏 | 即时显示 Loading |
| `/agents/[id]` | 2-3s 白屏 | 即时显示 Loading |

## 备注

- 此优化与 PR #25 的 `/agent` 页面优化采用相同模式
- 子组件（AboutAgent, ActionButtons 等）无需修改，它们已经是 Client Component 或静态渲染
