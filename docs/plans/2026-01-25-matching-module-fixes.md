# Matching Module Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix atomicity and validation issues in the matching module

**Architecture:** Add RPC stored procedures for atomic queue operations, add class-validator decorators to DTOs

**Tech Stack:** PostgreSQL RPC, class-validator, NestJS

---

## 问题修正

经过代码审查，原审阅报告中的部分问题判断需要修正：

| 原判断 | 实际情况 |
|--------|----------|
| 缺少 DatabaseModule 导入 | ❌ 不需要 - DatabaseModule 是 @Global() 模块 |
| 缺少排序测试 | ❌ 已有 - sorting.spec.ts 有完整测试 |
| 队列入列竞态 | ⚠️ 部分存在 - 有唯一约束保护，但可优化 |
| 原子消费问题 | ✅ 需修复 - atomicConsumeQueueItem 是两步操作 |
| DTO 验证缺失 | ✅ 需修复 - 使用 type 而非 class + 装饰器 |

---

## Task 1: 添加原子队列消费 RPC 存储过程

**Files:**
- Create: `infra/supabase/migrations/20260125_add_queue_consume_rpc.sql`
- Modify: `apps/api/src/modules/matching/matching.repository.ts:357-400`

**Step 1: 创建迁移文件**

```sql
-- infra/supabase/migrations/20260125_add_queue_consume_rpc.sql

-- 原子消费队列项的存储过程
-- 使用 FOR UPDATE SKIP LOCKED 实现无锁并发
CREATE OR REPLACE FUNCTION consume_next_queue_item(p_agent_id uuid)
RETURNS TABLE (
  id uuid,
  agent_id uuid,
  order_id uuid,
  task_id uuid,
  status text,
  created_at timestamptz,
  consumed_at timestamptz
) AS $$
DECLARE
  v_item_id uuid;
BEGIN
  -- 原子抢占：SELECT + UPDATE 在同一事务中
  UPDATE queue_items qi
  SET
    status = 'Consumed',
    consumed_at = NOW()
  WHERE qi.id = (
    SELECT q.id
    FROM queue_items q
    WHERE q.agent_id = p_agent_id
      AND q.status = 'Queued'
    ORDER BY q.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING qi.id, qi.agent_id, qi.order_id, qi.task_id, qi.status, qi.created_at, qi.consumed_at
  INTO id, agent_id, order_id, task_id, status, created_at, consumed_at;

  IF FOUND THEN
    RETURN NEXT;
  END IF;

  RETURN;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION consume_next_queue_item IS
'Atomically consume the next queued item for an agent using FOR UPDATE SKIP LOCKED';
```

**Step 2: 更新 Repository 使用 RPC**

修改 `matching.repository.ts` 的 `atomicConsumeQueueItem` 方法：

```typescript
async atomicConsumeQueueItem(agentId: string): Promise<QueueItemRow | null> {
  const { data, error } = await this.supabase.rpc('consume_next_queue_item', {
    p_agent_id: agentId,
  });

  if (error) {
    console.warn(`Failed to consume queue item for agent ${agentId}:`, error);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  const row = data[0];
  return {
    id: row.id,
    agent_id: row.agent_id,
    order_id: row.order_id,
    status: row.status as QueueItemStatus,
    created_at: row.created_at,
  };
}
```

**Step 3: 运行迁移**

```bash
psql "$DATABASE_URL" -f infra/supabase/migrations/20260125_add_queue_consume_rpc.sql
```

**Step 4: 运行测试验证**

```bash
cd apps/api && pnpm test
```

**Step 5: Commit**

```bash
git add infra/supabase/migrations/20260125_add_queue_consume_rpc.sql apps/api/src/modules/matching/matching.repository.ts
git commit -m "feat(matching): add atomic queue consumption RPC

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: 将 DTO 从 type 改为 class + class-validator

**Files:**
- Modify: `apps/api/src/modules/matching/dtos/auto-match.dto.ts`
- Modify: `apps/api/src/modules/matching/dtos/manual-match.dto.ts`
- Modify: `apps/api/src/modules/matching/dtos/pairing.dto.ts`
- Modify: `apps/api/src/modules/matching/matching.controller.ts`

**Step 1: 更新 auto-match.dto.ts**

```typescript
import { IsUUID } from 'class-validator';

export class AutoMatchDto {
  @IsUUID()
  taskId: string;
}
```

**Step 2: 更新 manual-match.dto.ts**

```typescript
import { IsUUID } from 'class-validator';

export class ManualMatchDto {
  @IsUUID()
  taskId: string;

  @IsUUID()
  agentId: string;
}
```

**Step 3: 更新 pairing.dto.ts**

```typescript
import { IsIn, IsUUID } from 'class-validator';

export class PairingActionDto {
  @IsUUID()
  orderId: string;

  @IsIn(['A', 'B'])
  role: 'A' | 'B';
}

export class CancelQueueDto {
  @IsUUID()
  orderId: string;
}
```

**Step 4: 确认 Controller 使用 @Body() 解析**

检查 `matching.controller.ts` 确保所有端点使用 `@Body()` 装饰器，ValidationPipe 会自动验证。

**Step 5: 运行类型检查**

```bash
pnpm typecheck
```

**Step 6: Commit**

```bash
git add apps/api/src/modules/matching/dtos/
git commit -m "feat(matching): add class-validator decorators to DTOs

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: 添加队列并发测试

**Files:**
- Create: `apps/api/src/modules/matching/__tests__/queue-concurrency.spec.ts`

**Step 1: 创建并发测试文件**

```typescript
import { describe, expect, it, vi } from 'vitest';

// 测试并发入列时的幂等性
describe('Queue Concurrency', () => {
  it('should handle concurrent enqueue attempts with unique constraint', async () => {
    // Mock repository 返回唯一约束错误
    const mockRepo = {
      enqueueQueueItem: vi.fn()
        .mockRejectedValueOnce({ code: '23505' }) // 第一次：唯一约束冲突
        .mockResolvedValueOnce({ id: '1', order_id: 'order-1' }), // 第二次成功
      findQueuedItem: vi.fn().mockResolvedValue({ id: '1', order_id: 'order-1' }),
    };

    // 验证冲突时返回已存在的记录
    // ...测试逻辑
  });

  it('should consume only one item when concurrent consume attempts', async () => {
    // 模拟多个并发消费请求
    // 验证只有一个成功
  });
});
```

**Step 2: 运行测试**

```bash
cd apps/api && pnpm test queue-concurrency
```

**Step 3: Commit**

```bash
git add apps/api/src/modules/matching/__tests__/queue-concurrency.spec.ts
git commit -m "test(matching): add queue concurrency tests

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: 添加 Pairing 幂等性增强

**Files:**
- Modify: `apps/api/src/modules/matching/pairing.service.ts:36-84`

**Step 1: 添加幂等检查**

在 `createPairing` 方法开头添加：

```typescript
async createPairing(orderId: string, agentId: string): Promise<PairingInfo> {
  // 幂等检查：如果已经是 Pairing 状态且 agent 匹配，直接返回
  const order = await this.repository.findOrderById(orderId);
  if (!order) {
    throw new HttpException(
      { code: ErrorCode.BUSINESS_RESOURCE_NOT_FOUND, message: 'Order not found' },
      404
    );
  }

  // 幂等：已经是 Pairing 状态且 agent 匹配
  if (order.status === OrderStatus.Pairing && order.agent_id === agentId) {
    const expiresAt = new Date(
      new Date(order.pairing_created_at!).getTime() + PAIRING_TTL_HOURS * 60 * 60 * 1000
    ).toISOString();

    return {
      orderId,
      agentId,
      providerId: order.provider_id!,
      expiresAt,
      pairingCreatedAt: order.pairing_created_at!,
    };
  }

  // 原有逻辑...
}
```

**Step 2: 运行测试**

```bash
cd apps/api && pnpm test pairing
```

**Step 3: Commit**

```bash
git add apps/api/src/modules/matching/pairing.service.ts
git commit -m "feat(matching): add idempotency check to createPairing

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## 执行优先级

| 优先级 | Task | 原因 |
|--------|------|------|
| P0 | Task 1 | 原子队列消费是核心并发安全问题 |
| P1 | Task 2 | DTO 验证防止无效输入 |
| P2 | Task 3 | 并发测试保障代码质量 |
| P2 | Task 4 | 幂等性增强防止重复创建 |

---

**Plan complete and saved to `docs/plans/2026-01-25-matching-module-fixes.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
