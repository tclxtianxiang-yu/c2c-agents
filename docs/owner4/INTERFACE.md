# Owner #4 专用接口文档

> **目标读者**: 需要与 Owner #4 Agent 管理 + 队列系统集成的其他模块
> **用途**: Agent CRUD、队列核心能力（enqueue/cancel/consumeNext）、前端组件
> **同步说明**: 公共规则以 `docs/INTERFACE.md` 为准，本文件补充深度集成细节
> **最后更新**: 2026-01-19

---

## 📋 目录

- [1. QueueService (Owner #3/#5 专用)](#1-queueservice-owner-35-专用)
- [2. AgentService (Owner #3 专用)](#2-agentservice-owner-3-专用)
- [3. HTTP API 端点](#3-http-api-端点)
- [4. 前端组件 (跨 Owner 复用)](#4-前端组件-跨-owner-复用)
- [5. 类型定义](#5-类型定义)
- [6. 常见集成问题](#6-常见集成问题)

---

## 1. QueueService (Owner #3/#5 专用)

> **状态**: ✅ 已落地
> **位置**: `apps/api/src/modules/queue/queue.service.ts`

### 1.1 模块导入

QueueService 通过 NestJS 模块依赖注入导入：

```typescript
import { Module } from '@nestjs/common';

import { QueueModule } from '../queue/queue.module';
import { MatchingService } from './matching.service';

@Module({
  imports: [QueueModule],
  providers: [MatchingService],
})
export class MatchingModule {}
```

```typescript
import { Inject, Injectable } from '@nestjs/common';

import { QueueService } from '../queue/queue.service';

@Injectable()
export class MatchingService {
  constructor(@Inject(QueueService) private readonly queueService: QueueService) {}
}
```

### 1.2 核心接口

```typescript
@Injectable()
export class QueueService {
  /**
   * 将订单加入 Agent 队列
   * @throws BadRequestException (BUSINESS_QUEUE_FULL) 如果队列已满
   * @throws ConflictException (BUSINESS_IDEMPOTENCY_VIOLATION) 如果已在队列中
   * @sideEffect 自动更新 agents.queue_size
   */
  async enqueue(params: {
    agentId: string;
    taskId: string;
    orderId: string;
  }): Promise<QueueItem>;

  /**
   * 消费队列中最早的订单（FIFO，原子操作）
   * @returns QueueItem 或 null（队列为空）
   * @sideEffect 自动更新 agents.queue_size
   * @concurrency 使用 FOR UPDATE SKIP LOCKED 保证并发安全
   */
  async consumeNext(agentId: string): Promise<QueueItem | null>;

  /**
   * 取消队列中的特定订单（标记为 canceled）
   * @sideEffect 自动更新 agents.queue_size
   * @idempotent 取消不存在的项不会报错
   */
  async cancel(agentId: string, orderId: string): Promise<void>;

  /**
   * 查询 Agent 队列状态
   */
  async getQueueStatus(agentId: string): Promise<QueueStatusDto>;

  /**
   * 检查订单是否在队列中
   */
  async isInQueue(agentId: string, orderId: string): Promise<boolean>;

  /**
   * 获取订单在队列中的位置（1-based）
   * @returns 位置数字，或 null（不在队列中）
   */
  async getQueuePosition(agentId: string, orderId: string): Promise<number | null>;
}
```

### 1.3 Owner #3 (Matching) 使用示例

```typescript
import { Inject, Injectable } from '@nestjs/common';

import { AgentStatus } from '@c2c-agents/shared';

import { QueueService } from '../queue/queue.service';

@Injectable()
export class MatchingService {
  constructor(@Inject(QueueService) private readonly queueService: QueueService) {}

  async matchOrder(orderId: string, taskId: string) {
    // 找到合适的 Agent
    const agent = await this.findBestAgent(orderId);

    if (agent.status === AgentStatus.Idle) {
      // Agent 空闲，直接创建 Pairing
      return this.createPairing(orderId, agent.id);
    }

    // Agent 忙碌，尝试入队
    const queueStatus = await this.queueService.getQueueStatus(agent.id);

    if (queueStatus.available === 0) {
      // 队列已满，跳过该 Agent，选择其他 Agent
      return this.findNextAgent(orderId);
    }

    // 入队
    return this.queueService.enqueue({
      agentId: agent.id,
      taskId,
      orderId,
    });
  }
}
```

### 1.4 Owner #5 (Delivery) 使用示例

```typescript
import { Inject, Injectable } from '@nestjs/common';

import { QueueService } from '../queue/queue.service';

@Injectable()
export class DeliveryService {
  constructor(@Inject(QueueService) private readonly queueService: QueueService) {}

  /**
   * 当 Agent 完成当前订单后，消费队列中的下一个任务
   */
  async onOrderCompleted(agentId: string) {
    const nextItem = await this.queueService.consumeNext(agentId);

    if (!nextItem) {
      // 队列为空，Agent 变为 Idle
      return null;
    }

    // 创建 Pairing，开始处理下一个订单
    return this.matchingService.createPairing(nextItem.orderId, agentId);
  }
}
```

### 1.5 配置常量

从 `@c2c-agents/config/constants` 导入：

```typescript
import { QUEUE_MAX_N } from '@c2c-agents/config/constants';

// QUEUE_MAX_N: 队列最大容量（默认 10）
```

### 1.6 错误码

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| `BUSINESS_QUEUE_FULL` | 400 | 队列已满（达到 QUEUE_MAX_N） |
| `BUSINESS_IDEMPOTENCY_VIOLATION` | 409 | 订单已在队列中 |

### 1.7 并发安全说明

- **enqueue**: 使用唯一索引 `(agent_id, order_id) WHERE status = 'queued'` 防止重复入队
- **consumeNext**: 使用 `FOR UPDATE SKIP LOCKED` 保证原子消费，多个并发请求只有一个成功

```sql
-- consumeNext 核心 SQL（原子抢占）
UPDATE queue_items
SET
  status = 'consumed',
  consumed_at = NOW()
WHERE id = (
  SELECT id
  FROM queue_items
  WHERE agent_id = $1 AND status = 'queued'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

---

## 2. AgentService (Owner #3 专用)

> **状态**: ✅ 已落地
> **位置**: `apps/api/src/modules/agent/agent.service.ts`

### 2.1 模块导入

```typescript
import { Module } from '@nestjs/common';

import { AgentModule } from '../agent/agent.module';
import { MatchingService } from './matching.service';

@Module({
  imports: [AgentModule],
  providers: [MatchingService],
})
export class MatchingModule {}
```

### 2.2 核心接口（供 Matching 模块使用）

```typescript
@Injectable()
export class AgentService {
  /**
   * 查询可用 Agent 列表（用于自动匹配）
   */
  async findAvailableAgents(query: {
    taskType?: string;
    minPrice?: string;
    maxPrice?: string;
    tags?: string[];
    excludeAgentIds?: string[];
  }): Promise<Agent[]>;

  /**
   * 获取单个 Agent 详情
   */
  async findById(id: string): Promise<Agent>;

  /**
   * 计算 Agent 当前状态
   * - Idle: 无 InProgress 订单且队列为空
   * - Busy: 存在 InProgress 订单
   * - Queueing: 存在 InProgress 订单且队列非空
   */
  async calculateAgentStatus(agentId: string): Promise<AgentStatus>;
}
```

### 2.3 Matching 模块使用示例

```typescript
import { Injectable } from '@nestjs/common';

import { AgentStatus } from '@c2c-agents/shared';

import { AgentService } from '../agent/agent.service';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class MatchingService {
  constructor(
    private readonly agentService: AgentService,
    private readonly queueService: QueueService
  ) {}

  async findBestAgent(taskId: string): Promise<Agent | null> {
    const task = await this.taskService.findById(taskId);

    // 查询符合条件的 Agent
    const agents = await this.agentService.findAvailableAgents({
      taskType: task.taskType,
      minPrice: task.rewardAmount,
      maxPrice: task.rewardAmount,
    });

    // 优先选择 Idle 状态的 Agent
    const idleAgent = agents.find((a) => a.status === AgentStatus.Idle);
    if (idleAgent) return idleAgent;

    // 其次选择队列未满的 Agent
    for (const agent of agents) {
      const queueStatus = await this.queueService.getQueueStatus(agent.id);
      if (queueStatus.available > 0) {
        return agent;
      }
    }

    return null;
  }
}
```

---

## 3. HTTP API 端点

### 3.1 Agent API

| 方法 | 路由 | 说明 | 权限 |
|------|------|------|------|
| POST | `/agents` | 创建 Agent | B only (`x-user-id` header) |
| GET | `/agents` | 获取 Agent 列表（市场） | Public |
| GET | `/agents/:id` | 获取 Agent 详情 | Public |
| PUT | `/agents/:id` | 更新 Agent | B only (owner) |
| DELETE | `/agents/:id` | 删除 Agent | B only (owner) |
| GET | `/agents/my` | 获取我的 Agent 列表 | B only |

#### 3.1.1 GET /agents 查询参数

```typescript
interface AgentQueryDto {
  keyword?: string; // 名称/描述模糊搜索
  taskType?: string; // 支持的任务类型
  minPrice?: string; // 最低价格（MockUSDT 最小单位）
  maxPrice?: string; // 最高价格
  tags?: string[]; // 标签匹配
  status?: AgentStatus; // Agent 状态筛选
  sortBy?: 'avgRating' | 'completedOrderCount' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}
```

#### 3.1.2 响应格式

```typescript
interface AgentListResponse {
  agents: Agent[];
  total: number;
  page: number;
  pageSize: number;
}
```

### 3.2 Queue API

| 方法 | 路由 | 说明 | 权限 |
|------|------|------|------|
| GET | `/queue/agents/:agentId/status` | 获取 Agent 队列状态 | Public |
| GET | `/queue/orders/:orderId/position` | 获取订单排队位置 | A/B (`x-agent-id` header) |
| DELETE | `/queue/agents/:agentId/orders/:orderId` | 取消排队 | A only (`x-user-id` header) |

#### 3.2.1 GET /queue/agents/:agentId/status 响应

```typescript
interface QueueStatusDto {
  agentId: string;
  queuedCount: number;
  capacity: number; // QUEUE_MAX_N
  available: number; // capacity - queuedCount
  items: QueueItem[]; // 按 createdAt 升序
}
```

---

## 4. 前端组件 (跨 Owner 复用)

### 4.1 Agent 卡片组件 (给 Owner #3 使用)

**位置**: `apps/web/src/components/agent/AgentCard.tsx`

```typescript
interface AgentCardProps {
  agent: Agent;
  showSelectButton?: boolean;
  onSelect?: (agentId: string) => void;
  disabled?: boolean;
  disabledReason?: string;
}
```

**使用示例**:

```tsx
import { AgentCard } from '@/components/agent/AgentCard';

// 在任务详情页展示推荐 Agent
<AgentCard
  agent={recommendedAgent}
  showSelectButton
  onSelect={(agentId) => handleSelectAgent(agentId)}
  disabled={!isTaskPaymentConfirmed}
  disabledReason="请先完成支付"
/>;
```

### 4.2 队列组件 (给 Owner #5 B 工作台使用)

**位置**: `apps/web/src/components/queue/`

#### QueueTaskCard

```typescript
interface QueueTaskCardProps {
  queueItem: QueueItem;
  task: Task;
  position: number;
  onAccept?: (queueItemId: string) => void;
  onReject?: (queueItemId: string) => void;
}
```

#### QueueList

```typescript
interface QueueListProps {
  agentId: string;
}
```

**使用示例**:

```tsx
import { QueueList } from '@/components/queue/QueueList';

// 在 B 工作台展示队列
<QueueList agentId={currentAgent.id} />;
```

---

## 5. 类型定义

### 5.1 QueueItem (from `@c2c-agents/shared`)

```typescript
import type { QueueItemStatus } from '@c2c-agents/shared';

interface QueueItem {
  id: string;
  agentId: string;
  taskId: string;
  orderId: string;
  status: QueueItemStatus; // 'queued' | 'consumed' | 'canceled'
  createdAt: string;
  consumedAt: string | null;
  canceledAt: string | null;
}
```

### 5.2 Agent (from `@c2c-agents/shared`)

```typescript
import type { AgentStatus } from '@c2c-agents/shared';

interface Agent {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  avatarUrl: string | null;
  mastraUrl: string;
  tags: string[];
  supportedTaskTypes: string[];
  minPrice: string; // MockUSDT 最小单位
  maxPrice: string;
  status: AgentStatus; // 'Idle' | 'Busy' | 'Queueing'
  queueSize: number; // 冗余字段，由 QueueService 维护
  avgRating: number | null;
  completedOrderCount: number;
  createdAt: string;
  updatedAt: string;
}
```

### 5.3 AgentStatus 枚举

```typescript
enum AgentStatus {
  Idle = 'Idle', // 无 InProgress 订单且队列为空
  Busy = 'Busy', // 存在 InProgress 订单
  Queueing = 'Queueing', // 存在 InProgress 订单且队列非空
}
```

### 5.4 QueueItemStatus 枚举

```typescript
enum QueueItemStatus {
  Queued = 'queued', // 排队中
  Consumed = 'consumed', // 已消费
  Canceled = 'canceled', // 已取消
}
```

---

## 6. 常见集成问题

### Q1: 队列满了怎么办?

**A**: Owner #3 (Matching) 需要在配对前检查队列容量：

```typescript
const queueStatus = await this.queueService.getQueueStatus(agentId);

if (queueStatus.available === 0) {
  // 跳过此 Agent，选择其他 Agent
  continue;
}
```

### Q2: 如何保证 consumeNext 不会重复消费?

**A**: QueueService 使用 `FOR UPDATE SKIP LOCKED` 原子锁：

```typescript
// 内部实现（无需调用方关心）
// 10 个并发请求只有 1 个会成功消费
const item = await this.queueService.consumeNext(agentId);
```

### Q3: enqueue 重复入队会报错吗?

**A**: 会返回 `ConflictException` (409)，错误码为 `BUSINESS_IDEMPOTENCY_VIOLATION`：

```typescript
try {
  await this.queueService.enqueue({ agentId, taskId, orderId });
} catch (error) {
  if (error.code === 'BUSINESS_IDEMPOTENCY_VIOLATION') {
    // 已在队列中，可忽略
    return;
  }
  throw error;
}
```

### Q4: 取消不存在的队列项会报错吗?

**A**: 不会，cancel 是幂等操作：

```typescript
// 即使订单不在队列中，也不会报错
await this.queueService.cancel(agentId, orderId);
```

### Q5: Agent 状态是实时计算还是缓存的?

**A**: `agents.status` 是实时计算的，但 `agents.queue_size` 是冗余字段，由 QueueService 在 enqueue/consumeNext/cancel 时自动维护。

### Q6: 如何判断 Agent 是否可以接受新订单?

**A**: 检查 Agent 状态和队列容量：

```typescript
const agent = await this.agentService.findById(agentId);
const queueStatus = await this.queueService.getQueueStatus(agentId);

if (agent.status === AgentStatus.Idle) {
  // 可以直接创建 Pairing
  return true;
}

if (queueStatus.available > 0) {
  // 可以入队
  return true;
}

// Agent 忙且队列已满
return false;
```

---

## 📚 相关文档

- [公共接口文档](../INTERFACE.md) - 所有 Owner 必读
- [CONTEXT.md](../CONTEXT.md) - 全局约束与规范
- [Owner #4 开发计划](./PLAN.md) - Phase 分解与详细任务
- [QueueService 详细 API](./QUEUE_SERVICE_API.md) - 队列服务完整文档

---

**最后更新**: 2026-01-19
**维护者**: Owner #4
**版本**: v1.0.0
