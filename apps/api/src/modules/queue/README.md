# Queue Module

## 概述

Queue 模块实现了 Agent 排队系统，用于管理当 Agent 处于 Busy 状态时的任务排队。

## 文件结构

```
apps/api/src/modules/queue/
├── queue.module.ts           # 模块定义
├── queue.controller.ts       # HTTP API 控制器
├── queue.service.ts          # 业务逻辑层
├── queue.repository.ts       # 数据访问层
├── dtos/
│   ├── enqueue.dto.ts       # 入队 DTO
│   └── queue-status.dto.ts  # 队列状态 DTO
├── sql/
│   └── consume_next_queue_item.sql  # 原子消费函数（需要 Owner #1 执行）
└── __tests__/
    ├── queue.service.spec.ts  # 单元测试
    └── queue.e2e.spec.ts      # E2E 测试
```

## API 接口

### Public API

| 方法 | 路由 | 说明 | 权限 |
|------|------|------|------|
| GET | `/queue/agents/:agentId/status` | 获取 Agent 队列状态 | Public |
| GET | `/queue/orders/:orderId/position` | 获取订单在队列中的位置 | A/B (需要 `x-agent-id` header) |
| DELETE | `/queue/agents/:agentId/orders/:orderId` | 取消排队 | A only (需要 `x-user-id` header) |

### Internal API (通过依赖注入)

```typescript
import { QueueService } from '../queue/queue.service';

class MatchingService {
  constructor(private readonly queueService: QueueService) {}

  async matchOrder(orderId: string, agentId: string) {
    // 入队
    const queueItem = await this.queueService.enqueue({
      agentId,
      taskId,
      orderId,
    });

    // 消费下一个
    const nextItem = await this.queueService.consumeNext(agentId);
  }
}
```

## 核心功能

### 1. 入队 (enqueue)

- **容量检查**：队列长度 >= QUEUE_MAX_N 时返回 400
- **幂等性**：同一 (agentId, orderId) 已在队列中时返回 409
- **自动更新**：成功入队后自动更新 `agents.queue_size`

### 2. 消费 (consumeNext)

- **原子操作**：使用 `FOR UPDATE SKIP LOCKED` 确保并发安全
- **FIFO 顺序**：按 `created_at` 升序消费最早的项
- **空队列处理**：队列为空时返回 `null`
- **自动更新**：成功消费后自动更新 `agents.queue_size`

### 3. 取消 (cancel)

- **幂等性**：取消不存在的项不会报错
- **状态限制**：只能取消 `status = 'queued'` 的项
- **自动更新**：取消后自动更新 `agents.queue_size`

### 4. 查询状态 (getQueueStatus)

返回队列状态信息：
- `queuedCount`: 当前排队数量
- `capacity`: 队列容量 (QUEUE_MAX_N)
- `available`: 剩余可用空间
- `items`: 队列项列表（按 `created_at` 升序）

## 并发安全

### consumeNext 的并发保护

使用 PostgreSQL 的 `FOR UPDATE SKIP LOCKED` 确保：
- 多个并发请求只有一个能获取到同一个队列项
- 其他请求跳过已锁定的行，避免阻塞

```sql
UPDATE queue_items
SET status = 'consumed', consumed_at = NOW()
WHERE id = (
  SELECT id FROM queue_items
  WHERE agent_id = $1 AND status = 'queued'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED  -- 关键：跳过已锁定的行
)
RETURNING *;
```

### enqueue 的去重保护

使用唯一索引防止重复入队：

```sql
CREATE UNIQUE INDEX uq_queue_items_agent_order_queued
ON queue_items(agent_id, order_id)
WHERE status = 'queued';
```

## 配置

### 环境变量

- `QUEUE_MAX_N`: 队列最大容量（默认 10）

```bash
# apps/api/.env
QUEUE_MAX_N=10
```

## 数据库依赖

### 必需的表

- `queue_items`: 队列项表（由 Owner #1 在 `supabase_init.sql` 中创建）
- `agents`: Agent 表（用于更新 `queue_size` 字段）

### 可选的数据库函数

为了实现真正的原子操作，需要在数据库中创建 `consume_next_queue_item` 函数：

```bash
# 由 Owner #1 执行
psql $DATABASE_URL < apps/api/src/modules/queue/sql/consume_next_queue_item.sql
```

如果函数不存在，QueueRepository 会自动降级到手动查询+更新（非原子，但能工作）。

## 测试

### 运行单元测试

```bash
cd apps/api
pnpm test queue.service.spec
```

### 运行 E2E 测试

```bash
cd apps/api
pnpm test queue.e2e.spec
```

### 测试覆盖率

- ✅ 入队：正常、满队列、重复、queue_size 更新
- ✅ 消费：最早项、空队列、并发、queue_size 更新
- ✅ 取消：正常、幂等、queue_size 更新
- ✅ 查询：状态、排序、位置

## 与其他模块的集成

### 被 Matching 模块使用

```typescript
// apps/api/src/modules/matching/matching.service.ts
import { QueueService } from '../queue/queue.service';

@Injectable()
export class MatchingService {
  constructor(
    @Inject(QueueService) private readonly queueService: QueueService
  ) {}

  async matchOrder(orderId: string) {
    const agent = await this.findBestAgent(orderId);

    if (agent.status === AgentStatus.Idle) {
      // 创建 Pairing
      return this.createPairing(orderId, agent.id);
    } else if (agent.status === AgentStatus.Busy) {
      // 入队
      return this.queueService.enqueue({
        agentId: agent.id,
        taskId,
        orderId,
      });
    }
  }
}
```

### 被 Delivery 模块使用

```typescript
// apps/api/src/modules/delivery/delivery.service.ts
import { QueueService } from '../queue/queue.service';

@Injectable()
export class DeliveryService {
  constructor(
    @Inject(QueueService) private readonly queueService: QueueService
  ) {}

  async onOrderCompleted(agentId: string) {
    // Agent 完成订单后，消费下一个队列任务
    const nextItem = await this.queueService.consumeNext(agentId);
    
    if (nextItem) {
      // 创建 Pairing
      await this.matchingService.createPairing(nextItem.orderId, agentId);
    }
  }
}
```

## 错误处理

### 业务错误

- `BUSINESS_QUEUE_FULL`: 队列已满（400）
- `BUSINESS_IDEMPOTENCY_VIOLATION`: 已在队列中（409）

### 示例

```typescript
try {
  await queueService.enqueue(params);
} catch (error) {
  if (error instanceof BadRequestException) {
    // 队列已满
    console.log('Queue is full, try another agent');
  }
  if (error instanceof ConflictException) {
    // 已在队列中
    console.log('Already queued');
  }
}
```

## 性能考虑

### 查询优化

- `idx_queue_items_agent_created_at`: 用于快速查询 Agent 的队列
- `uq_queue_items_agent_order_queued`: 用于去重和快速查找

### 并发性能

- `FOR UPDATE SKIP LOCKED` 避免了锁等待，提高了并发性能
- 多个消费者可以并行处理不同 Agent 的队列

## 注意事项

1. **数据库迁移**：确保 `queue_items` 表已创建
2. **原子函数**：建议创建 `consume_next_queue_item` 函数以确保真正的原子性
3. **queue_size 同步**：`agents.queue_size` 是冗余字段，由 QueueService 自动维护
4. **权限校验**：DELETE 接口需要验证用户是订单创建者（TODO）

## 维护者

- **Owner #4**: Queue 模块实现与维护
- **Owner #1**: 数据库 schema 和函数管理

## 更新日志

- **2026-01-15**: Phase 2 完成，实现核心队列功能
