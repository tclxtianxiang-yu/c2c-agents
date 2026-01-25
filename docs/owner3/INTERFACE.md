# Owner #3 专用接口文档

> **目标读者**: 需要集成匹配、配对、队列功能的模块
> **用途**: Agent 匹配、Pairing 管理、队列消费等核心功能对接
> **同步说明**: 公共规则以 `docs/INTERFACE.md` 为准，本文件补充深度集成细节
> **最后更新**: 2026-01-25

---

## 📋 目录

- [1. 匹配服务 API (已落地)](#1-匹配服务-api-已落地)
- [2. 配对服务 API (已落地)](#2-配对服务-api-已落地)
- [3. 队列服务 API (已落地)](#3-队列服务-api-已落地)
- [4. 核心类型定义](#4-核心类型定义)
- [5. 错误码规范](#5-错误码规范)
- [6. 集成示例](#6-集成示例)
- [7. 测试覆盖](#7-测试覆盖)

---

## 1. 匹配服务 API (已落地)

> **状态**: ✅ 已落地并测试 (Phase 3)
> **测试覆盖率**: 96.59% (26 个测试用例)
> **位置**: `apps/api/src/modules/matching/matching.service.ts`

### 1.1 MatchingService 核心能力

MatchingService 提供自动匹配和手动选择两种匹配模式，支持队列管理和 Agent 状态计算。

**签名摘要**:

```typescript
class MatchingService {
  /**
   * 自动匹配：为 Task 自动选择最优 Agent
   * @param userId - 用户 ID (UUID 或钱包地址)
   * @param taskId - 任务 ID
   * @returns 匹配结果 (pairing 或 queued)
   */
  async autoMatch(userId: string, taskId: string): Promise<MatchResult>;

  /**
   * 手动选择：用户指定 Agent 进行匹配
   * @param userId - 用户 ID (UUID 或钱包地址)
   * @param taskId - 任务 ID
   * @param agentId - 指定的 Agent ID
   * @returns 匹配结果 (pairing 或 queued)
   */
  async manualSelect(userId: string, taskId: string, agentId: string): Promise<MatchResult>;

  /**
   * 获取候选 Agent 列表
   * @param userId - 用户 ID
   * @param taskId - 任务 ID
   * @returns 候选 Agent 列表及队列信息
   */
  async listCandidates(userId: string, taskId: string): Promise<CandidateAgent[]>;

  /**
   * 计算 Agent 当前状态
   * @param agentId - Agent ID
   * @returns Agent 状态 (Idle | Busy | Queueing)
   */
  async getAgentStatus(agentId: string): Promise<AgentStatus>;
}
```

### 1.2 MatchResult 类型

```typescript
type MatchResult =
  | {
      result: 'pairing';
      orderId: string;
      agentId: string;
      providerId: string;
      status: OrderStatus; // OrderStatus.Pairing
    }
  | {
      result: 'queued';
      orderId: string;
      agentId: string;
      status: OrderStatus; // OrderStatus.Standby
      queuePosition: number; // 队列位置 (1-based)
      queuedCount: number; // 队列总长度
      capacity: number; // 队列容量 (QUEUE_MAX_N)
    };
```

### 1.3 自动匹配排序规则

自动匹配按以下优先级排序候选 Agent：

1. **优先级 1**: Agent 状态 (`Idle` > `Busy`)
2. **优先级 2**: 平均评分降序 (`avg_rating DESC`)
3. **优先级 3**: 完成订单数降序 (`completed_order_count DESC`)
4. **优先级 4**: 队列长度升序 (`queue_size ASC`)
5. **优先级 5**: 创建时间升序 (`created_at ASC`)

**排序实现**: `apps/api/src/modules/matching/sorting.ts`

### 1.4 使用示例

#### 自动匹配

```typescript
import { MatchingService } from '@/modules/matching/matching.service';

// 注入 MatchingService
constructor(private readonly matchingService: MatchingService) {}

async matchTask(userId: string, taskId: string) {
  const result = await this.matchingService.autoMatch(userId, taskId);

  if (result.result === 'pairing') {
    // 直接创建 Pairing
    console.log(`Matched with Agent ${result.agentId}`);
    console.log(`Provider: ${result.providerId}`);
    console.log(`Order ${result.orderId} status: ${result.status}`);
  } else {
    // 加入队列
    console.log(`Queued at position ${result.queuePosition}/${result.capacity}`);
    console.log(`Current queue length: ${result.queuedCount}`);
  }
}
```

#### 手动选择

```typescript
async selectAgent(userId: string, taskId: string, agentId: string) {
  try {
    const result = await this.matchingService.manualSelect(userId, taskId, agentId);

    if (result.result === 'pairing') {
      // Agent 当前空闲，直接配对
      return { success: true, type: 'immediate', ...result };
    } else {
      // Agent 忙碌，加入队列
      return { success: true, type: 'queued', ...result };
    }
  } catch (error) {
    if (error.message.includes('Queue is full')) {
      // 队列已满
      return { success: false, reason: 'queue_full' };
    }
    throw error;
  }
}
```

#### 获取候选列表

```typescript
async getCandidates(userId: string, taskId: string) {
  const candidates = await this.matchingService.listCandidates(userId, taskId);

  return candidates.map((agent) => ({
    agentId: agent.agentId,
    name: agent.name,
    description: agent.description,
    status: agent.status,
    priceRange: {
      min: agent.minPrice,
      max: agent.maxPrice,
    },
    queue: {
      available: agent.queue.available,
      total: agent.queue.capacity,
      utilization: `${((agent.queue.queuedCount / agent.queue.capacity) * 100).toFixed(0)}%`,
    },
  }));
}
```

### 1.5 注意事项

- **userId 格式**: 支持 UUID 或钱包地址，服务会自动解析
- **队列容量**: 每个 Agent 最多 `QUEUE_MAX_N` (默认 10) 个排队订单
- **状态检查**: 匹配前会自动检查 Task 和 Order 状态
- **幂等性**: 重复调用 `autoMatch` 会抛出幂等性错误

---

## 2. 配对服务 API (已落地)

> **状态**: ✅ 已落地并测试 (Phase 3)
> **测试覆盖率**: 97.29% (18 个测试用例)
> **位置**: `apps/api/src/modules/matching/pairing.service.ts`

### 2.1 PairingService 核心能力

PairingService 管理 Order 的 Pairing 生命周期，包括创建、接受、拒绝和过期处理。

**签名摘要**:

```typescript
class PairingService {
  /**
   * 创建 Pairing
   * @param orderId - 订单 ID
   * @param agentId - Agent ID
   * @returns Pairing 信息 (包含过期时间)
   */
  async createPairing(orderId: string, agentId: string): Promise<PairingInfo>;

  /**
   * 同意 Pairing (A 或 B 方)
   * @param orderId - 订单 ID
   * @param userId - 用户 ID
   * @param role - 角色 ('A' = 创建者, 'B' = 提供者)
   * @returns 操作结果
   */
  async acceptPairing(
    orderId: string,
    userId: string,
    role: 'A' | 'B'
  ): Promise<PairingAcceptResult>;

  /**
   * 拒绝 Pairing (A 或 B 方)
   * @param orderId - 订单 ID
   * @param userId - 用户 ID
   * @param role - 角色 ('A' = 创建者, 'B' = 提供者)
   * @returns 操作结果
   */
  async rejectPairing(
    orderId: string,
    userId: string,
    role: 'A' | 'B'
  ): Promise<PairingAcceptResult>;

  /**
   * 检查并处理过期的 Pairing
   * @returns 处理结果 (过期订单 ID 列表)
   *
   * 注意: 此方法应由定时任务 (cron) 调用
   */
  async checkPairingExpiration(): Promise<{
    processedCount: number;
    expiredOrderIds: string[];
  }>;
}
```

### 2.2 PairingInfo 类型

```typescript
type PairingInfo = {
  orderId: string;
  agentId: string;
  providerId: string;
  expiresAt: string; // ISO 8601 时间戳
  pairingCreatedAt: string; // ISO 8601 时间戳
};
```

### 2.3 Pairing 过期配置

```typescript
import { PAIRING_TTL_HOURS } from '@c2c-agents/config/constants';

// 默认过期时间: 24 小时
// expiresAt = pairingCreatedAt + PAIRING_TTL_HOURS
```

### 2.4 使用示例

#### 创建 Pairing

```typescript
import { PairingService } from '@/modules/matching/pairing.service';

constructor(private readonly pairingService: PairingService) {}

async initiatePairing(orderId: string, agentId: string) {
  const pairing = await this.pairingService.createPairing(orderId, agentId);

  // 通知双方
  await this.notificationService.notifyCreator(pairing.orderId, {
    type: 'pairing_created',
    agentId: pairing.agentId,
    expiresAt: pairing.expiresAt,
  });

  await this.notificationService.notifyProvider(pairing.providerId, {
    type: 'pairing_request',
    orderId: pairing.orderId,
    expiresAt: pairing.expiresAt,
  });

  return pairing;
}
```

#### 接受 Pairing (创建者)

```typescript
async acceptPairingAsCreator(orderId: string, userId: string) {
  const result = await this.pairingService.acceptPairing(orderId, userId, 'A');

  // Order 状态变更: Pairing → InProgress
  console.log(`Order ${result.orderId} status: ${result.status}`);
  console.log(result.message); // "Pairing accepted, order is now in progress"

  // 更新 Agent 状态为 Busy
  // 更新 Task current_status 为 InProgress

  return result;
}
```

#### 拒绝 Pairing (提供者)

```typescript
async rejectPairingAsProvider(orderId: string, userId: string) {
  const result = await this.pairingService.rejectPairing(orderId, userId, 'B');

  // Order 状态变更: Pairing → Standby
  console.log(`Order ${result.orderId} returned to Standby`);

  // 如果订单来自队列，队列条目被标记为 canceled
  // Task current_status 回到 Standby

  return result;
}
```

#### 定时检查过期 Pairing

```typescript
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class PairingExpirationJob {
  constructor(private readonly pairingService: PairingService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handlePairingExpiration() {
    const result = await this.pairingService.checkPairingExpiration();

    console.log(`Processed ${result.processedCount} expired pairings`);
    console.log(`Expired order IDs: ${result.expiredOrderIds.join(', ')}`);

    // 通知双方 Pairing 已过期
    for (const orderId of result.expiredOrderIds) {
      await this.notificationService.notifyPairingExpired(orderId);
    }
  }
}
```

### 2.5 状态机转换

```
Standby → Pairing  (createPairing)
Pairing → InProgress  (acceptPairing)
Pairing → Standby  (rejectPairing 或过期)
```

### 2.6 权限检查

- **acceptPairing**:
  - `role='A'`: 必须是 Order 创建者 (`order.creator_id === userId`)
  - `role='B'`: 必须是 Order 提供者 (`order.provider_id === userId`)

- **rejectPairing**: 同上

### 2.7 注意事项

- **过期检查**: `acceptPairing` 会自动检查是否超时，超时抛出 `ValidationError`
- **任一方同意**: 当前实现为"任一方同意则进入 InProgress"，如需双方同意逻辑需 Owner #1 添加字段
- **幂等性**: 重复调用状态转换会触发状态机校验错误

---

## 3. 队列服务 API (已落地)

> **状态**: ✅ 已落地并测试 (Phase 3)
> **测试覆盖率**: 100% (15 个测试用例)
> **位置**: `apps/api/src/modules/matching/queue.service.ts`

### 3.1 QueueService 核心能力

QueueService 提供队列消费逻辑，支持单次消费和批量消费，确保并发安全。

**签名摘要**:

```typescript
class QueueService {
  /**
   * 消费队列中的下一个订单
   * @param agentId - Agent ID
   * @returns 消费结果
   */
  async consumeNext(agentId: string): Promise<ConsumeResult>;

  /**
   * 批量消费队列订单
   * @param agentId - Agent ID
   * @param maxCount - 最大消费数量 (默认 QUEUE_MAX_N)
   * @returns 消费结果数组
   */
  async consumeBatch(agentId: string, maxCount?: number): Promise<ConsumeResult[]>;
}
```

### 3.2 ConsumeResult 类型

```typescript
type ConsumeResult = {
  consumed: boolean; // 是否成功消费
  orderId?: string; // 订单 ID
  pairingInfo?: PairingInfo; // Pairing 信息 (consumed=true 时)
};
```

### 3.3 并发安全保证

队列消费使用 **原子抢占机制** 保证并发安全：

```sql
-- 原子抢占 SQL (FOR UPDATE SKIP LOCKED)
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
  FOR UPDATE SKIP LOCKED  -- 并发安全的关键
)
RETURNING *;
```

**关键特性**:
- ✅ **FIFO 顺序**: 严格按 `created_at` 升序消费
- ✅ **无重复消费**: `FOR UPDATE SKIP LOCKED` 保证唯一抢占
- ✅ **竞态安全**: 多进程并发消费不会冲突

### 3.4 使用示例

#### 单次消费

```typescript
import { QueueService } from '@/modules/matching/queue.service';

constructor(private readonly queueService: QueueService) {}

async processNextOrder(agentId: string) {
  const result = await this.queueService.consumeNext(agentId);

  if (!result.consumed) {
    console.log('Queue is empty or agent is busy');
    return null;
  }

  console.log(`Consumed order ${result.orderId}`);
  console.log(`Pairing created, expires at: ${result.pairingInfo.expiresAt}`);

  // 通知双方
  await this.notificationService.notifyPairingCreated(result.orderId);

  return result;
}
```

#### 批量消费

```typescript
async processAllOrders(agentId: string) {
  const results = await this.queueService.consumeBatch(agentId, 5);

  const successful = results.filter((r) => r.consumed);
  console.log(`Consumed ${successful.length} orders`);

  for (const result of successful) {
    await this.notificationService.notifyPairingCreated(result.orderId!);
  }

  return {
    total: results.length,
    successful: successful.length,
    orderIds: successful.map((r) => r.orderId),
  };
}
```

#### Agent 完成订单后自动消费

```typescript
async onOrderCompleted(orderId: string, agentId: string) {
  // 更新订单状态
  await this.orderService.updateStatus(orderId, OrderStatus.Completed);

  // 尝试消费队列中的下一个订单
  const nextResult = await this.queueService.consumeNext(agentId);

  if (nextResult.consumed) {
    console.log(`Agent ${agentId} started next order: ${nextResult.orderId}`);
  } else {
    console.log(`Agent ${agentId} is now idle`);
  }
}
```

### 3.5 消费条件

`consumeNext` 会在以下情况返回 `consumed: false`:

1. **Agent 不存在**: `agent not found`
2. **Agent 仍有进行中订单**: `agent still has N in-progress orders`
3. **队列为空**: `queue is empty`
4. **订单不存在**: `order not found` (跳过并继续)
5. **订单状态非 Standby**: `order is not in Standby status` (跳过并继续)

### 3.6 Agent 状态更新

- **消费成功**: Agent 状态更新为 `Idle` (等待双方接受 Pairing)
- **队列为空**: Agent 状态保持 `Idle`

### 3.7 注意事项

- **FIFO 保证**: 严格按队列加入顺序消费
- **并发安全**: 多进程/多线程调用安全
- **错误容忍**: 批量消费时跳过无效订单，继续处理后续订单
- **性能考虑**: `consumeBatch` 建议 `maxCount ≤ 10`

---

## 4. 核心类型定义

从 `@c2c-agents/shared` 导入:

```typescript
import {
  AgentStatus,
  OrderStatus,
  QueueItemStatus,
  TaskStatus,
} from '@c2c-agents/shared';

// Agent 状态
enum AgentStatus {
  Idle = 'Idle',           // 空闲
  Busy = 'Busy',           // 忙碌 (有进行中订单)
  Queueing = 'Queueing',   // 排队中 (有进行中订单 + 有队列)
}

// Order 状态 (Matching 相关)
enum OrderStatus {
  Standby = 'Standby',       // 等待匹配
  Pairing = 'Pairing',       // 配对中
  InProgress = 'InProgress', // 进行中
  // ... 其他状态见 @c2c-agents/shared
}

// Queue Item 状态
enum QueueItemStatus {
  Queued = 'queued',       // 排队中
  Consumed = 'consumed',   // 已消费
  Canceled = 'canceled',   // 已取消
}
```

从 `@c2c-agents/config/constants` 导入:

```typescript
import { QUEUE_MAX_N, PAIRING_TTL_HOURS } from '@c2c-agents/config/constants';

// 队列容量: 每个 Agent 最多 10 个排队订单
const QUEUE_MAX_N = 10;

// Pairing 过期时间: 24 小时
const PAIRING_TTL_HOURS = 24;
```

---

## 5. 错误码规范

从 `@c2c-agents/shared/errors` 导入:

```typescript
import { ErrorCode, ValidationError } from '@c2c-agents/shared/errors';

// 业务错误码 (3000-3999: Matching 模块)
ErrorCode.BUSINESS_RESOURCE_NOT_FOUND  // Task/Order/Agent 不存在
ErrorCode.AUTH_FORBIDDEN               // 权限不足
ErrorCode.BUSINESS_VALIDATION_FAILED   // 业务逻辑校验失败
```

### 常见错误场景

#### ValidationError

```typescript
// 队列已满
throw new ValidationError('Queue is full (max 10)');

// 订单状态不正确
throw new ValidationError('Order is not in Standby status');

// 任务未发布
throw new ValidationError('Task is not published');

// Pairing 已过期
throw new ValidationError('Pairing has expired');

// 没有可用 Agent
throw new ValidationError('No eligible agents found');
```

#### HttpException

```typescript
import { HttpException } from '@nestjs/common';

// 404: 资源不存在
throw new HttpException(
  { code: ErrorCode.BUSINESS_RESOURCE_NOT_FOUND, message: 'Order not found' },
  404
);

// 403: 权限不足
throw new HttpException(
  { code: ErrorCode.AUTH_FORBIDDEN, message: 'User is not the creator of this order' },
  403
);
```

---

## 6. 集成示例

### 6.1 完整的任务发布到匹配流程

```typescript
import { MatchingService } from '@/modules/matching/matching.service';
import { PairingService } from '@/modules/matching/pairing.service';

@Injectable()
export class TaskWorkflowService {
  constructor(
    private readonly matchingService: MatchingService,
    private readonly pairingService: PairingService
  ) {}

  /**
   * 完整流程：创建任务 → 匹配 Agent → 接受配对 → 开始执行
   */
  async publishAndMatchTask(userId: string, taskData: CreateTaskDto) {
    // 1. 创建任务 (Owner #2 负责)
    const task = await this.taskService.create(userId, taskData);

    // 2. 自动匹配
    const matchResult = await this.matchingService.autoMatch(userId, task.id);

    if (matchResult.result === 'pairing') {
      // 3a. 直接配对成功
      console.log(`Paired with Agent ${matchResult.agentId}`);

      // 等待双方接受
      // ... 前端轮询或 WebSocket 通知

      return {
        status: 'pairing',
        orderId: matchResult.orderId,
        agentId: matchResult.agentId,
      };
    } else {
      // 3b. 加入队列
      console.log(`Queued at position ${matchResult.queuePosition}`);

      // 等待队列消费
      // ... 定时任务会自动消费

      return {
        status: 'queued',
        orderId: matchResult.orderId,
        queuePosition: matchResult.queuePosition,
      };
    }
  }

  /**
   * 用户接受配对
   */
  async acceptPairingAsUser(orderId: string, userId: string) {
    // 接受配对 (A 方)
    const result = await this.pairingService.acceptPairing(orderId, userId, 'A');

    // Order 状态: Pairing → InProgress
    console.log(`Order ${result.orderId} is now in progress`);

    // 通知 Agent 开始工作
    await this.notificationService.notifyAgentStartWork(result.orderId);

    return result;
  }
}
```

### 6.2 Agent 队列消费自动化

```typescript
import { QueueService } from '@/modules/matching/queue.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class QueueConsumerJob {
  constructor(private readonly queueService: QueueService) {}

  /**
   * 定时任务：自动消费所有 Idle Agent 的队列
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async consumeAllIdleAgents() {
    // 查询所有 Idle Agent
    const idleAgents = await this.agentRepository.findIdleAgents();

    for (const agent of idleAgents) {
      try {
        const result = await this.queueService.consumeNext(agent.id);

        if (result.consumed) {
          console.log(`Agent ${agent.id} consumed order ${result.orderId}`);

          // 通知双方
          await this.notificationService.notifyPairingCreated(result.orderId!);
        }
      } catch (error) {
        console.error(`Failed to consume queue for agent ${agent.id}:`, error);
      }
    }
  }

  /**
   * 手动触发：Agent 完成订单后立即消费下一个
   */
  async onAgentFinishOrder(agentId: string, completedOrderId: string) {
    // 更新订单状态
    await this.orderService.complete(completedOrderId);

    // 立即尝试消费下一个
    const result = await this.queueService.consumeNext(agentId);

    if (result.consumed) {
      console.log(`Agent ${agentId} started next order: ${result.orderId}`);
    } else {
      console.log(`Agent ${agentId} queue is empty`);
    }
  }
}
```

### 6.3 处理 Pairing 超时

```typescript
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class PairingMaintenanceJob {
  constructor(private readonly pairingService: PairingService) {}

  /**
   * 定时任务：每小时检查并处理过期的 Pairing
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredPairings() {
    const result = await this.pairingService.checkPairingExpiration();

    console.log(`Cleaned up ${result.processedCount} expired pairings`);

    // 通知双方
    for (const orderId of result.expiredOrderIds) {
      await this.notificationService.notifyPairingExpired(orderId);

      // Order 状态: Pairing → Standby
      // 可以重新匹配
    }
  }
}
```

---

## 7. 测试覆盖

### 7.1 测试覆盖率统计

| 服务文件 | 行覆盖率 | 分支覆盖率 | 函数覆盖率 | 测试用例数 |
|---------|---------|-----------|-----------|----------|
| matching.service.ts | **96.59%** | 80.00% | 100% | 26 |
| pairing.service.ts | **97.29%** | 93.33% | 100% | 18 |
| queue.service.ts | **100%** | 100% | 100% | 15 |

### 7.2 测试文件位置

```
apps/api/src/modules/matching/__tests__/
├── matching.service.spec.ts  (26 tests)
├── pairing.service.spec.ts   (18 tests)
└── queue.service.spec.ts     (15 tests)
```

### 7.3 关键测试场景

#### MatchingService 测试覆盖

- ✅ 自动匹配 Idle Agent
- ✅ 自动匹配 Busy Agent (加入队列)
- ✅ 手动选择 Agent
- ✅ 队列已满处理
- ✅ 多 Agent 排序和选择
- ✅ Agent 状态计算 (Idle/Busy/Queueing)
- ✅ userId 解析 (UUID/钱包地址)
- ✅ 权限验证和错误处理

#### PairingService 测试覆盖

- ✅ 创建 Pairing
- ✅ 接受 Pairing (A/B 方)
- ✅ 拒绝 Pairing (A/B 方)
- ✅ 过期检查和自动清理
- ✅ 权限验证
- ✅ 边界条件 (null 值处理)
- ✅ 状态机转换验证

#### QueueService 测试覆盖

- ✅ 单次消费 (FIFO)
- ✅ 批量消费
- ✅ 并发安全性 (FOR UPDATE SKIP LOCKED)
- ✅ 订单状态验证
- ✅ Agent 状态更新
- ✅ 错误容忍 (跳过无效订单)
- ✅ 空队列处理

### 7.4 运行测试

```bash
# 运行所有 Matching 模块测试
pnpm test --filter @c2c-agents/api -- "matching.*spec"

# 运行单个测试文件
pnpm test --filter @c2c-agents/api -- matching.service.spec.ts

# 生成覆盖率报告
pnpm test --filter @c2c-agents/api --coverage
```

---

## 🆘 常见集成问题

### Q1: 如何处理队列已满的情况?

**A**: 在匹配前检查队列容量，或在 UI 提示用户选择其他 Agent

```typescript
try {
  const result = await matchingService.autoMatch(userId, taskId);
} catch (error) {
  if (error.message.includes('No available agents with queue capacity')) {
    // 所有 Agent 队列已满
    // 建议：提示用户稍后重试或调整任务条件
    return { success: false, reason: 'all_queues_full' };
  }
  throw error;
}
```

### Q2: Pairing 过期后订单如何处理?

**A**: Order 状态回到 Standby，可以重新匹配

```typescript
// 定时任务会自动处理过期 Pairing
// Order: Pairing → Standby
// 用户可以重新调用 autoMatch 或 manualSelect
```

### Q3: 如何确保队列消费的 FIFO 顺序?

**A**: QueueService 使用 `ORDER BY created_at ASC` + `FOR UPDATE SKIP LOCKED` 保证

```typescript
// 数据库层严格按加入时间升序消费
// 无需应用层额外处理
const result = await queueService.consumeNext(agentId);
```

### Q4: 多进程部署时队列消费会冲突吗?

**A**: 不会，`FOR UPDATE SKIP LOCKED` 保证并发安全

```typescript
// PostgreSQL 原子锁机制
// 多个进程同时调用 consumeNext，只有一个会成功获取同一订单
// 其他进程会跳过已锁定的订单
```

### Q5: 如何查看 Agent 的队列状态?

**A**: 使用 `listCandidates` 获取队列信息

```typescript
const candidates = await matchingService.listCandidates(userId, taskId);

for (const agent of candidates) {
  console.log(`Agent ${agent.name}:`);
  console.log(`  Queue: ${agent.queue.queuedCount}/${agent.queue.capacity}`);
  console.log(`  Available: ${agent.queue.available}`);
}
```

### Q6: Agent 状态 Queueing 和 Busy 的区别?

**A**:
- **Busy**: 有进行中订单，无排队订单
- **Queueing**: 有进行中订单，且有排队订单

```typescript
const status = await matchingService.getAgentStatus(agentId);

if (status === AgentStatus.Busy) {
  console.log('Agent is working, queue is empty');
} else if (status === AgentStatus.Queueing) {
  console.log('Agent is working, has orders in queue');
}
```

---

## 📚 相关文档

- [公共接口文档](../INTERFACE.md) - 所有 Owner 必读
- [CONTEXT.md](../CONTEXT.md) - 全局约束与规范
- [Owner #3 开发计划](./PLAN.md) - Phase 分解与时间线
- [测试覆盖率报告](./TEST_COVERAGE_REPORT.md) - 详细测试文档
- [Owner #1 接口文档](../owner1/INTERFACE.md) - 队列系统底层实现

---

**最后更新**: 2026-01-25
**维护者**: Owner #3
**版本**: v1.0.0
**测试状态**: ✅ 所有测试通过 (59/59)
