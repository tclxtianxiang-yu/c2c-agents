# B Workbench Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement complete B-side workbench with 5 tabs: Pairing, InProgress, Delivered, Queue, History

**Architecture:** Tab-based UI with custom hooks for data fetching, new backend endpoints for order lists by status

**Tech Stack:** Next.js 15, NestJS, Supabase, shadcn/ui Tabs

---

## Overview

根据 PRD 第 6 节，B 工作台需要以下功能：

| Tab | 功能 | 数据来源 |
|-----|------|----------|
| 拟成单 | 待确认的 Pairing 订单 | `status = 'Pairing'` |
| 进行中 | 正在执行的订单 | `status = 'InProgress'` |
| 已交付 | 等待 A 验收的订单 | `status = 'Delivered'` |
| 队列 | B 的 Agent 队列中的任务 | `queue_items` |
| 历史 | 已完成订单 | `status IN ('Paid', 'Refunded', 'Completed')` |

---

## Task 1: 创建 B 订单列表 API 端点

**Files:**
- Create: `apps/api/src/modules/workbench/workbench.module.ts`
- Create: `apps/api/src/modules/workbench/workbench.controller.ts`
- Create: `apps/api/src/modules/workbench/workbench.service.ts`
- Create: `apps/api/src/modules/workbench/workbench.repository.ts`
- Modify: `apps/api/src/app.module.ts` (import WorkbenchModule)

**Step 1: 创建 workbench.repository.ts**

```typescript
import { OrderStatus } from '@c2c-agents/shared';
import { Inject, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';

type OrderWithTask = {
  id: string;
  task_id: string;
  status: OrderStatus;
  reward_amount: string;
  provider_id: string | null;
  agent_id: string | null;
  delivered_at: string | null;
  pairing_created_at: string | null;
  created_at: string;
  task: {
    id: string;
    title: string;
    type: string;
    description: string;
  };
  agent: {
    id: string;
    name: string;
  } | null;
};

@Injectable()
export class WorkbenchRepository {
  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  async findOrdersByProviderAndStatus(
    providerId: string,
    statuses: OrderStatus[]
  ): Promise<OrderWithTask[]> {
    const { data, error } = await this.supabase
      .query('orders')
      .select(`
        id, task_id, status, reward_amount, provider_id, agent_id,
        delivered_at, pairing_created_at, created_at,
        task:tasks(id, title, type, description),
        agent:agents(id, name)
      `)
      .eq('provider_id', providerId)
      .in('status', statuses)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch orders: ${error.message}`);
    return data ?? [];
  }

  async findQueueItemsByAgentOwner(ownerId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .query('queue_items')
      .select(`
        id, agent_id, order_id, status, created_at,
        agent:agents!inner(id, name, owner_id),
        order:orders(id, task:tasks(id, title, type))
      `)
      .eq('agent.owner_id', ownerId)
      .eq('status', 'queued')
      .order('created_at', { ascending: true });

    if (error) throw new Error(`Failed to fetch queue: ${error.message}`);
    return data ?? [];
  }
}
```

**Step 2: 创建 workbench.service.ts**

```typescript
import { OrderStatus } from '@c2c-agents/shared';
import { Inject, Injectable } from '@nestjs/common';
import { WorkbenchRepository } from './workbench.repository';

@Injectable()
export class WorkbenchService {
  constructor(@Inject(WorkbenchRepository) private readonly repository: WorkbenchRepository) {}

  async getPairingOrders(providerId: string) {
    return this.repository.findOrdersByProviderAndStatus(providerId, [OrderStatus.Pairing]);
  }

  async getInProgressOrders(providerId: string) {
    return this.repository.findOrdersByProviderAndStatus(providerId, [OrderStatus.InProgress]);
  }

  async getDeliveredOrders(providerId: string) {
    return this.repository.findOrdersByProviderAndStatus(providerId, [OrderStatus.Delivered]);
  }

  async getHistoryOrders(providerId: string) {
    return this.repository.findOrdersByProviderAndStatus(providerId, [
      OrderStatus.Paid,
      OrderStatus.Refunded,
      OrderStatus.Completed,
    ]);
  }

  async getQueueItems(ownerId: string) {
    return this.repository.findQueueItemsByAgentOwner(ownerId);
  }
}
```

**Step 3: 创建 workbench.controller.ts**

```typescript
import { Controller, Get, Headers, HttpException } from '@nestjs/common';
import { WorkbenchService } from './workbench.service';

@Controller('workbench')
export class WorkbenchController {
  constructor(private readonly service: WorkbenchService) {}

  @Get('orders/pairing')
  async getPairingOrders(@Headers('x-user-id') userId: string) {
    if (!userId) throw new HttpException('x-user-id header required', 401);
    return this.service.getPairingOrders(userId);
  }

  @Get('orders/in-progress')
  async getInProgressOrders(@Headers('x-user-id') userId: string) {
    if (!userId) throw new HttpException('x-user-id header required', 401);
    return this.service.getInProgressOrders(userId);
  }

  @Get('orders/delivered')
  async getDeliveredOrders(@Headers('x-user-id') userId: string) {
    if (!userId) throw new HttpException('x-user-id header required', 401);
    return this.service.getDeliveredOrders(userId);
  }

  @Get('orders/history')
  async getHistoryOrders(@Headers('x-user-id') userId: string) {
    if (!userId) throw new HttpException('x-user-id header required', 401);
    return this.service.getHistoryOrders(userId);
  }

  @Get('queue')
  async getQueueItems(@Headers('x-user-id') userId: string) {
    if (!userId) throw new HttpException('x-user-id header required', 401);
    return this.service.getQueueItems(userId);
  }
}
```

**Step 4: 创建 workbench.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { WorkbenchController } from './workbench.controller';
import { WorkbenchRepository } from './workbench.repository';
import { WorkbenchService } from './workbench.service';

@Module({
  controllers: [WorkbenchController],
  providers: [WorkbenchService, WorkbenchRepository],
})
export class WorkbenchModule {}
```

**Step 5: 在 app.module.ts 中导入**

在 imports 数组中添加 `WorkbenchModule`。

**Step 6: 运行测试验证**

```bash
cd apps/api && pnpm test
```

**Step 7: Commit**

```bash
git add apps/api/src/modules/workbench/ apps/api/src/app.module.ts
git commit -m "feat(workbench): add B workbench API endpoints

- GET /workbench/orders/pairing
- GET /workbench/orders/in-progress
- GET /workbench/orders/delivered
- GET /workbench/orders/history
- GET /workbench/queue

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: 创建前端 Hooks

**Files:**
- Create: `apps/web/src/hooks/use-workbench.ts`

**Step 1: 创建 use-workbench.ts**

```typescript
'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type OrderWithTask = {
  id: string;
  task_id: string;
  status: string;
  reward_amount: string;
  provider_id: string | null;
  agent_id: string | null;
  delivered_at: string | null;
  pairing_created_at: string | null;
  created_at: string;
  task: {
    id: string;
    title: string;
    type: string;
    description: string;
  };
  agent: {
    id: string;
    name: string;
  } | null;
};

type QueueItemWithDetails = {
  id: string;
  agent_id: string;
  order_id: string;
  status: string;
  created_at: string;
  agent: { id: string; name: string };
  order: { id: string; task: { id: string; title: string; type: string } };
};

type UseWorkbenchOrdersResult = {
  orders: OrderWithTask[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

type UseQueueItemsResult = {
  items: QueueItemWithDetails[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

function useWorkbenchOrders(
  userId: string | undefined,
  endpoint: string
): UseWorkbenchOrdersResult {
  const [orders, setOrders] = useState<OrderWithTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    if (!userId) {
      setOrders([]);
      return;
    }

    setLoading(true);
    setError(null);

    apiFetch<OrderWithTask[]>(endpoint, {
      headers: { 'x-user-id': userId },
    })
      .then(setOrders)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to fetch'))
      .finally(() => setLoading(false));
  }, [userId, endpoint]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { orders, loading, error, refetch };
}

export function usePairingOrders(userId: string | undefined) {
  return useWorkbenchOrders(userId, '/workbench/orders/pairing');
}

export function useInProgressOrders(userId: string | undefined) {
  return useWorkbenchOrders(userId, '/workbench/orders/in-progress');
}

export function useDeliveredOrders(userId: string | undefined) {
  return useWorkbenchOrders(userId, '/workbench/orders/delivered');
}

export function useHistoryOrders(userId: string | undefined) {
  return useWorkbenchOrders(userId, '/workbench/orders/history');
}

export function useQueueItems(userId: string | undefined): UseQueueItemsResult {
  const [items, setItems] = useState<QueueItemWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    if (!userId) {
      setItems([]);
      return;
    }

    setLoading(true);
    setError(null);

    apiFetch<QueueItemWithDetails[]>('/workbench/queue', {
      headers: { 'x-user-id': userId },
    })
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to fetch'))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { items, loading, error, refetch };
}
```

**Step 2: 运行类型检查**

```bash
cd /Users/yutianxiang/p/C2CAgents && pnpm typecheck
```

**Step 3: Commit**

```bash
git add apps/web/src/hooks/use-workbench.ts
git commit -m "feat(web): add workbench data hooks

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: 创建工作台 Tab 组件

**Files:**
- Create: `apps/web/src/app/(b)/workbench/_components/PairingTab.tsx`
- Create: `apps/web/src/app/(b)/workbench/_components/InProgressTab.tsx`
- Create: `apps/web/src/app/(b)/workbench/_components/DeliveredTab.tsx`
- Create: `apps/web/src/app/(b)/workbench/_components/QueueTab.tsx`
- Create: `apps/web/src/app/(b)/workbench/_components/HistoryTab.tsx`
- Create: `apps/web/src/app/(b)/workbench/_components/OrderCard.tsx`

**Step 1: 创建 OrderCard.tsx（可复用组件）**

```typescript
'use client';

import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

type OrderCardProps = {
  order: {
    id: string;
    status: string;
    reward_amount: string;
    created_at: string;
    delivered_at?: string | null;
    pairing_created_at?: string | null;
    task: { title: string; type: string; description: string };
    agent: { name: string } | null;
  };
  actions?: React.ReactNode;
};

export function OrderCard({ order, actions }: OrderCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-semibold">{order.task.title}</h4>
          <p className="mt-1 text-xs text-muted-foreground">{order.task.type}</p>
        </div>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
          {order.status}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
        {order.task.description}
      </p>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>报酬: {order.reward_amount} USDT</span>
        <span>
          {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: zhCN })}
        </span>
      </div>
      {order.agent && (
        <div className="mt-2 text-xs text-muted-foreground">
          Agent: {order.agent.name}
        </div>
      )}
      {actions && <div className="mt-3 flex gap-2">{actions}</div>}
    </div>
  );
}
```

**Step 2: 创建 PairingTab.tsx**

```typescript
'use client';

import { apiFetch } from '@/lib/api';
import { useState } from 'react';
import { usePairingOrders } from '@/hooks/use-workbench';
import { OrderCard } from './OrderCard';

type PairingTabProps = {
  userId: string | undefined;
};

export function PairingTab({ userId }: PairingTabProps) {
  const { orders, loading, error, refetch } = usePairingOrders(userId);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAccept = async (orderId: string) => {
    if (!userId) return;
    setActionLoading(orderId);
    try {
      await apiFetch('/matching/pairing/accept', {
        method: 'POST',
        headers: { 'x-user-id': userId },
        body: JSON.stringify({ orderId, role: 'B' }),
      });
      refetch();
    } catch (err) {
      console.error('Accept failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (orderId: string) => {
    if (!userId) return;
    setActionLoading(orderId);
    try {
      await apiFetch('/matching/pairing/reject', {
        method: 'POST',
        headers: { 'x-user-id': userId },
        body: JSON.stringify({ orderId, role: 'B' }),
      });
      refetch();
    } catch (err) {
      console.error('Reject failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="text-center text-muted-foreground">加载中...</div>;
  if (error) return <div className="text-center text-destructive">{error}</div>;
  if (!orders.length) return <div className="text-center text-muted-foreground">暂无拟成单</div>;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {orders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          actions={
            <>
              <button
                onClick={() => handleAccept(order.id)}
                disabled={actionLoading === order.id}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                同意
              </button>
              <button
                onClick={() => handleReject(order.id)}
                disabled={actionLoading === order.id}
                className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
              >
                拒绝
              </button>
            </>
          }
        />
      ))}
    </div>
  );
}
```

**Step 3: 创建 InProgressTab.tsx**

```typescript
'use client';

import { useInProgressOrders } from '@/hooks/use-workbench';
import { OrderCard } from './OrderCard';
import Link from 'next/link';

type InProgressTabProps = {
  userId: string | undefined;
};

export function InProgressTab({ userId }: InProgressTabProps) {
  const { orders, loading, error } = useInProgressOrders(userId);

  if (loading) return <div className="text-center text-muted-foreground">加载中...</div>;
  if (error) return <div className="text-center text-destructive">{error}</div>;
  if (!orders.length) return <div className="text-center text-muted-foreground">暂无进行中订单</div>;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {orders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          actions={
            <Link
              href={`/tasks/${order.task_id}`}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              提交交付
            </Link>
          }
        />
      ))}
    </div>
  );
}
```

**Step 4: 创建 DeliveredTab.tsx**

```typescript
'use client';

import { useDeliveredOrders } from '@/hooks/use-workbench';
import { OrderCard } from './OrderCard';
import { AutoAcceptCountdown } from '@/components/delivery/AutoAcceptCountdown';

type DeliveredTabProps = {
  userId: string | undefined;
};

export function DeliveredTab({ userId }: DeliveredTabProps) {
  const { orders, loading, error } = useDeliveredOrders(userId);

  if (loading) return <div className="text-center text-muted-foreground">加载中...</div>;
  if (error) return <div className="text-center text-destructive">{error}</div>;
  if (!orders.length) return <div className="text-center text-muted-foreground">暂无已交付订单</div>;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {orders.map((order) => (
        <div key={order.id}>
          <OrderCard order={order} />
          {order.delivered_at && (
            <div className="mt-2">
              <AutoAcceptCountdown deliveredAt={order.delivered_at} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

**Step 5: 创建 QueueTab.tsx**

```typescript
'use client';

import { useQueueItems } from '@/hooks/use-workbench';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

type QueueTabProps = {
  userId: string | undefined;
};

export function QueueTab({ userId }: QueueTabProps) {
  const { items, loading, error } = useQueueItems(userId);

  if (loading) return <div className="text-center text-muted-foreground">加载中...</div>;
  if (error) return <div className="text-center text-destructive">{error}</div>;
  if (!items.length) return <div className="text-center text-muted-foreground">队列为空</div>;

  // Group by agent
  const byAgent = items.reduce(
    (acc, item) => {
      const agentId = item.agent.id;
      if (!acc[agentId]) acc[agentId] = { agent: item.agent, items: [] };
      acc[agentId].items.push(item);
      return acc;
    },
    {} as Record<string, { agent: { id: string; name: string }; items: typeof items }>
  );

  return (
    <div className="space-y-6">
      {Object.values(byAgent).map(({ agent, items }) => (
        <div key={agent.id} className="rounded-xl border border-border bg-card/60 p-4">
          <h4 className="font-semibold">{agent.name}</h4>
          <p className="text-xs text-muted-foreground">队列中 {items.length} 个任务</p>
          <div className="mt-3 space-y-2">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">#{index + 1}</span>
                  <span>{item.order.task.title}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: zhCN })}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Step 6: 创建 HistoryTab.tsx**

```typescript
'use client';

import { useHistoryOrders } from '@/hooks/use-workbench';
import { OrderCard } from './OrderCard';

type HistoryTabProps = {
  userId: string | undefined;
};

export function HistoryTab({ userId }: HistoryTabProps) {
  const { orders, loading, error } = useHistoryOrders(userId);

  if (loading) return <div className="text-center text-muted-foreground">加载中...</div>;
  if (error) return <div className="text-center text-destructive">{error}</div>;
  if (!orders.length) return <div className="text-center text-muted-foreground">暂无历史订单</div>;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}
```

**Step 7: Commit**

```bash
git add apps/web/src/app/\(b\)/workbench/_components/
git commit -m "feat(web): add workbench tab components

- OrderCard: reusable order display
- PairingTab: accept/reject pairing
- InProgressTab: link to delivery
- DeliveredTab: show auto-accept countdown
- QueueTab: grouped by agent
- HistoryTab: completed orders

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: 重构工作台主页面

**Files:**
- Modify: `apps/web/src/app/(b)/workbench/page.tsx`

**Step 1: 重写 page.tsx 使用 Tabs**

```typescript
'use client';

import { TopNav } from '@/components/layout/TopNav';
import { useUserId } from '@/lib/useUserId';
import { PairingTab } from './_components/PairingTab';
import { InProgressTab } from './_components/InProgressTab';
import { DeliveredTab } from './_components/DeliveredTab';
import { QueueTab } from './_components/QueueTab';
import { HistoryTab } from './_components/HistoryTab';
import { useState } from 'react';

type TabKey = 'pairing' | 'in-progress' | 'delivered' | 'queue' | 'history';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'pairing', label: '拟成单' },
  { key: 'in-progress', label: '进行中' },
  { key: 'delivered', label: '已交付' },
  { key: 'queue', label: '队列' },
  { key: 'history', label: '历史' },
];

export default function WorkbenchPage() {
  const { userId, loading: userLoading } = useUserId('B');
  const [activeTab, setActiveTab] = useState<TabKey>('pairing');

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(24,36,70,0.6),rgba(10,14,30,0.95))] text-foreground">
      <TopNav />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
        <section className="rounded-3xl border border-border/70 bg-card/70 p-8 shadow-[0_35px_80px_rgba(8,12,28,0.55)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Workbench</p>
          <h1 className="mt-3 text-3xl font-semibold">B 侧工作台</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            管理您的订单、交付和队列。
          </p>
        </section>

        {userLoading ? (
          <div className="text-center text-muted-foreground">加载用户信息...</div>
        ) : !userId ? (
          <div className="text-center text-muted-foreground">请先连接钱包</div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto rounded-xl border border-border bg-card/60 p-2">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <section className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur">
              {activeTab === 'pairing' && <PairingTab userId={userId} />}
              {activeTab === 'in-progress' && <InProgressTab userId={userId} />}
              {activeTab === 'delivered' && <DeliveredTab userId={userId} />}
              {activeTab === 'queue' && <QueueTab userId={userId} />}
              {activeTab === 'history' && <HistoryTab userId={userId} />}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
```

**Step 2: 运行类型检查**

```bash
pnpm typecheck
```

**Step 3: 测试页面**

在浏览器中访问 http://localhost:3000/workbench 验证功能。

**Step 4: Commit**

```bash
git add apps/web/src/app/\(b\)/workbench/page.tsx
git commit -m "feat(web): refactor workbench with tab navigation

- 5 tabs: Pairing, InProgress, Delivered, Queue, History
- useUserId hook for B role authentication
- Responsive tab navigation

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: 添加单元测试

**Files:**
- Create: `apps/api/src/modules/workbench/__tests__/workbench.service.test.ts`

**Step 1: 创建测试文件**

```typescript
import { OrderStatus } from '@c2c-agents/shared';
import { WorkbenchService } from '../workbench.service';

const mockRepository = {
  findOrdersByProviderAndStatus: jest.fn(),
  findQueueItemsByAgentOwner: jest.fn(),
};

describe('WorkbenchService', () => {
  let service: WorkbenchService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorkbenchService(mockRepository as any);
  });

  describe('getPairingOrders', () => {
    it('should call repository with Pairing status', async () => {
      mockRepository.findOrdersByProviderAndStatus.mockResolvedValue([]);
      await service.getPairingOrders('user-1');
      expect(mockRepository.findOrdersByProviderAndStatus).toHaveBeenCalledWith(
        'user-1',
        [OrderStatus.Pairing]
      );
    });
  });

  describe('getInProgressOrders', () => {
    it('should call repository with InProgress status', async () => {
      mockRepository.findOrdersByProviderAndStatus.mockResolvedValue([]);
      await service.getInProgressOrders('user-1');
      expect(mockRepository.findOrdersByProviderAndStatus).toHaveBeenCalledWith(
        'user-1',
        [OrderStatus.InProgress]
      );
    });
  });

  describe('getHistoryOrders', () => {
    it('should call repository with completed statuses', async () => {
      mockRepository.findOrdersByProviderAndStatus.mockResolvedValue([]);
      await service.getHistoryOrders('user-1');
      expect(mockRepository.findOrdersByProviderAndStatus).toHaveBeenCalledWith(
        'user-1',
        [OrderStatus.Paid, OrderStatus.Refunded, OrderStatus.Completed]
      );
    });
  });

  describe('getQueueItems', () => {
    it('should call repository with owner id', async () => {
      mockRepository.findQueueItemsByAgentOwner.mockResolvedValue([]);
      await service.getQueueItems('user-1');
      expect(mockRepository.findQueueItemsByAgentOwner).toHaveBeenCalledWith('user-1');
    });
  });
});
```

**Step 2: 运行测试**

```bash
cd apps/api && pnpm test workbench
```

**Step 3: Commit**

```bash
git add apps/api/src/modules/workbench/__tests__/
git commit -m "test(workbench): add service unit tests

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## 执行顺序

| 优先级 | Task | 说明 |
|--------|------|------|
| 1 | Task 1 | 后端 API 是前端依赖 |
| 2 | Task 2 | Hooks 是组件依赖 |
| 3 | Task 3 | Tab 组件 |
| 4 | Task 4 | 主页面整合 |
| 5 | Task 5 | 测试保障 |

---

**Plan complete and saved to `docs/plans/2026-01-25-b-workbench-implementation.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
