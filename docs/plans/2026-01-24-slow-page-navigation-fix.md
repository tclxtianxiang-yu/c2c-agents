# 前端页面切换慢问题修复计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复 `/agent` 页面导航耗时 2-3 秒的性能问题

**Architecture:** 问题由两个因素叠加导致：(1) 前端使用 Server Component 在服务端 fetch 数据，每次导航都重新 SSR；(2) 后端 API 存在 N+1 查询问题，每个 Agent 串行执行 2 次数据库查询。修复策略是前端改为 Client Component 实现乐观导航，后端批量查询优化。

**Tech Stack:** Next.js 15 (App Router), NestJS 10, Supabase

---

## 诊断结果

### 性能数据

| 指标 | 数值 |
|------|------|
| `/` 页面加载 | ~112ms |
| `/agent` 页面加载 | ~2000-2300ms |
| API `/agents?isListed=true` | ~1200-1500ms |
| 数据库查询次数 (3 agents) | 7 次（1 + 2×3）|

### 问题根因

1. **前端问题** (`apps/web/src/app/agent/page.tsx`):
   - 使用 async Server Component
   - `cache: 'no-store'` 禁用缓存
   - 每次导航都在服务端 fetch + SSR

2. **后端问题** (`apps/api/src/modules/agent/agent.service.ts:105-114`):
   - `listAgents()` 存在 N+1 查询
   - 对每个 agent 串行调用 `computeAgentStatus()`
   - `computeAgentStatus()` 内部执行 2 次数据库查询

---

## Task 1: 前端改为 Client Component

**Files:**
- Modify: `apps/web/src/app/agent/page.tsx`

**Step 1: 修改 page.tsx 为简单的 wrapper**

```tsx
import { AgentMarketPage } from '@/components/pages/AgentMarketPage';

export default function AgentsPage() {
  return <AgentMarketPage />;
}
```

**Step 2: 创建 Client Component**

Create: `apps/web/src/components/pages/AgentMarketPage.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { AgentMarket } from '@/components/agents/AgentMarket';
import type { AgentSummary } from '@/components/agents/AgentCard';
import { apiFetch } from '@/lib/api';

export function AgentMarketPage() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<AgentSummary[]>('/agents?isListed=true')
      .then(setAgents)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 w-full max-w-[1440px] mx-auto min-h-screen p-6">
        <div className="flex-1 flex items-center justify-center py-12">
          <div className="text-center text-muted-foreground">加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1440px] mx-auto min-h-screen p-6">
      <AgentMarket agents={agents} />
    </div>
  );
}
```

**Step 3: 验证页面切换速度**

导航到 /agent 页面应该立即显示 loading 状态，然后加载数据。

**Step 4: Commit**

```bash
git add apps/web/src/app/agent/page.tsx apps/web/src/components/pages/AgentMarketPage.tsx
git commit -m "perf(web): convert /agent to client component for instant navigation"
```

---

## Task 2: 后端批量查询优化（可选，长期）

**Files:**
- Modify: `apps/api/src/modules/agent/agent.service.ts`
- Modify: `apps/api/src/modules/agent/agent.repository.ts`

**Step 1: 添加批量状态计算方法到 Repository**

在 `agent.repository.ts` 添加：

```typescript
/**
 * 批量获取 agents 的状态数据
 * 返回 Map<agentId, { hasInProgress: boolean, queuedCount: number }>
 */
async batchGetAgentStatusData(agentIds: string[]): Promise<Map<string, { hasInProgress: boolean; queuedCount: number }>> {
  if (agentIds.length === 0) return new Map();

  // 并行执行两个批量查询
  const [inProgressResults, queuedResults] = await Promise.all([
    // 查询哪些 agents 有 InProgress 订单
    this.db.query<{ agent_id: string }>(
      `SELECT DISTINCT agent_id FROM orders WHERE agent_id = ANY($1) AND status = 'InProgress'`,
      [agentIds]
    ),
    // 查询每个 agent 的排队数量
    this.db.query<{ agent_id: string; count: string }>(
      `SELECT agent_id, COUNT(*)::text as count FROM queue_items WHERE agent_id = ANY($1) AND status = 'queued' GROUP BY agent_id`,
      [agentIds]
    ),
  ]);

  const inProgressSet = new Set(inProgressResults.map(r => r.agent_id));
  const queuedMap = new Map(queuedResults.map(r => [r.agent_id, parseInt(r.count, 10)]));

  const result = new Map<string, { hasInProgress: boolean; queuedCount: number }>();
  for (const id of agentIds) {
    result.set(id, {
      hasInProgress: inProgressSet.has(id),
      queuedCount: queuedMap.get(id) ?? 0,
    });
  }
  return result;
}
```

**Step 2: 修改 Service 使用批量查询**

在 `agent.service.ts` 修改 `listAgents`:

```typescript
async listAgents(query: AgentListQueryDto) {
  const agents = await this.repository.listAgents(query);

  // 批量计算状态（2 次查询替代 2N 次）
  const agentIds = agents.map(a => a.id);
  const statusDataMap = await this.repository.batchGetAgentStatusData(agentIds);

  for (const agent of agents) {
    const data = statusDataMap.get(agent.id);
    if (!data) {
      agent.status = AgentStatus.Idle;
    } else if (!data.hasInProgress) {
      agent.status = AgentStatus.Idle;
    } else {
      agent.status = data.queuedCount > 0 ? AgentStatus.Queueing : AgentStatus.Busy;
    }
  }

  return agents;
}
```

**Step 3: 验证 API 响应时间**

```bash
time curl -s -o /dev/null -w "%{time_total}s" "http://localhost:3001/agents?isListed=true"
```

期望：从 ~1.5s 降到 ~100-200ms

**Step 4: Commit**

```bash
git add apps/api/src/modules/agent/agent.service.ts apps/api/src/modules/agent/agent.repository.ts
git commit -m "perf(api): batch agent status queries to fix N+1 problem"
```

---

## 验收标准

1. [ ] 页面切换响应时间 < 500ms（不含数据加载）
2. [ ] `/agent` 页面显示 loading 状态后加载数据
3. [ ] API `/agents` 响应时间 < 300ms
4. [ ] 无 N+1 查询（最多 3 次数据库查询）

---

## 附录：性能对比

| 场景 | 修复前 | 修复后（Task 1） | 修复后（Task 1+2） |
|------|--------|-----------------|-------------------|
| 页面切换感知 | 2-3s 白屏 | 即时 + loading | 即时 + loading |
| API 响应时间 | 1.2-1.5s | 1.2-1.5s | ~150ms |
| 数据库查询数 (N=10) | 21 次 | 21 次 | 3 次 |
