# QueueService 接口文档

> **Owner**: Owner #4
> **用途**: 供 Matching、Delivery 等模块通过依赖注入调用
> **最后更新**: 2025-02-14

---

## 1. 模块导入

QueueService 位于 `apps/api/src/modules/queue`，通过模块依赖注入导入：

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

## 2. 核心方法

### 2.1 enqueue(params)
- **功能**: 将订单加入 Agent 队列
- **参数**: `{ agentId, taskId, orderId }`
- **返回**: `Promise<QueueItem>` (`QueueItem` 来自 `@c2c-agents/shared`)
- **异常**:
  - `BadRequestException` (`BUSINESS_QUEUE_FULL`): 队列已满
  - `ConflictException` (`BUSINESS_IDEMPOTENCY_VIOLATION`): 已在队列中
- **副作用**: 自动更新 `agents.queue_size`

### 2.2 consumeNext(agentId)
- **功能**: 消费队列中最早的订单（FIFO）
- **参数**: `agentId: string`
- **返回**: `Promise<QueueItem | null>`
- **副作用**: 自动更新 `agents.queue_size`
- **并发说明**: 若数据库已部署 `consume_next_queue_item` RPC，则为原子消费；否则降级为查询 + 更新（非原子）。

### 2.3 cancel(agentId, orderId)
- **功能**: 取消队列中的特定订单
- **参数**: `agentId, orderId`
- **返回**: `Promise<void>`
- **副作用**: 自动更新 `agents.queue_size`

### 2.4 getQueueStatus(agentId)
- **功能**: 查询 Agent 队列状态
- **返回**: `Promise<QueueStatusDto>`
  ```typescript
  import type { QueueItem } from '@c2c-agents/shared';

  interface QueueStatusDto {
    agentId: string;
    queuedCount: number;
    capacity: number; // QUEUE_MAX_N
    available: number; // capacity - queuedCount
    items: QueueItem[]; // 按 createdAt 升序
  }
  ```

### 2.5 isInQueue(agentId, orderId)
- **功能**: 检查订单是否在队列中
- **返回**: `Promise<boolean>`

### 2.6 getQueuePosition(agentId, orderId)
- **功能**: 获取订单在队列中的位置
- **返回**: `Promise<number | null>` (1-based，`null` 表示不在队列中)

## 3. HTTP API 端点

| 方法 | 路由 | 说明 | 权限 |
|------|------|------|------|
| GET | `/queue/agents/:agentId/status` | 获取队列状态 | Public |
| GET | `/queue/orders/:orderId/position` | 获取排队位置 | A/B (`x-agent-id` header) |
| DELETE | `/queue/agents/:agentId/orders/:orderId` | 取消排队 | A only (`x-user-id` header) |

> TODO: `DELETE /queue/agents/:agentId/orders/:orderId` 目前未校验 `x-user-id` 是否为订单创建者。

## 4. 类型定义

### QueueItem (from `@c2c-agents/shared`)

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

### EnqueueDto

```typescript
interface EnqueueDto {
  agentId: string;
  taskId: string;
  orderId: string;
}
```

## 5. 配置常量

从 `@c2c-agents/config/constants` 导入：

- `QUEUE_MAX_N`: 队列最大容量（默认 10）

## 6. 错误码

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| BUSINESS_QUEUE_FULL | 400 | 队列已满 |
| BUSINESS_IDEMPOTENCY_VIOLATION | 409 | 已在队列中 |

## 7. 使用示例

### Matching 模块调用示例

```typescript
import { Inject, Injectable } from '@nestjs/common';

import { QueueService } from '../queue/queue.service';

@Injectable()
export class MatchingService {
  constructor(@Inject(QueueService) private readonly queueService: QueueService) {}

  async enqueueForBusyAgent(params: { agentId: string; taskId: string; orderId: string }) {
    return this.queueService.enqueue(params);
  }
}
```

### Delivery 模块调用示例（订单完成后消费队列）

```typescript
import { Inject, Injectable } from '@nestjs/common';

import { QueueService } from '../queue/queue.service';

@Injectable()
export class DeliveryService {
  constructor(@Inject(QueueService) private readonly queueService: QueueService) {}

  async onOrderCompleted(agentId: string) {
    const nextItem = await this.queueService.consumeNext(agentId);

    if (!nextItem) return null;

    return nextItem;
  }
}
```

## 8. 并发安全说明

- enqueue: 使用唯一索引 `(agent_id, order_id)` 且 `status = 'queued'` 防止重复入队。
- consumeNext: 若启用 `consume_next_queue_item` RPC，使用 `FOR UPDATE SKIP LOCKED` 保证原子消费；未启用时降级为非原子实现。

## 9. 注意事项

1. 队列只使用 `QueueItem.createdAt` 做 FIFO，不保存 `position` 字段。
2. `agents.queue_size` 是冗余字段，由 QueueService 自动维护。
3. 取消已不在队列中的项是幂等操作，不会报错。
