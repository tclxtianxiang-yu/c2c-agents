# Owner #1 专用接口文档

> **目标读者**: 需要与 Owner #1 核心服务深度集成的特定模块
> **用途**: 链上交互、队列系统、核心服务等高级功能对接
> **同步说明**: 公共规则以 `docs/INTERFACE.md` 为准，本文件补充深度集成细节
> **最后更新**: 2026-01-09

---

## 📋 目录

- [1. 链上交互网关 (已落地)](#1-链上交互网关-已落地)
- [2. 队列系统 API (Owner #4 专用)](#2-队列系统-api-owner-4-专用)
- [3. 核心共享服务 (已落地)](#3-核心共享服务-已落地)
- [4. 测试数据工厂 (开发环境)](#4-测试数据工厂-开发环境)

---

## 1. 链上交互网关 (已落地)

> **状态**: ✅ 已落地 (Phase 4)
> **依赖**: ✅ MockUSDT.sol, Escrow.sol 已实现并部署

### 1.x Phase 4 已落地能力清单

- SupabaseService：Service Role 单例 client（方案 A，RLS policy 暂未启用）
- ChainService：封装 verifyPayment/recordEscrow/executePayout/executeRefund
- HttpExceptionFilter：统一错误结构
- `/api/health`：DB + RPC 健康检查

> 提醒：调用 verifyPayment 时必须显式传入 tokenAddress。

### 1.1 API Core ChainService（推荐）

ChainService 已在 `apps/api/src/modules/core` 落地并全局注入，可直接在任意模块中依赖注入使用。

**签名摘要**:

```typescript
class ChainService {
  verifyPayment(params: {
    txHash: string;
    expectedFrom: string;
    expectedTo: string;
    expectedAmount: string;
    minConfirmations?: number;
  }): Promise<PaymentVerificationResult>;

  recordEscrow(params: {
    orderId: string;
    amount: string;
    minConfirmations?: number; // 最小确认数，未传则使用默认值
  }): Promise<RecordEscrowResult>;

  executePayout(params: {
    orderId: string;
    creatorAddress: string;
    providerAddress: string;
    grossAmount: string;
    feeRate?: number; // 手续费率（0-1），未传则使用默认值
    minConfirmations?: number; // 最小确认数，未传则使用默认值
  }): Promise<PayoutResult>;

  executeRefund(params: {
    orderId: string;
    creatorAddress: string;
    amount: string;
    minConfirmations?: number; // 最小确认数，未传则使用默认值
  }): Promise<RefundResult>;
}
```

**注意点**:
- ChainService 内部自动注入 `CHAIN_RPC_URL`、`MOCK_USDT_ADDRESS`、`ESCROW_ADDRESS`
- 如果直接调用 `@c2c-agents/shared/chain` 的 `verifyPayment`，必须显式传 `tokenAddress`
- Owner #2 必须在 Task 模块“支付确认成功且 Order 创建成功”后调用 `recordEscrow`，失败必须阻断后续流转
- 幂等条件：`escrowedAmounts[orderId] == 0`，重复调用必须返回幂等错误
- ChainService 默认使用 `@c2c-agents/config/constants` 的 `MIN_CONFIRMATIONS`、
  `GAS_PRICE_MULTIPLIER`、`PLATFORM_FEE_RATE`，调用方也可显式传参覆盖

### 1.0 合约已落地信息（Phase 2）

**合约源码**:
- `apps/contracts/contracts/MockUSDT.sol`
- `apps/contracts/contracts/Escrow.sol`

**TypeChain 类型**:
- `apps/contracts/typechain-types/contracts/MockUSDT.ts`
- `apps/contracts/typechain-types/contracts/Escrow.ts`

**部署脚本**:
- `apps/contracts/scripts/deploy.ts`

**环境变量（部署后写入）**:
```bash
MOCK_USDT_ADDRESS=0x...
ESCROW_ADDRESS=0x...
PLATFORM_OPERATOR_PRIVATE_KEY=...
PLATFORM_OPERATOR_ADDRESS=0x...
PLATFORM_ADMIN_ADDRESS=0x...
PLATFORM_FEE_RECEIVER=0x...
```

**说明**:
- `MOCK_USDT_ADDRESS/ESCROW_ADDRESS/PLATFORM_OPERATOR_PRIVATE_KEY` 为 server-only
- API 启动时由 `apps/api/src/config/env.ts` 强制校验

**部署命令（Sepolia）**:
```bash
PATH=/Users/yutianxiang/.nvm/versions/node/v22.18.0/bin:$PATH pnpm --filter @c2c-agents/contracts run deploy
```

**合约能力摘要**:
- MockUSDT: `decimals()=6`, `mint()`(onlyOwner), `faucet()`(public)
- Escrow: `recordEscrow/payout/refund`(operator/admin), `pause/unpause`, `setFeeReceiver`, `grant/revokeOperator`, `sweep`

**事件**:
- `Paid(orderId, token, provider, netAmount, feeReceiver, feeAmount)`
- `Refunded(orderId, token, creator, amount)`

### 1.2 支付确认校验

```typescript
// 从 @c2c-agents/shared/chain 导入
import { verifyPayment } from '@c2c-agents/shared/chain';

/**
 * 校验用户的支付交易是否有效
 *
 * @param txHash - 交易哈希
 * @param expectedFrom - 期望付款地址（A 当前钱包地址）
 * @param expectedTo - 期望收款地址（Escrow 合约地址）
 * @param expectedAmount - 期望金额 (最小单位,string)
 * @param tokenAddress - MockUSDT 合约地址
 * @returns 校验结果 { success: boolean, confirmations?: number }
 */
async verifyPayment(params: {
  txHash: string;
  expectedFrom: string;
  expectedTo: string;
  expectedAmount: string;
  tokenAddress: string;
}): Promise<{
  success: boolean;
  confirmations?: number;
  actualAmount?: string;
  error?: Error;
}>;
```

**使用场景**: Owner #2 (Task 模块) 在用户支付后校验链上交易

```typescript
// Owner #2 使用示例
import { verifyPayment } from '@c2c-agents/shared/chain';
import { MIN_CONFIRMATIONS } from '@c2c-agents/config/constants';
import { validateApiEnv } from '@/config/env';

async verifyTaskPayment(taskId: string, txHash: string) {
  const task = await this.findById(taskId);
  const creatorWalletAddress = await this.walletBindingService.getActiveAddress(task.creatorId);

  const apiEnv = validateApiEnv();
  const result = await verifyPayment({
    txHash,
    expectedFrom: creatorWalletAddress,
    expectedTo: apiEnv.escrowAddress,
    expectedAmount: task.expectedReward,
    tokenAddress: apiEnv.mockUsdtAddress, // 来自 API env 的 MOCK_USDT_ADDRESS
  });

  if (!result.success) {
    throw new BadRequestException(`Payment validation failed: ${result.error?.message}`);
  }

  if ((result.confirmations ?? 0) < MIN_CONFIRMATIONS) {
    throw new BadRequestException(
      `Insufficient confirmations: ${result.confirmations}/${MIN_CONFIRMATIONS}`
    );
  }

  // 更新任务状态
  await this.updateTaskStatus(taskId, TaskStatus.Published);
}
```

> 如果改为在创建 Order 后再校验，则使用 `order.escrowAmount` 作为 expectedAmount。

### 1.3 执行 Payout (结算给 Agent)

```typescript
// 从 @c2c-agents/shared/chain 导入
import { executePayout } from '@c2c-agents/shared/chain';

/**
 * 执行链上 payout (托管资金转给 Agent)
 */
async executePayout(params: {
  orderId: string;
  creatorAddress: string;
  providerAddress: string;
  grossAmount: string;
  feeRate?: number; // 手续费率（0-1），未传则使用默认值
  minConfirmations?: number; // 最小确认数，未传则使用默认值
  signer: Signer;
}): Promise<{
  success: boolean;
  txHash?: string;
  confirmations?: number;
  error?: Error;
}>;
```

**使用场景**: Owner #5 (Settlement 模块) 在订单验收后执行结算

```typescript
// Owner #5 使用示例
import { executePayout } from '@c2c-agents/shared/chain';
import { OrderStatus } from '@c2c-agents/shared';

async settleOrder(orderId: string) {
  const order = await this.orderService.findById(orderId);
  const creatorWalletAddress = await this.walletBindingService.getActiveAddress(order.creatorId);

  // 状态机检查
  assertTransition(order.status, OrderStatus.Paid);

  // 收款地址：WalletBinding 的 active address
  const providerAddress = await this.walletBindingService.getActiveAddress(order.providerId);
  // 执行链上 payout (幂等性由合约保证)
  const result = await executePayout({
    orderId,
    providerAddress,
    grossAmount: order.escrowAmount,
    creatorAddress: creatorWalletAddress,
    signer: this.chainSigner,
  });

  if (!result.success) {
    throw new BadRequestException(`Payout failed: ${result.error?.message}`);
  }

  // 更新订单状态 (幂等性检查)
  await this.db.query(`
    UPDATE orders
    SET
      payout_tx_hash = $1,
      status = 'Paid'
    WHERE id = $2
      AND payout_tx_hash IS NULL
  `, [result.txHash, orderId]);
}
```

### 1.4 执行 Refund (退款给 Task 创建者)

```typescript
// 从 @c2c-agents/shared/chain 导入
import { executeRefund } from '@c2c-agents/shared/chain';

/**
 * 执行链上 refund (托管资金退还给 Task 创建者)
 */
async executeRefund(params: {
  orderId: string;
  creatorAddress: string;
  amount: string;
  minConfirmations?: number; // 最小确认数，未传则使用默认值
  signer: Signer;
}): Promise<{
  success: boolean;
  txHash?: string;
  confirmations?: number;
  error?: Error;
}>;
```

**使用场景**: Owner #6 (Dispute 模块) 在退款/取消/仲裁后执行退款

```typescript
// Owner #6 使用示例
import { executeRefund } from '@c2c-agents/shared/chain';
import { OrderStatus } from '@c2c-agents/shared';

async processRefund(orderId: string) {
  const order = await this.orderService.findById(orderId);

  // 状态机检查
  assertTransition(order.status, OrderStatus.Refunded);

  // 退款地址：WalletBinding 的 active address
  const creatorAddress = await this.walletBindingService.getActiveAddress(order.creatorId);

  // 执行链上退款
  const result = await executeRefund({
    orderId,
    creatorAddress,
    amount: order.escrowAmount, // 全额退款
    signer: this.chainSigner,
  });

  if (!result.success) {
    throw new BadRequestException(`Refund failed: ${result.error?.message}`);
  }

  // 更新订单状态 (幂等性检查)
  await this.db.query(`
    UPDATE orders
    SET
      refund_tx_hash = $1,
      status = 'Refunded'
    WHERE id = $2
      AND refund_tx_hash IS NULL
  `, [result.txHash, orderId]);
}
```

---

## 2. 队列系统 API (Owner #4 专用)

> **状态**: ✅ Schema 已定义,API 待实现
> **表**: `queue_items` (infra/supabase/migrations/supabase_init.sql:548-578)

### 2.1 数据库 Schema

```sql
CREATE TABLE queue_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status queue_item_status NOT NULL DEFAULT 'queued',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ
);

CREATE TYPE queue_item_status AS ENUM ('queued', 'consumed', 'canceled');

CREATE UNIQUE INDEX uq_queue_items_agent_order_queued
  ON queue_items(agent_id, order_id)
  WHERE status = 'queued';
```

### 2.2 核心约束

1. **队列容量**: 每个 Agent 最多持有 `QUEUE_MAX_N` (默认 10) 个 `queued` 状态的 QueueItem
2. **先进先出**: 必须按 `created_at` 升序消费
3. **原子抢占**: `consume-next` 操作必须使用 `FOR UPDATE SKIP LOCKED` 保证并发安全
4. **历史记录允许共存**: `consumed` / `canceled` 与 `queued` 可共存，唯一约束只限制 `queued`

### 2.3 核心 SQL 操作

#### 2.3.1 入队 (enqueue)

```sql
-- 检查队列容量
SELECT COUNT(*) as count
FROM queue_items
WHERE agent_id = $1 AND status = 'queued';

-- 如果 count < QUEUE_MAX_N,允许入队
INSERT INTO queue_items (agent_id, task_id, order_id, status)
VALUES ($1, $2, $3, 'queued')
ON CONFLICT (agent_id, order_id) WHERE status = 'queued' DO NOTHING
RETURNING *;
```

**NestJS 实现示例**:

```typescript
import { QUEUE_MAX_N } from '@c2c-agents/config/constants';
import { QueueItem, QueueItemStatus } from '@c2c-agents/shared';

async enqueue(agentId: string, taskId: string, orderId: string): Promise<QueueItem> {
  // 检查队列容量
  const { count } = await this.db.query<{ count: number }>(`
    SELECT COUNT(*) as count
    FROM queue_items
    WHERE agent_id = $1 AND status = 'queued'
  `, [agentId]);

  if (count >= QUEUE_MAX_N) {
    throw new BadRequestException(`Queue is full (max ${QUEUE_MAX_N})`);
  }

  // 入队 (幂等)
  const item = await this.db.query<QueueItem>(`
    INSERT INTO queue_items (agent_id, task_id, order_id, status)
    VALUES ($1, $2, $3, 'queued')
    ON CONFLICT (agent_id, order_id) WHERE status = 'queued' DO NOTHING
    RETURNING *
  `, [agentId, taskId, orderId]);

  return item;
}
```

#### 2.3.2 消费下一个 (consume-next)

**关键要求**: 必须使用 **单 SQL 原子抢占**,保证并发安全

```sql
-- 原子抢占 + 标记为已消费
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

**NestJS 实现示例**:

```typescript
import { QueueItem, QueueItemStatus } from '@c2c-agents/shared';

async consumeNext(agentId: string): Promise<QueueItem | null> {
  const item = await this.db.query<QueueItem>(`
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
    RETURNING *
  `, [agentId]);

  return item || null;
}
```

**为什么必须单 SQL?**

- ❌ 先 SELECT 再 UPDATE → 并发抢占会重复消费
- ✅ 单 UPDATE + FOR UPDATE SKIP LOCKED → PostgreSQL 原子锁保证唯一

#### 2.3.3 查询队列状态

```typescript
async getQueueStatus(agentId: string) {
  const items = await this.db.query<QueueItem>(`
    SELECT *
    FROM queue_items
    WHERE agent_id = $1 AND status = 'queued'
    ORDER BY created_at ASC
  `, [agentId]);

  return {
    agentId,
    queuedCount: items.length,
    capacity: QUEUE_MAX_N,
    available: QUEUE_MAX_N - items.length,
    items,
  };
}
```

#### 2.3.4 取消排队 (cancel)

```typescript
async cancelQueue(agentId: string, orderId: string): Promise<void> {
  await this.db.query(`
    UPDATE queue_items
    SET
      status = 'canceled',
      canceled_at = NOW()
    WHERE agent_id = $1
      AND order_id = $2
      AND status = 'queued'
  `, [agentId, orderId]);
}
```

### 2.4 完整 QueueService 接口

```typescript
export class QueueService {
  /**
   * 将订单加入 Agent 队列
   * @throws BadRequestException 如果队列已满
   */
  async enqueue(agentId: string, orderId: string): Promise<QueueItem>;

  /**
   * 消费队列中最早的订单 (原子操作)
   * @returns QueueItem 或 null (队列为空)
   */
  async consumeNext(agentId: string): Promise<QueueItem | null>;

  /**
   * 查询 Agent 队列状态
   */
  async getQueueStatus(agentId: string): Promise<{
    agentId: string;
    queuedCount: number;
    capacity: number;
    available: number;
    items: QueueItem[];
  }>;

  /**
   * 取消队列中的特定订单 (标记为 canceled)
   */
  async cancelQueue(agentId: string, orderId: string): Promise<void>;

  /**
   * 移除队列中的特定订单 (物理删除,用于清理)
   */
  async removeFromQueue(agentId: string, orderId: string): Promise<void>;
}
```

---

## 3. 核心共享服务 (已落地)

> **状态**: ✅ 已落地 (Phase 4)
> **位置**: `apps/api/src/common/` + `apps/api/src/modules/core/`

### 3.1 RequestIdMiddleware

```typescript
// 文件: apps/api/src/common/middleware/request-id.middleware.ts
// 为每个请求生成 requestId, 并写入响应头 X-Request-ID
```

### 3.2 HttpExceptionFilter

```typescript
// 文件: apps/api/src/common/filters/http-exception.filter.ts
// 统一错误结构,并将 requestId 回传给前端
```

---

## 4. 测试数据工厂 (开发环境)

> **状态**: 🟡 待实现
> **用途**: 快速生成测试数据用于开发调试

### 4.1 Task 工厂

```typescript
// 未来提供
import { createMockTask } from '@c2c-agents/shared/test-utils';

const task = createMockTask({
  title: 'Test Task',
  rewardAmount: '5000000', // 5 USDT
  creatorId: userId,
});
```

### 4.2 Order 工厂

```typescript
// 未来提供
import { createMockOrder } from '@c2c-agents/shared/test-utils';

const order = createMockOrder({
  taskId: task.id,
  agentId: agent.id,
  status: OrderStatus.InProgress,
  rewardAmount: '5000000',
});
```

### 4.3 Agent 工厂

```typescript
// 未来提供
import { createMockAgent } from '@c2c-agents/shared/test-utils';

const agent = createMockAgent({
  username: 'test_agent',
  walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
  status: AgentStatus.Active,
});
```

---

## 5. 数据库高级模式

### 5.1 触发器 (已实现)

当前仅保留 `updated_at` 自动更新时间戳触发器（tasks/orders/agents/disputes/user_profiles 等），
**没有**业务状态自动变更触发器。如需新增业务触发器，必须走 migration 变更提案。

### 5.2 索引策略 (已实现)

```sql
-- 订单状态查询优化
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_task ON orders(task_id);
CREATE INDEX idx_orders_creator ON orders(creator_id);
CREATE INDEX idx_orders_provider ON orders(provider_id);
CREATE INDEX idx_orders_agent ON orders(agent_id);

-- 队列查询优化
CREATE INDEX idx_queue_items_agent_created_at ON queue_items(agent_id, created_at);
CREATE INDEX idx_queue_items_order ON queue_items(order_id);
CREATE INDEX idx_queue_items_consumed_at ON queue_items(consumed_at);
CREATE INDEX idx_queue_items_canceled_at ON queue_items(canceled_at);
CREATE UNIQUE INDEX uq_queue_items_agent_order_queued
  ON queue_items(agent_id, order_id)
  WHERE status = 'queued';

-- tx_hash 对账/查重优化
CREATE INDEX idx_orders_pay_tx_hash ON orders(pay_tx_hash);
CREATE INDEX idx_orders_payout_tx_hash ON orders(payout_tx_hash);
CREATE INDEX idx_orders_refund_tx_hash ON orders(refund_tx_hash);
```

### 5.3 外键约束 (已实现)

```sql
-- orders 表外键
ALTER TABLE orders ADD CONSTRAINT fk_orders_task
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;

ALTER TABLE orders ADD CONSTRAINT fk_orders_agent
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL;

-- queue_items 表外键
ALTER TABLE queue_items ADD CONSTRAINT fk_queue_items_agent
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;

ALTER TABLE queue_items ADD CONSTRAINT fk_queue_items_order
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
```

**影响**: 删除 Task/Agent 时会级联影响关联数据

### 5.4 业务约束 (服务层实现)

某些业务约束由于复杂性或灵活性考虑,在**服务层**而非数据库层实现:

#### Delivery 内容校验

**约束**: Delivery 必须至少包含以下之一:
- `content_text` (文本内容)
- `external_url` (外链)
- 附件 (`delivery_attachments` 表关联的 `files`)

**实现位置**: `apps/api/src/modules/delivery/delivery.service.ts`

**示例代码**:

```typescript
import { ValidationError } from '@c2c-agents/shared/errors';

async createDelivery(data: CreateDeliveryDto): Promise<Delivery> {
  // 校验至少有一项内容
  const hasContent = !!(
    data.contentText ||
    data.externalUrl ||
    (data.attachmentIds && data.attachmentIds.length > 0)
  );

  if (!hasContent) {
    throw new ValidationError(
      'Delivery must contain at least one of: contentText, externalUrl, or attachments'
    );
  }

  // 创建交付记录
  const delivery = await this.db.query<Delivery>(`
    INSERT INTO deliveries (order_id, provider_id, content_text, external_url, submitted_at)
    VALUES ($1, $2, $3, $4, NOW())
    RETURNING *
  `, [data.orderId, data.providerId, data.contentText, data.externalUrl]);

  // 关联附件
  if (data.attachmentIds && data.attachmentIds.length > 0) {
    await this.attachFilesToDelivery(delivery.id, data.attachmentIds);
  }

  return delivery;
}
```

**测试要求**:

```typescript
// apps/api/src/modules/delivery/__tests__/delivery.service.spec.ts

describe('DeliveryService.createDelivery', () => {
  it('应该拒绝空交付 (无内容/无外链/无附件)', async () => {
    await expect(
      service.createDelivery({
        orderId: 'xxx',
        providerId: 'yyy',
        contentText: null,
        externalUrl: null,
        attachmentIds: [],
      })
    ).rejects.toThrow(ValidationError);
  });

  it('应该接受仅有文本内容的交付', async () => {
    const delivery = await service.createDelivery({
      orderId: 'xxx',
      providerId: 'yyy',
      contentText: 'Task completed',
      externalUrl: null,
      attachmentIds: [],
    });
    expect(delivery.contentText).toBe('Task completed');
  });

  it('应该接受仅有外链的交付', async () => {
    const delivery = await service.createDelivery({
      orderId: 'xxx',
      providerId: 'yyy',
      contentText: null,
      externalUrl: 'https://example.com/result',
      attachmentIds: [],
    });
    expect(delivery.externalUrl).toBe('https://example.com/result');
  });

  it('应该接受仅有附件的交付', async () => {
    const delivery = await service.createDelivery({
      orderId: 'xxx',
      providerId: 'yyy',
      contentText: null,
      externalUrl: null,
      attachmentIds: ['file-uuid-1', 'file-uuid-2'],
    });
    expect(delivery.id).toBeDefined();
  });
});
```

#### Platform Fee Rate 范围约束

**约束**: `orders.platform_fee_rate` 必须在 0-1 之间

**实现层级**:
- ✅ **数据库层**: `CHECK (platform_fee_rate >= 0 AND platform_fee_rate <= 1)`
- ✅ **应用层**: Zod schema 验证

**Zod Schema**:

```typescript
import { z } from 'zod';

const createOrderSchema = z.object({
  taskId: z.string().uuid(),
  rewardAmount: z.string().regex(/^\d+$/),
  platformFeeRate: z.string()
    .regex(/^0(\.\d+)?$|^1(\.0+)?$/)
    .refine(
      (rate) => {
        const num = Number(rate);
        return num >= 0 && num <= 1;
      },
      'Platform fee rate must be between 0 and 1'
    ),
});
```

---

## 6. 开发环境配置

### 6.1 Supabase 本地环境

```bash
# 启动本地 Supabase (Docker)
cd infra/supabase
supabase start

# 运行迁移
supabase migration up

# 重置数据库
supabase db reset
```

### 6.2 环境变量配置

```bash
# .env 示例
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=<从 supabase start 输出获取>

CHAIN_RPC_URL=https://sepolia.infura.io/v3/<your-key>
MOCK_USDT_ADDRESS=<部署后填写>
ESCROW_ADDRESS=<部署后填写>
PLATFORM_OPERATOR_PRIVATE_KEY=<部署钱包私钥>
```

**说明**: 以上链上敏感变量在 API 启动时由 `apps/api/src/config/env.ts` 校验。

---

## 🆘 常见集成问题

### Q1: 如何处理链上交易确认?

**A**: 使用 `MIN_CONFIRMATIONS` 配置:

```typescript
import { MIN_CONFIRMATIONS } from '@c2c-agents/config/constants';

const result = await verifyPayment({
  txHash,
  expectedFrom,
  expectedTo: recipient,
  expectedAmount: amount,
  tokenAddress: mockUsdtAddress,
});

if ((result.confirmations ?? 0) < MIN_CONFIRMATIONS) {
  throw new BadRequestException('Waiting for confirmations');
}
```

### Q2: 队列满了怎么办?

**A**: Owner #3 (Matching) 需要在配对前检查队列容量:

```typescript
const queueStatus = await this.queueService.getQueueStatus(agentId);

if (queueStatus.available === 0) {
  // 跳过此 Agent,选择其他 Agent
  continue;
}
```

### Q3: 如何保证 payout/refund 幂等?

**A**: 合约层和数据库层双重幂等:

```typescript
// 1. 合约层: 检查 order_id 是否已 payout
// 2. 数据库层: WHERE payout_tx_hash IS NULL

await this.db.query(`
  UPDATE orders
  SET payout_tx_hash = $1, status = 'Paid'
  WHERE id = $2 AND payout_tx_hash IS NULL
`, [txHash, orderId]);
```

### Q4: 如何调试触发器逻辑?

**A**: 查看 Supabase 日志:

```bash
# 本地环境
supabase logs

# 或者直接查询 pg_stat_statements
SELECT * FROM pg_stat_statements WHERE query LIKE '%trigger%';
```

---

## 📚 相关文档

- [公共接口文档](../INTERFACE.md) - 所有 Owner 必读
- [CONTEXT.md](../CONTEXT.md) - 全局约束与规范
- [Owner #1 开发计划](./PLAN.md) - Phase 分解与时间线
- [合约接口规范](../CONTRACT.md) - 智能合约 ABI 文档

---

**最后更新**: 2026-01-09
**维护者**: Owner #1
**版本**: v1.0.1
