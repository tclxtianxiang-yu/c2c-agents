# Owner #3 Matching 开发计划

> **Owner**: Owner #3
> **模块**: Matching + Pairing（任务详情页 + 匹配撮合后端）
> **职责**: apps/web/src/app/tasks/[id]/page.tsx + apps/api/src/modules/matching
> **创建日期**: 2026-01-24
> **预估工期**: 6-8 天（单人全职）

---

## 📋 总览

### 核心职责（来自 CONTEXT.md）

#### 前端容器（独占）
- `apps/web/src/app/tasks/[id]/page.tsx` - 任务详情页容器（Owner #3 独占）

#### 后端模块
- `apps/api/src/modules/matching/**` - 匹配与 Pairing 业务逻辑

### 功能范围

1. **任务详情页**：
   - 展示 Task 信息、Order 状态、Agent 信息
   - 根据 Order.status 动态渲染操作按钮
   - 支持 A 侧操作：自动匹配、手动选择、Pairing 同意/拒绝、验收、退款、争议

2. **匹配模块**：
   - 自动匹配：筛选候选 Agent + Top1 选择 + Pairing/Queue 创建
   - 手动选择：A 选择特定 Agent + Pairing/Queue 创建
   - Pairing 协商：A/B 双方同意/拒绝 + TTL 超时检测
   - 队列管理：取消排队、队列消费（InProgress 订单完成后）

3. **状态机流转**：
   - Standby → Pairing（匹配成功）
   - Standby → Standby + QueueItem（队列）
   - Pairing → InProgress（双方同意）
   - Pairing → Standby（拒绝/超时）

---

## 🎯 项目现状分析

### ✅ Owner #1 已交付（可依赖）

1. **packages/shared**：
   - ✅ 完整的 DTO（Task、Order、Agent、QueueItem）
   - ✅ 状态机（OrderStatus 枚举 + assertTransition）
   - ✅ 工具函数（toMinUnit、fromMinUnit、时间计算等）
   - ✅ 错误类（ValidationError、InvalidTransitionError）

2. **packages/config**：
   - ✅ 业务常量（PAIRING_TTL_HOURS、QUEUE_MAX_N、AUTO_ACCEPT_HOURS）

3. **infra/supabase/migrations**：
   - ✅ 完整的数据库 schema（tasks、orders、agents、queue_items）

4. **apps/api/src/database**：
   - ✅ SupabaseService（Global 模块）

5. **apps/api/src/modules/core**：
   - ✅ ChainService（链上网关，支付确认、recordEscrow、payout/refund）
   - ✅ RequestIdMiddleware、HttpExceptionFilter

### ❌ 尚未完成（需 Owner #3 实现）

- ❌ Matching 模块后端（matching.controller.ts、matching.service.ts）
- ❌ Pairing 模块后端（pairing.controller.ts、pairing.service.ts）
- ❌ 任务详情页前端（`apps/web/src/app/tasks/[id]/page.tsx`）
- ❌ 队列管理后端（consume-next 逻辑）

---

## 📦 Phase 1: Matching API 核心（2-3 天）

### 目标

实现自动匹配、手动选择、Pairing 协商的完整后端逻辑，提供 REST API 供前端调用。

---

### Task 1.1: 创建 Matching Service（自动匹配核心）

**交付物**: `apps/api/src/modules/matching/matching.service.ts`

**具体任务**:

1. **自动匹配算法**（`autoMatch(orderId: string)`）：
   ```typescript
   async autoMatch(orderId: string): Promise<{
     type: 'pairing' | 'queued';
     agentId: string;
     agentName: string;
     pairingId?: string;
     queuePosition?: number;
   }>;
   ```

   **步骤**：
   - 校验 Order.status === 'Standby'
   - 查询 Task.expectedReward
   - 筛选候选 Agent：
     - `agents.supported_task_types @> [task.type]`
     - `reward >= agents.min_price AND reward <= agents.max_price`
     - `agents.queue_size < QUEUE_MAX_N`
   - 按排序规则排序（见 Task 1.2）
   - Top1 Agent：
     - 若 Idle → 创建 Pairing，Order.status → Pairing
     - 若 Busy → 创建 QueueItem（检查去重），Order 保持 Standby

2. **Agent 状态计算**（`getAgentStatus(agentId: string)`）：
   ```typescript
   async getAgentStatus(agentId: string): Promise<'Idle' | 'Busy' | 'Queueing'>;
   ```

   **逻辑**：
   - 查询 `orders` 表：`SELECT COUNT(*) FROM orders WHERE agent_id = $1 AND status = 'InProgress'`
   - 查询 `queue_items` 表：`SELECT COUNT(*) FROM queue_items WHERE agent_id = $1 AND status = 'queued'`
   - 返回：
     - `InProgress > 0` → 'Busy' / 'Queueing'（取决于 queue_size）
     - 否则 → 'Idle'

3. **幂等性保障**：
   - QueueItem 唯一约束：`UNIQUE (agent_id, order_id) WHERE status = 'queued'`
   - 调用前检查是否已存在 queued 状态的 QueueItem

**依赖**:
- `@c2c-agents/shared` 的 Order、Agent、QueueItem DTO
- `@c2c-agents/config` 的 QUEUE_MAX_N
- SupabaseService

**验收标准**:
- [ ] 自动匹配 Idle Agent 成功创建 Pairing
- [ ] 自动匹配 Busy Agent 成功创建 QueueItem
- [ ] 队列满时不创建 QueueItem，返回明确错误
- [ ] 幂等性测试通过（重复调用不创建重复 QueueItem）

---

### Task 1.2: 实现 Agent 排序算法

**交付物**: `apps/api/src/modules/matching/sorting.ts`

**具体任务**:

1. **排序规则**（参考 PRD 第 8 节）：
   ```typescript
   export function sortAgents(agents: Agent[]): Agent[];
   ```

   **优先级**：
   1. 状态优先：Idle > Busy（队列未满）
   2. 评分优先：avgRating DESC
   3. 经验优先：completedOrderCount DESC
   4. 队列长度：queueSize ASC（Busy 时）
   5. 创建时间：createdAt ASC（先注册优先）

2. **SQL 优化版本**（可选）：
   ```sql
   SELECT * FROM agents
   WHERE supported_task_types @> [$1]
     AND min_price <= $2
     AND max_price >= $2
     AND queue_size < $3
   ORDER BY
     CASE WHEN status = 'Idle' THEN 0 ELSE 1 END,
     avg_rating DESC,
     completed_order_count DESC,
     queue_size ASC,
     created_at ASC
   LIMIT 1;
   ```

**验收标准**:
- [ ] 排序结果符合优先级规则
- [ ] 边界情况测试（所有 Agent Busy、评分相同等）

---

### Task 1.3: 创建 Pairing Service（协商逻辑）

**交付物**: `apps/api/src/modules/matching/pairing.service.ts`

**具体任务**:

1. **创建 Pairing**（`createPairing(orderId, agentId)`）：
   ```typescript
   async createPairing(orderId: string, agentId: string): Promise<{
     pairingId: string;
     expiresAt: string;
   }>;
   ```

   **步骤**：
   - 校验 Order.status === 'Standby'
   - 创建 Pairing 记录（若已存在表则在 orders 中记录 pairing_created_at）
   - 更新 Order：
     - `status = 'Pairing'`
     - `agent_id = agentId`
     - `provider_id = agent.owner_id`
     - `pairing_created_at = NOW()`
   - 计算过期时间：`NOW() + PAIRING_TTL_HOURS`

2. **Pairing 同意/拒绝**（`acceptPairing(orderId, userId, role)`）：
   ```typescript
   async acceptPairing(orderId: string, userId: string, role: 'A' | 'B'): Promise<void>;
   async rejectPairing(orderId: string, userId: string, role: 'A' | 'role'): Promise<void>;
   ```

   **同意逻辑**：
   - 记录 A/B 的决策（可在 orders 表新增字段 `a_agreed`, `b_agreed`）
   - 若双方均同意：
     - `assertTransition(order.status, 'InProgress')`
     - 更新 Order：`status = 'InProgress'`
     - 更新 Agent：`status = 'Busy'`, `current_order_id = orderId`

   **拒绝逻辑**：
   - `assertTransition(order.status, 'Standby')`
   - 更新 Order：`status = 'Standby'`, `agent_id = NULL`, `pairing_created_at = NULL`
   - 若来源为 QueueItem：`UPDATE queue_items SET status = 'canceled' WHERE order_id = $1`

3. **TTL 超时检测**（定时任务或手动触发）：
   ```typescript
   async checkPairingExpiration(): Promise<void>;
   ```

   **步骤**：
   - 查询所有 `status = 'Pairing' AND NOW() > pairing_created_at + PAIRING_TTL_HOURS`
   - 对每条订单执行拒绝逻辑（标记 expired）

**依赖**:
- `@c2c-agents/shared/state-machine` 的 assertTransition
- `@c2c-agents/config` 的 PAIRING_TTL_HOURS
- SupabaseService

**验收标准**:
- [ ] 双方同意后 Order 进入 InProgress，Agent 状态更新为 Busy
- [ ] 任一方拒绝后 Order 回到 Standby
- [ ] TTL 超时检测正常工作（模拟测试）

---

### Task 1.4: 创建 Matching Controller（REST API）

**交付物**: `apps/api/src/modules/matching/matching.controller.ts`

**具体任务**:

1. **自动匹配**：
   ```typescript
   @Post('orders/:orderId/auto-match')
   async autoMatch(@Param('orderId') orderId: string) {
     return this.matchingService.autoMatch(orderId);
   }
   ```

2. **手动选择 Agent**：
   ```typescript
   @Post('orders/:orderId/select-agent')
   async selectAgent(
     @Param('orderId') orderId: string,
     @Body() body: { agentId: string }
   ) {
     return this.matchingService.manualSelect(orderId, body.agentId);
   }
   ```

3. **Pairing 同意**：
   ```typescript
   @Post('orders/:orderId/pairing/accept')
   async acceptPairing(
     @Param('orderId') orderId: string,
     @Request() req: { userId: string; role: 'A' | 'B' }
   ) {
     return this.pairingService.acceptPairing(orderId, req.userId, req.role);
   }
   ```

4. **Pairing 拒绝**：
   ```typescript
   @Post('orders/:orderId/pairing/reject')
   async rejectPairing(
     @Param('orderId') orderId: string,
     @Request() req: { userId: string; role: 'A' | 'B' }
   ) {
     return this.pairingService.rejectPairing(orderId, req.userId, req.role);
   }
   ```

5. **取消排队**：
   ```typescript
   @Post('orders/:orderId/queue/cancel')
   async cancelQueue(@Param('orderId') orderId: string) {
     return this.matchingService.cancelQueue(orderId);
   }
   ```

**依赖**:
- Task 1.1、1.3 的 Service 层

**验收标准**:
- [ ] 所有端点返回正确的响应格式
- [ ] 错误处理统一（使用 HttpExceptionFilter）
- [ ] Postman/curl 测试通过

---

### Task 1.5: 队列消费逻辑（consume-next）

**交付物**: `apps/api/src/modules/matching/queue.service.ts`

**具体任务**:

1. **队列消费函数**（`consumeNext(agentId: string)`）：
   ```typescript
   async consumeNext(agentId: string): Promise<{
     consumed: boolean;
     orderId?: string;
     pairingId?: string;
   }>;
   ```

   **步骤**：
   - 原子抢占 SQL（FOR UPDATE SKIP LOCKED）：
     ```sql
     UPDATE queue_items
     SET status = 'consumed', consumed_at = NOW()
     WHERE id = (
       SELECT id FROM queue_items
       WHERE agent_id = $1 AND status = 'queued'
       ORDER BY created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *;
     ```
   - 若成功消费 → 创建 Pairing（调用 Task 1.3 的 createPairing）
   - 更新 Agent.queue_size -= 1

2. **触发时机**：
   - 订单进入 Paid/Refunded/Completed 时，由 Settlement 模块调用此接口
   - 检查该订单的 Agent 是否有队列，若有则自动消费

**依赖**:
- SupabaseService（支持原子 UPDATE）
- Task 1.3 的 createPairing

**验收标准**:
- [ ] 并发测试通过（多个订单同时完成，队列顺序正确）
- [ ] 队列为空时返回 consumed: false
- [ ] 消费后 QueueItem.status = 'consumed'

---

### Phase 1 验收清单

- [ ] 自动匹配 API 可用（Idle Agent → Pairing，Busy Agent → Queue）
- [ ] 手动选择 API 可用（支持报价范围校验）
- [ ] Pairing 同意/拒绝 API 可用（双方同意 → InProgress）
- [ ] 取消排队 API 可用（QueueItem.status → canceled）
- [ ] 队列消费逻辑正常工作（consume-next 原子性）
- [ ] 单元测试覆盖核心分支（自动匹配、Pairing 协商、队列消费）
- [ ] `pnpm dev --filter @c2c-agents/api` 成功启动

---

## 🎨 Phase 2: 任务详情页 UI（3-4 天）

### 目标

实现任务详情页容器，根据 Order.status 动态展示不同的操作区域和按钮。

---

### Task 2.1: 创建任务详情页容器

**交付物**: `apps/web/src/app/tasks/[id]/page.tsx`

**具体任务**:

1. **基础布局**：
   ```tsx
   export default async function TaskDetailPage({ params }: { params: { id: string } }) {
     const task = await fetchTask(params.id);
     const order = task.currentOrderId ? await fetchOrder(task.currentOrderId) : null;

     return (
       <div>
         <TaskInfoSection task={task} />
         <OrderStatusSection order={order} />
         <ActionSection task={task} order={order} />
       </div>
     );
   }
   ```

2. **TaskInfoSection**（任务基本信息）：
   - 标题、描述、类型、tags、附件列表
   - 创建时间、expectedReward
   - 固定提示：「请勿上传隐私/敏感信息」

3. **OrderStatusSection**（订单状态展示）：
   - 当前状态（Standby/Pairing/InProgress/Delivered 等）
   - Agent 信息（若已分配）
   - 时间轴（创建时间、配对时间、交付时间等）

4. **ActionSection**（根据状态动态渲染）：
   - 见 Task 2.2 ~ 2.7

**依赖**:
- `@c2c-agents/shared` 的 Task、Order DTO
- `packages/ui` 的共享组件（Button、Card、Badge 等）

**验收标准**:
- [ ] 页面可访问且布局稳定
- [ ] Task 信息展示完整
- [ ] 附件列表可点击下载

---

### Task 2.2: Standby 状态操作区（自动匹配 + 手动选择）

**交付物**: `apps/web/src/app/tasks/[id]/_components/StandbyActions.tsx`

**具体任务**:

1. **自动匹配按钮**：
   ```tsx
   <Button onClick={handleAutoMatch}>
     自动匹配
   </Button>
   ```

   **行为**：
   - 调用 `POST /api/matching/orders/:orderId/auto-match`
   - 成功后：
     - 若返回 `type: 'pairing'` → 刷新页面，展示 Pairing UI
     - 若返回 `type: 'queued'` → 显示 Toast「已加入 Agent X 队列，序号 n」

2. **手动选择按钮**：
   ```tsx
   <Button onClick={() => router.push(`/agents?taskId=${task.id}`)}>
     手动选择 Agent
   </Button>
   ```

3. **队列状态卡片**（若已排队）：
   ```tsx
   {queueItem && (
     <Card>
       <p>已加入 {agent.name} 队列，序号 {queuePosition}</p>
       <Button variant="outline" onClick={handleCancelQueue}>
         取消排队
       </Button>
     </Card>
   )}
   ```

   **取消排队**：
   - 调用 `POST /api/matching/orders/:orderId/queue/cancel`
   - 成功后刷新页面，恢复「自动匹配」按钮

**验收标准**:
- [ ] 自动匹配成功后页面状态更新
- [ ] 手动选择跳转到 Agent 市场（带 taskId 参数）
- [ ] 取消排队成功后队列卡片消失

---

### Task 2.3: Pairing 状态操作区（同意/拒绝）

**交付物**: `apps/web/src/app/tasks/[id]/_components/PairingActions.tsx`

**具体任务**:

1. **Agent 信息展示**：
   ```tsx
   <Card>
     <AgentAvatar agent={agent} />
     <p>{agent.name}</p>
     <p>报价范围: {formatAmount(agent.minPrice)} - {formatAmount(agent.maxPrice)} USDT</p>
   </Card>
   ```

2. **同意/拒绝按钮**（A 侧）：
   ```tsx
   <ButtonGroup>
     <Button variant="primary" onClick={handleAccept}>
       同意
     </Button>
     <Button variant="outline" onClick={handleReject}>
       拒绝
     </Button>
   </ButtonGroup>
   ```

   **行为**：
   - 同意：调用 `POST /api/matching/orders/:orderId/pairing/accept`
   - 拒绝：调用 `POST /api/matching/orders/:orderId/pairing/reject`
   - 成功后刷新页面

3. **TTL 倒计时**：
   ```tsx
   <Countdown targetDate={new Date(order.pairingCreatedAt + PAIRING_TTL_HOURS)} />
   ```

4. **双方决策状态**（可选）：
   ```tsx
   <div>
     <Badge>A 已同意</Badge>
     <Badge variant="secondary">B 待决策</Badge>
   </div>
   ```

**验收标准**:
- [ ] 同意按钮点击后 Order 进入 InProgress（刷新后看到）
- [ ] 拒绝按钮点击后 Order 回到 Standby
- [ ] 倒计时正常显示，超时后自动刷新

---

### Task 2.4: InProgress 状态展示区

**交付物**: `apps/web/src/app/tasks/[id]/_components/InProgressStatus.tsx`

**具体任务**:

1. **执行中提示**：
   ```tsx
   <Alert>
     任务执行中，由 {agent.name} 处理
   </Alert>
   ```

2. **无操作按钮**（A 侧只能等待 B 交付）

3. **状态图标**（可选）：
   ```tsx
   <Spinner /> 执行中...
   ```

**验收标准**:
- [ ] 展示 Agent 名称
- [ ] 无操作按钮（符合 PRD）

---

### Task 2.5: Delivered 状态操作区（验收/退款）

**交付物**: `apps/web/src/app/tasks/[id]/_components/DeliveredActions.tsx`

**具体任务**:

1. **交付内容展示**：
   ```tsx
   <Card>
     <h3>交付内容</h3>
     {delivery.contentText && <p>{delivery.contentText}</p>}
     {delivery.externalUrl && <a href={delivery.externalUrl}>查看链接</a>}
     {delivery.attachments.map(file => <FilePreview key={file.id} file={file} />)}
   </Card>
   ```

2. **24h 倒计时**：
   ```tsx
   <Alert>
     剩余时间: <Countdown targetDate={deliveredAt + AUTO_ACCEPT_HOURS} />
     （超时将自动验收）
   </Alert>
   ```

3. **验收通过按钮**：
   ```tsx
   <Button variant="primary" onClick={handleAccept}>
     验收通过
   </Button>
   ```

   **行为**：
   - 调用 `POST /api/settlement/orders/:orderId/accept`（Owner #5 提供）
   - 成功后 Order → Accepted → Paid → Completed

4. **发起退款按钮**：
   ```tsx
   <Button variant="outline" onClick={() => setShowRefundModal(true)}>
     发起退款
   </Button>
   ```

   **退款弹窗**：
   - 输入 refundRequestReason
   - 调用 `POST /api/dispute/orders/:orderId/request-refund`（Owner #6 提供）

**验收标准**:
- [ ] 交付内容正常展示（文本/链接/附件）
- [ ] 倒计时正常显示
- [ ] 验收通过后 Order 进入 Accepted

---

### Task 2.6: RefundRequested/CancelRequested 状态操作区

**交付物**: `apps/web/src/app/tasks/[id]/_components/RequestActions.tsx`

**具体任务**:

1. **请求原因展示**：
   ```tsx
   <Alert variant="warning">
     {role === 'B' ? 'Agent' : 'A'} 发起了退款请求
     <p>原因: {order.refundRequestReason}</p>
   </Alert>
   ```

2. **同意/拒绝按钮**（对方侧）：
   ```tsx
   <ButtonGroup>
     <Button onClick={handleAgree}>同意</Button>
     <Button variant="outline" onClick={handleReject}>拒绝</Button>
   </ButtonGroup>
   ```

   **同意行为**：
   - 调用 `POST /api/dispute/orders/:orderId/agree-refund`（Owner #6）

   **拒绝后**：
   - 展示「平台介入」按钮

3. **平台介入按钮**（拒绝后）：
   ```tsx
   <Button onClick={() => setShowDisputeModal(true)}>
     平台介入
   </Button>
   ```

**验收标准**:
- [ ] 请求原因正常展示
- [ ] 同意按钮点击后 Order → Refunded
- [ ] 拒绝后展示平台介入入口

---

### Task 2.7: Disputed/AdminArbitrating/Completed 状态展示

**交付物**: `apps/web/src/app/tasks/[id]/_components/FinalStates.tsx`

**具体任务**:

1. **Disputed**：
   ```tsx
   <Alert>
     平台介入中，双方可继续协商
     <Button onClick={handleWithdrawDispute}>撤回争议</Button>
   </Alert>
   ```

2. **AdminArbitrating**：
   ```tsx
   <Alert variant="info">
     已进入平台仲裁，等待管理员处理
   </Alert>
   ```

3. **Completed**：
   ```tsx
   <Card>
     <p>订单已完成</p>
     {order.status === 'Paid' && <p>已付款给 Agent</p>}
     {order.status === 'Refunded' && <p>已退款给 A</p>}
     <Button onClick={() => setShowReviewModal(true)}>
       评价 Agent
     </Button>
   </Card>
   ```

**验收标准**:
- [ ] Disputed 可撤回
- [ ] AdminArbitrating 只展示提示
- [ ] Completed 展示评价入口

---

### Phase 2 验收清单

- [ ] 任务详情页可访问且布局稳定
- [ ] Standby 状态展示自动匹配/手动选择按钮
- [ ] Pairing 状态展示同意/拒绝按钮 + TTL 倒计时
- [ ] Delivered 状态展示交付内容 + 验收/退款按钮
- [ ] RefundRequested 状态展示请求原因 + 同意/拒绝按钮
- [ ] Completed 状态展示评价入口
- [ ] 所有操作按钮点击后状态更新正确

---

## 🧪 Phase 3: 测试与优化（1-2 天）

### 目标

编写单元测试、集成测试，确保核心逻辑正确性。

---

### Task 3.1: Matching Service 单元测试

**交付物**: `apps/api/src/modules/matching/__tests__/matching.service.spec.ts`

**测试覆盖**:

1. 自动匹配 Idle Agent 成功创建 Pairing
2. 自动匹配 Busy Agent 成功创建 QueueItem
3. 队列满时返回错误
4. 无候选 Agent 时返回错误
5. 幂等性测试（重复调用不创建重复 QueueItem）

**验收标准**:
- [ ] 所有测试用例通过
- [ ] 覆盖率 > 80%

---

### Task 3.2: Pairing Service 单元测试

**交付物**: `apps/api/src/modules/matching/__tests__/pairing.service.spec.ts`

**测试覆盖**:

1. 创建 Pairing 成功
2. 双方同意后 Order 进入 InProgress
3. 任一方拒绝后 Order 回到 Standby
4. TTL 超时后 Pairing 自动过期

**验收标准**:
- [ ] 所有测试用例通过
- [ ] 覆盖率 > 80%

---

### Task 3.3: 队列消费逻辑测试

**交付物**: `apps/api/src/modules/matching/__tests__/queue.service.spec.ts`

**测试覆盖**:

1. 队列消费成功（FIFO 顺序）
2. 队列为空时返回 consumed: false
3. 并发消费测试（多个订单同时完成）

**验收标准**:
- [ ] 所有测试用例通过
- [ ] 并发测试无死锁

---

### Task 3.4: 前端 E2E 测试（可选）

**交付物**: `apps/web/e2e/task-detail.spec.ts`

**测试覆盖**:

1. 任务详情页加载成功
2. 自动匹配按钮点击后状态更新
3. Pairing 同意/拒绝流程完整

**验收标准**:
- [ ] E2E 测试通过（Playwright）

---

### Phase 3 验收清单

- [ ] Matching Service 单元测试通过
- [ ] Pairing Service 单元测试通过
- [ ] 队列消费逻辑测试通过
- [ ] 前端 E2E 测试通过（可选）

---

## 🔗 与其他 Owner 的接口约定

### Owner #1（依赖）

**使用的接口**:
- ✅ SupabaseService（数据库查询）
- ✅ ChainService.recordEscrow()（支付确认后调用，Task 模块负责）
- ✅ assertTransition（状态机校验）
- ✅ 工具函数（toMinUnit、fromMinUnit、时间计算）

**依赖**: Phase 1~4 的所有交付物

---

### Owner #2（协作）

**提供的接口**:
- ✅ Task 模块提供 Task 查询接口（`GET /api/tasks/:id`）
- ✅ Task 模块在支付确认后调用 `ChainService.recordEscrow()`

**依赖**: Task 模块先完成支付确认逻辑

---

### Owner #4（协作）

**提供的接口**:
- ✅ Agent 模块提供 Agent 查询接口（`GET /api/agents/:id`）
- ✅ Agent 模块提供 Agent 列表接口（`GET /api/agents`，支持筛选）

**依赖**: Agent 模块先完成基础 CRUD

---

### Owner #5（协作）

**调用的接口**:
- ❌ Settlement 模块在订单完成后调用 `QueueService.consumeNext(agentId)`

**依赖**: Owner #5 需在 Paid/Refunded 后调用 consume-next

---

### Owner #6（协作）

**提供的接口**:
- ❌ Dispute 模块提供 `POST /api/dispute/orders/:orderId/request-refund`
- ❌ Dispute 模块提供 `POST /api/dispute/orders/:orderId/agree-refund`
- ❌ Dispute 模块提供 `POST /api/dispute/orders/:orderId/platform-intervene`

**依赖**: Owner #6 需提供退款/争议相关接口

---

## 📁 关键文件路径汇总

### Phase 1 关键文件（后端）

- `apps/api/src/modules/matching/matching.service.ts` - **P0**: 自动匹配核心逻辑
- `apps/api/src/modules/matching/sorting.ts` - **P1**: Agent 排序算法
- `apps/api/src/modules/matching/pairing.service.ts` - **P0**: Pairing 协商逻辑
- `apps/api/src/modules/matching/queue.service.ts` - **P0**: 队列消费逻辑
- `apps/api/src/modules/matching/matching.controller.ts` - **P0**: REST API 端点
- `apps/api/src/modules/matching/matching.module.ts` - **P1**: 模块注册

### Phase 2 关键文件（前端）

- `apps/web/src/app/tasks/[id]/page.tsx` - **P0**: 任务详情页容器
- `apps/web/src/app/tasks/[id]/_components/StandbyActions.tsx` - **P0**: Standby 操作区
- `apps/web/src/app/tasks/[id]/_components/PairingActions.tsx` - **P0**: Pairing 操作区
- `apps/web/src/app/tasks/[id]/_components/DeliveredActions.tsx` - **P0**: Delivered 操作区
- `apps/web/src/app/tasks/[id]/_components/RequestActions.tsx` - **P1**: 退款/中断操作区
- `apps/web/src/app/tasks/[id]/_components/FinalStates.tsx` - **P2**: 最终状态展示

### Phase 3 关键文件（测试）

- `apps/api/src/modules/matching/__tests__/matching.service.spec.ts` - **P1**: Matching 测试
- `apps/api/src/modules/matching/__tests__/pairing.service.spec.ts` - **P1**: Pairing 测试
- `apps/api/src/modules/matching/__tests__/queue.service.spec.ts` - **P1**: 队列测试
- `apps/web/e2e/task-detail.spec.ts` - **P2**: E2E 测试

**优先级说明**: P0 = 最高优先级（必须完成），P1 = 高优先级（建议完成），P2 = 中优先级（可延后）

---

## ✅ 最终交付标准

### Phase 1（后端）

- [ ] `POST /api/matching/orders/:orderId/auto-match` 可用
- [ ] `POST /api/matching/orders/:orderId/select-agent` 可用
- [ ] `POST /api/matching/orders/:orderId/pairing/accept` 可用
- [ ] `POST /api/matching/orders/:orderId/pairing/reject` 可用
- [ ] `POST /api/matching/orders/:orderId/queue/cancel` 可用
- [ ] 队列消费逻辑正常工作（consume-next）
- [ ] 单元测试覆盖率 > 80%

### Phase 2（前端）

- [ ] `/tasks/[id]` 页面可访问且布局稳定
- [ ] Standby 状态展示自动匹配/手动选择按钮
- [ ] Pairing 状态展示同意/拒绝按钮 + TTL 倒计时
- [ ] Delivered 状态展示交付内容 + 验收/退款按钮
- [ ] 所有操作按钮点击后状态更新正确

### Phase 3（测试）

- [ ] Matching Service 单元测试通过
- [ ] Pairing Service 单元测试通过
- [ ] 队列消费逻辑测试通过

---

## 📚 参考文档

- [CONTEXT.md](../CONTEXT.md) - 全局约束与 Code Ownership
- [PRD.md](../PRD.md) - 产品需求文档（第 3、6 节）
- [INTERFACE.md](../INTERFACE.md) - Owner #1 接口文档
- [owner1/PLAN.md](./owner1/PLAN.md) - Owner #1 实现计划
- [supabase_init.sql](../../infra/supabase/migrations/supabase_init.sql) - 数据库 schema

---

## 🎯 关键技术决策总结

### 1. Pairing 决策记录

- **方案**: 在 orders 表中使用 `a_agreed`, `b_agreed` 字段记录双方决策
- **优点**: 无需额外表，查询简单
- **缺点**: 字段冗余，但 MVP 可接受

### 2. 队列消费原子性

- **方案**: 使用 `FOR UPDATE SKIP LOCKED` 保证并发安全
- **优点**: 数据库原生支持，无需分布式锁
- **缺点**: 依赖 PostgreSQL 特性

### 3. TTL 超时检测

- **方案**: 定时任务（cron）每 5 分钟扫描一次
- **优点**: 简单可靠
- **缺点**: 实时性不高（最多 5 分钟延迟），但 MVP 可接受

### 4. Agent 排序算法

- **方案**: SQL ORDER BY（数据库排序）
- **优点**: 性能高，减少 API 层计算
- **缺点**: 复杂排序规则需转换为 SQL

---

## ⚠️ 预估风险点与应对

### 高风险

#### 1. 队列并发冲突

- **应对**: 使用 `FOR UPDATE SKIP LOCKED` + 唯一约束
- **验收**: 并发测试 10 个订单同时完成

#### 2. Pairing TTL 超时不及时

- **应对**: 定时任务间隔调整为 1 分钟（生产环境）
- **降级**: 前端轮询检测超时

### 中风险

#### 3. Agent 排序算法不准确

- **应对**: 编写详细的排序测试用例
- **降级**: 先实现简单排序（只按 avgRating），后续优化

### 低风险

#### 4. 前端状态同步延迟

- **应对**: 操作成功后立即刷新页面
- **降级**: 使用 WebSocket 实时推送（后续优化）

---

**最后更新**: 2026-01-24
**状态**: 待开始
**完成日期**: 预计 2026-01-31
