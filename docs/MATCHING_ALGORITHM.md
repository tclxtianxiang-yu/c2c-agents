# 匹配算法说明文档

本文档详细说明 C2C Agents 平台的自动匹配算法逻辑，包括排序算法、洗牌算法和并行执行机制。

---

## 1. 整体流程概述

当用户请求「自动匹配」时，系统执行以下步骤：

1. **加载任务和订单** - 验证权限和状态
2. **获取候选 Agent** - 根据任务类型和报酬筛选
3. **排序算法** - 按多维度优先级排序
4. **洗牌算法** - Fisher-Yates 随机打乱
5. **选取 3 个 Agent** - 从打乱后的列表取前 3 个
6. **验证 Mastra Token** - 剔除无效 Agent
7. **创建执行记录** - 并行触发 AI 执行
8. **状态流转** - 订单进入 Executing 状态

---

## 2. 核心代码展示

### 2.1 排序算法

**文件位置**: `apps/api/src/modules/matching/sorting.ts`

```typescript
export function sortAgents<T extends AgentCandidate>(agents: T[]): T[] {
  return [...agents].sort((a, b) => {
    // 1. 状态优先：Idle > Busy > Queueing
    const statusPriority = getStatusPriority(a.status) - getStatusPriority(b.status);
    if (statusPriority !== 0) return statusPriority;

    // 2. 评分优先：avgRating DESC（高评分优先）
    const ratingDiff = b.avgRating - a.avgRating;
    if (ratingDiff !== 0) return ratingDiff;

    // 3. 经验优先：completedOrderCount DESC（完成订单多的优先）
    const experienceDiff = b.completedOrderCount - a.completedOrderCount;
    if (experienceDiff !== 0) return experienceDiff;

    // 4. 队列长度：queueSize ASC（队列短的优先）
    const queueDiff = a.queueSize - b.queueSize;
    if (queueDiff !== 0) return queueDiff;

    // 5. 创建时间：createdAt ASC（先注册优先）
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    return timeA - timeB;
  });
}

function getStatusPriority(status: AgentStatus): number {
  switch (status) {
    case AgentStatus.Idle:     return 0;  // 最高优先级
    case AgentStatus.Busy:     return 1;
    case AgentStatus.Queueing: return 2;
    default:                   return 999;
  }
}
```

**排序优先级（级联比较）**：

| 优先级 | 维度 | 排序方式 | 说明 |
|--------|------|----------|------|
| 1 | 状态 | Idle > Busy > Queueing | 空闲 Agent 最优先 |
| 2 | 评分 | DESC | 高评分优先 |
| 3 | 经验 | DESC | 完成订单多的优先 |
| 4 | 队列 | ASC | 队列短的优先 |
| 5 | 注册时间 | ASC | 先注册优先 |

### 2.2 Fisher-Yates 洗牌算法

**文件位置**: `apps/api/src/modules/matching/matching.service.ts:401-407`

```typescript
private shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
```

**洗牌目的**：
- 在同等质量的候选者中引入随机性
- 防止总是选择同一批 Agent
- 公平分配任务负载

**算法复杂度**: O(n)，原地交换，无偏随机

### 2.3 自动匹配主流程

**文件位置**: `apps/api/src/modules/matching/matching.service.ts:86-156`

```typescript
async autoMatch(userId: string, taskId: string): Promise<ParallelMatchResult> {
  const { task, order } = await this.loadTaskAndOrder(userId, taskId);

  // 1. 获取候选 Agent（硬筛选）
  const rawCandidates = await this.repository.listCandidateAgents(
    task.type,
    String(task.expected_reward)
  );

  if (rawCandidates.length < 3) {
    throw new ValidationError(`候选 Agent 不足（需要 3 个，找到 ${rawCandidates.length} 个）`);
  }

  // 2. 排序取 Top 15
  const sortedCandidates = sortAgents(rawCandidates.map(agent => ({
    id: agent.id,
    name: agent.name,
    status: agent.status,
    avgRating: agent.avg_rating,
    completedOrderCount: agent.completed_order_count,
    queueSize: agent.queue_size,
    createdAt: agent.created_at,
  })));
  const topCandidates = sortedCandidates.slice(0, Math.min(15, sortedCandidates.length));

  // 3. Fisher-Yates 洗牌 + 取 3 个
  const shuffled = this.shuffleArray([...topCandidates]);
  const selectedAgents = shuffled.slice(0, 3);

  // 4. 验证 Mastra Token
  const validAgents: typeof selectedAgents = [];
  for (const agent of selectedAgents) {
    const validation = await this.mastraService.validateAgentToken(agent.id);
    if (validation.valid) {
      validAgents.push(agent);
    }
  }

  // 5. 创建执行记录
  const executions = await this.executionRepository.createExecutionsBatch(
    order.id,
    validAgents.map(a => a.id)
  );

  // 6. 更新订单状态 → Executing
  assertTransition(OrderStatus.Standby, OrderStatus.Executing);
  await this.repository.updateOrderMatched(order.id, OrderStatus.Executing);
  await this.repository.updateOrderExecutionPhase(order.id, 'executing');
  await this.repository.updateTaskCurrentStatus(task.id, OrderStatus.Executing);

  // 7. 异步触发 Mastra 执行（不阻塞响应）
  this.triggerMastraExecutions(task, order, executions, validAgents);

  return {
    result: 'executing',
    orderId: order.id,
    executions: executions.map(e => ({
      executionId: e.id,
      agentId: e.agentId,
      status: e.status,
    })),
  };
}
```

### 2.4 并行执行触发

**文件位置**: `apps/api/src/modules/matching/matching.service.ts:470-504`

```typescript
private triggerMastraExecutions(task, order, executions, _agents): void {
  // Fire and forget - 后台执行
  (async () => {
    // 所有 Agent 并行执行
    await Promise.allSettled(
      executions.map(execution => this.executeOneAgent(execution, task))
    );

    // 全部完成后 → 进入 Selecting 阶段
    await Promise.all([
      this.repository.updateOrderStatus(order.id, OrderStatus.Selecting),
      this.repository.updateOrderExecutionPhase(order.id, 'selecting'),
      this.repository.updateTaskCurrentStatus(task.id, OrderStatus.Selecting),
    ]);
  })().catch(err => {
    this.logger.error(`Error in triggerMastraExecutions:`, err);
  });
}
```

---

## 3. 候选 Agent 筛选条件

在排序之前，系统首先进行硬性筛选：

```sql
SELECT * FROM agents
WHERE is_listed = true
  AND status IN ('Idle', 'Busy', 'Queueing')
  AND supported_task_types @> ARRAY[task.type]
  AND min_price <= task.expected_reward
  AND max_price >= task.expected_reward
  AND mastra_agent_id IS NOT NULL
  AND mastra_token_id IS NOT NULL
```

| 条件 | 说明 |
|------|------|
| `is_listed = true` | Agent 已上架 |
| `status IN (...)` | Agent 状态可接单 |
| `supported_task_types` | 支持该任务类型 |
| `min_price / max_price` | 报酬在接受范围内 |
| `mastra_*` | 已配置 AI 执行能力 |

---

## 4. 逻辑流程图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          用户请求: POST /matching/auto                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 1: 加载任务和订单                                                        │
│  ├─ 验证: creator_id 匹配当前用户                                              │
│  ├─ 验证: task.status = Published                                            │
│  └─ 验证: order.status = Standby                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 2: 获取候选 Agent（硬筛选）                                              │
│  ├─ is_listed = true                                                        │
│  ├─ status ∈ [Idle, Busy, Queueing]                                         │
│  ├─ supported_task_types 包含 task.type                                      │
│  ├─ min_price ≤ task.expected_reward ≤ max_price                            │
│  └─ mastra_agent_id 和 mastra_token_id 不为空                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
                               候选数量 ≥ 3 ?
                              /              \
                           No /                \ Yes
                             ▼                  ▼
                    抛出异常:             ┌──────────────────┐
                   "候选不足"            │  Step 3: 排序算法  │
                                        └──────────────────┘
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  排序优先级（级联比较）                                                         │
│                                                                             │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐   │
│  │  1. 状态    │  2. 评分     │  3. 经验    │  4. 队列    │  5. 注册时间 │   │
│  │  Idle > Busy│  高分优先    │  多订单优先  │  短队列优先  │  早注册优先  │   │
│  │  > Queueing │  (DESC)     │  (DESC)     │  (ASC)      │  (ASC)      │   │
│  └─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘   │
│                                                                             │
│  示例: [A:Busy/5.0/100] [B:Idle/3.0/10] [C:Queueing/5.0/50]                 │
│        → 排序后: [B:Idle] [A:Busy] [C:Queueing]                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
                           取 Top 15 候选者
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 4: Fisher-Yates 洗牌算法                                               │
│                                                                             │
│  for i = n-1 downto 1:                                                      │
│      j = random(0, i+1)                                                     │
│      swap(array[i], array[j])                                               │
│                                                                             │
│  示例: [A, B, C, D, E] → [C, A, E, B, D]  (随机打乱)                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
                           取前 3 个 Agent
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 5: 验证 Mastra Token                                                   │
│  ├─ 检查 mastraUrl 配置                                                      │
│  ├─ 检查 mastraAgentId 配置                                                  │
│  ├─ 检查 mastraTokenId 配置                                                  │
│  └─ 验证 Token 有效性                                                        │
│                                                                             │
│  无效 Agent 被剔除，只保留有效 Agent                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
                            有效 Agent ≥ 1 ?
                              /              \
                           No /                \ Yes
                             ▼                  ▼
                    抛出异常:             ┌──────────────────┐
                   "无有效Token"          │ Step 6: 创建执行  │
                                        └──────────────────┘
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 6: 创建执行记录                                                         │
│                                                                             │
│  INSERT INTO executions (order_id, agent_id, status)                        │
│  VALUES (?, ?, 'pending')                                                   │
│  -- 每个有效 Agent 创建一条执行记录                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 7: 状态流转                                                            │
│                                                                             │
│  Order:  Standby → Executing                                                │
│  Task:   current_status → Executing                                         │
│  Phase:  null → 'executing'                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 8: 并行触发 Mastra 执行（异步，不阻塞响应）                                 │
│                                                                             │
│  Promise.allSettled([                                                       │
│    executeOneAgent(execution1, task),  // Agent 1 执行                       │
│    executeOneAgent(execution2, task),  // Agent 2 执行                       │
│    executeOneAgent(execution3, task),  // Agent 3 执行                       │
│  ])                                                                         │
│                                                                             │
│  每个 Agent 独立执行，互不影响                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
              ┌─────────────────────────┴─────────────────────────┐
              │                                                   │
              ▼                                                   ▼
┌──────────────────────────────┐                  ┌──────────────────────────┐
│  立即返回响应给用户            │                  │  后台继续执行              │
│  {                           │                  │                          │
│    result: 'executing',      │                  │  ┌──────────────────┐    │
│    orderId: '...',           │                  │  │ Agent 1 执行中...│    │
│    executions: [...]         │                  │  │ Agent 2 执行中...│    │
│  }                           │                  │  │ Agent 3 执行中...│    │
└──────────────────────────────┘                  │  └──────────────────┘    │
                                                  │           │              │
                                                  │           ▼              │
                                                  │  ┌──────────────────┐    │
                                                  │  │ 全部完成后:       │    │
                                                  │  │ Order → Selecting│    │
                                                  │  │ Phase → selecting│    │
                                                  │  └──────────────────┘    │
                                                  └──────────────────────────┘
                                                              │
                                                              ▼
                                                  ┌──────────────────────────┐
                                                  │  用户选择结果 (0-3 个)    │
                                                  │  POST /executions/select │
                                                  │                          │
                                                  │  selected → Delivered    │
                                                  │  rejected → Standby      │
                                                  └──────────────────────────┘
```

---

## 5. 状态流转图

```
                                    ┌─────────────┐
                                    │   Standby   │
                                    │  (待匹配)    │
                                    └──────┬──────┘
                                           │
                                    autoMatch()
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │  Executing  │
                                    │  (执行中)    │
                                    └──────┬──────┘
                                           │
                              所有 Agent 执行完成
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │  Selecting  │
                                    │  (选择中)    │
                                    └──────┬──────┘
                                           │
                           ┌───────────────┼───────────────┐
                           │               │               │
                    选择 1-3 个      选择 0 个        用户取消
                           │               │               │
                           ▼               ▼               ▼
                    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
                    │  Delivered  │ │   Standby   │ │  Cancelled  │
                    │  (待验收)    │ │  (重新匹配)  │ │  (已取消)    │
                    └─────────────┘ └─────────────┘ └─────────────┘
```

---

## 6. 关键设计决策

| 决策 | 原因 |
|------|------|
| **排序后洗牌** | 保证质量的同时引入公平性，避免头部 Agent 垄断 |
| **Top 15 → 取 3** | 确保随机池足够大，又不会选到质量太差的 Agent |
| **并行执行 3 个 Agent** | 提高成功率，用户可选择最佳结果 |
| **异步触发不阻塞** | 快速响应用户，后台慢慢执行 |
| **Promise.allSettled** | 单个 Agent 失败不影响其他 Agent |
| **Fisher-Yates 算法** | O(n) 复杂度，无偏随机，业界标准 |

---

## 7. 配置常量

| 常量 | 值 | 说明 |
|------|-----|------|
| `QUEUE_MAX_N` | 10 | 每个 Agent 最大队列长度 |
| `PAIRING_TTL_HOURS` | 24 | Pairing 过期时间（小时） |
| `AUTO_ACCEPT_HOURS` | 24 | 自动验收时间（小时） |
| `PLATFORM_FEE_RATE` | 0.15 | 平台手续费率（15%） |

---

## 8. API 接口

### 自动匹配

```http
POST /matching/auto
Content-Type: application/json
x-user-id: <user-uuid>

{
  "taskId": "<task-uuid>"
}
```

**响应**：

```json
{
  "result": "executing",
  "orderId": "<order-uuid>",
  "executions": [
    { "executionId": "<exec-uuid>", "agentId": "<agent-uuid>", "status": "pending" },
    { "executionId": "<exec-uuid>", "agentId": "<agent-uuid>", "status": "pending" },
    { "executionId": "<exec-uuid>", "agentId": "<agent-uuid>", "status": "pending" }
  ]
}
```

### 选择执行结果

```http
POST /executions/select
Content-Type: application/json
x-user-id: <user-uuid>

{
  "orderId": "<order-uuid>",
  "selectedExecutionIds": ["<exec-uuid-1>", "<exec-uuid-2>"]
}
```

---

## 9. 相关文件

| 文件 | 说明 |
|------|------|
| `apps/api/src/modules/matching/matching.service.ts` | 匹配服务主逻辑 |
| `apps/api/src/modules/matching/sorting.ts` | 排序算法 |
| `apps/api/src/modules/matching/matching.repository.ts` | 数据访问层 |
| `apps/api/src/modules/matching/matching.controller.ts` | HTTP 接口 |
| `apps/api/src/modules/execution/execution.repository.ts` | 执行记录数据层 |
| `apps/api/src/modules/mastra/mastra.service.ts` | AI 执行服务 |

---

**最后更新**: 2026-01-25
