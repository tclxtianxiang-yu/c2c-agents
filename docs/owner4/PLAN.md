# Owner #4 Agent 管理 + 队列系统 开发计划

> **Owner**: Owner #4
> **模块**: Agent 管理 + 队列系统
> **职责**: apps/api/src/modules/agent、apps/api/src/modules/queue、apps/web/src/app/agents
> **创建日期**: 2026-01-15
> **预估工期**: 10-14 天（单人全职）

---

## 📋 总览

### 核心职责（来自 CONTEXT.md & DEVIDE_THE_WORK.md）

- **Agent 资产管理**: Agent 的创建/编辑/查询（面向 B），以及市场检索/筛选展示（面向 A）
- **队列核心能力**: QueueItem 的 enqueue / cancel / consume-next（FIFO）
- **队列 P0 约束落地**: 去重（queued 唯一）、队列上限 N、consume-next 原子性（并发只允许一个成功）
- **对外服务抽象**: 向模块 C（Matching）暴露可调用的 QueueService（C 不触碰队列表）
- **Agent 页面容器**: `/agents` 市场页与 `/agents/[id]` 详情页（page.tsx 归 Owner #4）
- **队列相关 UI 输出**: B 工作台队列 Tab 的子组件（B 工作台容器归 Owner #5）

### 独占修改权限

```
apps/api/src/modules/agent/**      - Agent NestJS 模块
apps/api/src/modules/queue/**      - Queue NestJS 模块
apps/web/src/app/agents/**         - Agent 页面容器
apps/web/src/app/agents/[id]/**    - Agent 详情页容器
```

⚠️ **重要**: 以下目录为受限目录，修改需提 PR 由对应 Owner 审核：
- `packages/shared/**` → Owner #1
- `infra/supabase/migrations/**` → Owner #1
- `apps/web/src/app/(b)/workbench/**` → Owner #5（队列子组件由 Owner #4 提供）

---

## 🎯 设计稿分析

### Agent 市场页 (`/agents`)

基于设计稿 `assets/stitch_homepage_dashboard/agents_市场/screen.png`：

**页面结构**：
- 顶部搜索栏：关键词搜索、任务类型筛选
- 左侧筛选面板：
  - Budget（价格范围滑块）
  - Availability（可用性筛选）
  - Price Range（价格区间）
  - Skills & Tags（技能标签多选）
- 右侧 Agent 卡片列表：
  - 头像、名称、验证徽章
  - 评分（星级 + 评分数）
  - 完成订单数
  - 价格范围（如 200 - 600 USDC）
  - 技能标签
  - 「Select Agent」按钮
- 排序选项：Relevance（相关性排序）
- 分页/加载更多

### Agent 详情页 (`/agents/[id]`)

基于设计稿 `assets/stitch_homepage_dashboard/agent_详情页/screen.png`：

**页面结构**：
- 顶部 Agent 信息卡片：
  - 头像、名称、验证徽章
  - 钱包地址（简化显示）
  - 评分 + 评价数 + 完成订单数
- About this Agent 区块：
  - 详细描述文本
  - Capabilities 标签列表
- Mastra Cloud Integration 区块：
  - Mastra URL 链接
  - 验证状态
- Quote Range 区块：
  - 报价范围（50 - 200 USDC）
  - Fee Calculation 说明
- Current Status 区块：
  - Agent 状态（Idle/Busy）
  - 平均等待时间
- 操作按钮：
  - 「Select Agent」（A 视角）
  - 「Message Provider」
- Provider Controls 区块（B 视角）：
  - Wallet Bound 状态
  - Edit Agent Profile
  - Pause Availability
- Recent Activity 区块：
  - 近期完成订单列表

### B 工作台队列 Tab（子组件）

基于设计稿 `assets/stitch_homepage_dashboard/b_的工作台/screen.png`：

**队列相关 UI**：
- 「待确认任务 Request Queue」区块：
  - 队列任务卡片列表
  - 每个卡片：任务标题、金额、创建时间、「Accept」「Reject」按钮
- 队列排序：按 createdAt FIFO 展示

---

## 📦 Phase 1: 后端 Agent 模块（3-4 天）

### 目标

实现 Agent CRUD API，支持 B 端创建/编辑/查询 Agent，A 端市场检索。

---

### Task 1.1: 创建 Agent NestJS 模块基础结构

**交付物**:
- `apps/api/src/modules/agent/agent.module.ts`
- `apps/api/src/modules/agent/agent.controller.ts`
- `apps/api/src/modules/agent/agent.service.ts`
- `apps/api/src/modules/agent/dto/`

**具体任务**:

1. 创建模块文件结构：
   ```
   apps/api/src/modules/agent/
   ├── agent.module.ts
   ├── agent.controller.ts
   ├── agent.service.ts
   ├── dto/
   │   ├── create-agent.dto.ts
   │   ├── update-agent.dto.ts
   │   ├── agent-query.dto.ts
   │   └── agent-response.dto.ts
   └── __tests__/
       ├── agent.service.spec.ts
       └── agent.e2e.spec.ts
   ```

2. DTO 定义（使用 `@c2c-agents/shared` 类型）：
   ```typescript
   // create-agent.dto.ts
   import { Agent, AgentStatus } from '@c2c-agents/shared';

   export class CreateAgentDto {
     name: string;
     description: string;
     avatarUrl?: string;
     mastraUrl: string;
     tags: string[];
     supportedTaskTypes: string[];
     minPrice: string;  // MockUSDT 最小单位
     maxPrice: string;
   }
   ```

3. 在 AppModule 中注册 AgentModule

**依赖**: `@c2c-agents/shared` 的 Agent DTO、AgentStatus 枚举

**验收标准**:
- [ ] 模块结构完整
- [ ] DTO 使用 shared 类型
- [ ] `pnpm typecheck --filter @c2c-agents/api` 通过

---

### Task 1.2: 实现 Agent CRUD API

**交付物**: `apps/api/src/modules/agent/agent.service.ts`

**API 接口定义**:

| 方法 | 路由 | 说明 | 权限 |
|------|------|------|------|
| POST | `/agents` | 创建 Agent | B only |
| GET | `/agents` | 获取 Agent 列表（市场） | Public |
| GET | `/agents/:id` | 获取 Agent 详情 | Public |
| PUT | `/agents/:id` | 更新 Agent | B only (owner) |
| DELETE | `/agents/:id` | 删除 Agent | B only (owner) |
| GET | `/agents/my` | 获取我的 Agent 列表 | B only |

**具体任务**:

1. 创建 Agent：
   ```typescript
   async create(ownerId: string, dto: CreateAgentDto): Promise<Agent> {
     // 1. 校验 minPrice <= maxPrice
     // 2. 校验 mastraUrl 格式
     // 3. 插入 agents 表
     // 4. 初始状态为 Idle
     return agent;
   }
   ```

2. 获取 Agent 列表（带筛选）：
   ```typescript
   async findAll(query: AgentQueryDto): Promise<{
     agents: Agent[];
     total: number;
     page: number;
     pageSize: number;
   }> {
     // 支持筛选：
     // - keyword: 名称/描述模糊搜索
     // - taskType: 支持的任务类型
     // - minPrice/maxPrice: 价格范围
     // - tags: 标签匹配
     // - status: Agent 状态
     // 支持排序：
     // - avgRating: 评分
     // - completedOrderCount: 完成订单数
     // - createdAt: 创建时间
   }
   ```

3. 获取单个 Agent：
   ```typescript
   async findById(id: string): Promise<Agent> {
     // 返回完整 Agent 信息
     // 包含计算字段：queueSize（当前队列长度）
   }
   ```

4. 更新 Agent：
   ```typescript
   async update(id: string, ownerId: string, dto: UpdateAgentDto): Promise<Agent> {
     // 1. 校验 ownerId 是否为 Agent 所有者
     // 2. 更新允许的字段
     // 3. 不允许直接修改 status（由系统计算）
   }
   ```

5. 删除 Agent：
   ```typescript
   async remove(id: string, ownerId: string): Promise<void> {
     // 1. 校验 ownerId 是否为 Agent 所有者
     // 2. 检查是否有进行中的订单（InProgress），有则禁止删除
     // 3. 软删除或硬删除（根据业务需求）
   }
   ```

**技术决策**:
- ✅ 价格字段使用 `string` 类型（MockUSDT 最小单位）
- ✅ Agent 状态（Idle/Busy/Queueing）由系统根据订单和队列状态计算
- ✅ 使用 Supabase SDK 进行数据库操作

**验收标准**:
- [ ] 所有 CRUD 接口可用
- [ ] 权限校验正确（B 只能操作自己的 Agent）
- [ ] 价格范围校验正确

---

### Task 1.3: 实现 Agent 状态计算逻辑

**交付物**: `apps/api/src/modules/agent/agent.service.ts`

**状态计算规则**（来自 PRD）:
- **Idle**: 无 InProgress 订单且队列为空
- **Busy**: 存在 InProgress 订单
- **Queueing**: 存在 InProgress 订单且队列非空

**具体任务**:

1. 实现状态计算函数：
   ```typescript
   async calculateAgentStatus(agentId: string): Promise<AgentStatus> {
     // 1. 查询是否有 InProgress 订单
     const hasInProgressOrder = await this.db.query(`
       SELECT EXISTS(
         SELECT 1 FROM orders
         WHERE agent_id = $1 AND status = 'InProgress'
       )
     `, [agentId]);

     // 2. 查询队列长度
     const queueCount = await this.db.query(`
       SELECT COUNT(*) FROM queue_items
       WHERE agent_id = $1 AND status = 'queued'
     `, [agentId]);

     // 3. 计算状态
     if (!hasInProgressOrder && queueCount === 0) return AgentStatus.Idle;
     if (hasInProgressOrder && queueCount > 0) return AgentStatus.Queueing;
     return AgentStatus.Busy;
   }
   ```

2. 实现队列长度更新：
   ```typescript
   async updateQueueSize(agentId: string): Promise<void> {
     // 更新 agents.queue_size 冗余字段
     await this.db.query(`
       UPDATE agents
       SET queue_size = (
         SELECT COUNT(*) FROM queue_items
         WHERE agent_id = $1 AND status = 'queued'
       )
       WHERE id = $1
     `, [agentId]);
   }
   ```

**验收标准**:
- [ ] 状态计算逻辑正确
- [ ] 队列长度与实际队列一致

---

### Task 1.4: Agent 模块单元测试

**交付物**: `apps/api/src/modules/agent/__tests__/agent.service.spec.ts`

**测试场景**:

1. **创建 Agent**:
   - ✅ 正常创建成功
   - ✅ minPrice > maxPrice 校验失败
   - ✅ mastraUrl 格式校验失败
   - ✅ 必填字段缺失校验失败

2. **查询 Agent 列表**:
   - ✅ 无筛选条件返回所有
   - ✅ 按任务类型筛选
   - ✅ 按价格范围筛选
   - ✅ 按标签筛选
   - ✅ 分页正确

3. **更新 Agent**:
   - ✅ Owner 更新成功
   - ✅ 非 Owner 更新失败（403）
   - ✅ 不允许修改 status

4. **删除 Agent**:
   - ✅ Owner 删除成功
   - ✅ 非 Owner 删除失败（403）
   - ✅ 有进行中订单时删除失败

5. **状态计算**:
   - ✅ 无订单无队列 → Idle
   - ✅ 有进行中订单 → Busy
   - ✅ 有进行中订单且有队列 → Queueing

**验收标准**:
- [ ] 所有测试用例通过
- [ ] 覆盖率 > 80%

---

### Phase 1 验收清单

- [ ] Agent CRUD API 完整可用
- [ ] 权限校验正确
- [ ] 状态计算逻辑正确
- [ ] 单元测试覆盖率 > 80%
- [ ] `pnpm lint` 通过
- [ ] `pnpm typecheck --filter @c2c-agents/api` 通过

---

## 📦 Phase 2: 后端队列模块（3-4 天）

### 目标

实现队列核心能力，满足 P0 约束：去重、上限、原子消费。

---

### Task 2.1: 创建 Queue NestJS 模块

**交付物**:
- `apps/api/src/modules/queue/queue.module.ts`
- `apps/api/src/modules/queue/queue.controller.ts`
- `apps/api/src/modules/queue/queue.service.ts`
- `apps/api/src/modules/queue/dto/`

**模块结构**:
```
apps/api/src/modules/queue/
├── queue.module.ts
├── queue.controller.ts
├── queue.service.ts
├── dto/
│   ├── enqueue.dto.ts
│   └── queue-status.dto.ts
└── __tests__/
    ├── queue.service.spec.ts
    └── queue.e2e.spec.ts
```

**依赖**: `@c2c-agents/shared` 的 QueueItem DTO、QueueItemStatus 枚举

**验收标准**:
- [ ] 模块结构完整
- [ ] 在 AppModule 中注册

---

### Task 2.2: 实现 QueueService 核心接口

**交付物**: `apps/api/src/modules/queue/queue.service.ts`

**核心接口**（供 Owner #3 Matching 模块调用）:

```typescript
@Injectable()
export class QueueService {
  /**
   * 将订单加入 Agent 队列
   * @throws BadRequestException 如果队列已满
   * @throws ConflictException 如果已在队列中
   */
  async enqueue(params: {
    agentId: string;
    taskId: string;
    orderId: string;
  }): Promise<QueueItem>;

  /**
   * 消费队列中最早的订单（原子操作）
   * @returns QueueItem 或 null（队列为空）
   */
  async consumeNext(agentId: string): Promise<QueueItem | null>;

  /**
   * 取消队列中的特定订单
   */
  async cancel(agentId: string, orderId: string): Promise<void>;

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
   * 检查订单是否在队列中
   */
  async isInQueue(agentId: string, orderId: string): Promise<boolean>;

  /**
   * 获取订单在队列中的位置（1-based）
   */
  async getQueuePosition(agentId: string, orderId: string): Promise<number | null>;
}
```

**具体实现**:

1. **enqueue（入队）**:
   ```typescript
   async enqueue(params: EnqueueParams): Promise<QueueItem> {
     const { agentId, taskId, orderId } = params;

     // 1. 检查队列容量
     const { count } = await this.db.query<{ count: number }>(`
       SELECT COUNT(*) as count
       FROM queue_items
       WHERE agent_id = $1 AND status = 'queued'
     `, [agentId]);

     if (count >= QUEUE_MAX_N) {
       throw new BadRequestException(`Queue is full (max ${QUEUE_MAX_N})`);
     }

     // 2. 入队（幂等：ON CONFLICT DO NOTHING）
     const result = await this.db.query<QueueItem>(`
       INSERT INTO queue_items (agent_id, task_id, order_id, status)
       VALUES ($1, $2, $3, 'queued')
       ON CONFLICT (agent_id, order_id) WHERE status = 'queued' DO NOTHING
       RETURNING *
     `, [agentId, taskId, orderId]);

     if (!result) {
       throw new ConflictException('Order already in queue');
     }

     // 3. 更新 Agent 的 queue_size
     await this.agentService.updateQueueSize(agentId);

     return result;
   }
   ```

2. **consumeNext（原子消费）**:
   ```typescript
   async consumeNext(agentId: string): Promise<QueueItem | null> {
     // ⚠️ 关键：单 SQL 原子抢占，保证并发安全
     const result = await this.db.query<QueueItem>(`
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

     if (result) {
       // 更新 Agent 的 queue_size
       await this.agentService.updateQueueSize(agentId);
     }

     return result || null;
   }
   ```

3. **cancel（取消）**:
   ```typescript
   async cancel(agentId: string, orderId: string): Promise<void> {
     await this.db.query(`
       UPDATE queue_items
       SET
         status = 'canceled',
         canceled_at = NOW()
       WHERE agent_id = $1
         AND order_id = $2
         AND status = 'queued'
     `, [agentId, orderId]);

     // 更新 Agent 的 queue_size
     await this.agentService.updateQueueSize(agentId);
   }
   ```

**技术决策**:
- ✅ **单 SQL 原子抢占**: `FOR UPDATE SKIP LOCKED` 保证并发安全
- ✅ **幂等入队**: `ON CONFLICT DO NOTHING` 防止重复入队
- ✅ **队列容量**: 使用 `QUEUE_MAX_N` 配置常量

**验收标准**:
- [ ] enqueue 队列满时返回 400
- [ ] enqueue 重复入队返回 409
- [ ] consumeNext 并发调用只有一个成功
- [ ] cancel 正确标记为 canceled

---

### Task 2.3: 实现队列 API Controller

**交付物**: `apps/api/src/modules/queue/queue.controller.ts`

**API 接口**:

| 方法 | 路由 | 说明 | 权限 |
|------|------|------|------|
| GET | `/queue/agents/:agentId/status` | 获取 Agent 队列状态 | Public |
| GET | `/queue/orders/:orderId/position` | 获取订单在队列中的位置 | A/B |
| DELETE | `/queue/agents/:agentId/orders/:orderId` | 取消排队 | A only |

**说明**: enqueue 和 consumeNext 是内部接口，由 Matching 模块（Owner #3）通过依赖注入调用，不暴露 HTTP API。

**验收标准**:
- [ ] API 接口可用
- [ ] 权限校验正确

---

### Task 2.4: Queue 模块单元测试

**交付物**: `apps/api/src/modules/queue/__tests__/queue.service.spec.ts`

**测试场景**:

1. **enqueue 入队**:
   - ✅ 正常入队成功
   - ✅ 队列已满（达到 QUEUE_MAX_N）返回 400
   - ✅ 重复入队返回 409（幂等）
   - ✅ 入队后 queue_size 更新正确

2. **consumeNext 消费**:
   - ✅ 消费最早的 QueueItem
   - ✅ 队列为空返回 null
   - ✅ **并发测试**: 10 个并发请求只有 1 个成功消费
   - ✅ 消费后 queue_size 更新正确

3. **cancel 取消**:
   - ✅ 取消成功，状态变为 canceled
   - ✅ 取消不存在的 QueueItem 无影响（幂等）
   - ✅ 取消后 queue_size 更新正确

4. **getQueueStatus 查询**:
   - ✅ 返回正确的队列状态
   - ✅ items 按 created_at 升序排列

5. **getQueuePosition 位置查询**:
   - ✅ 返回正确的位置（1-based）
   - ✅ 不在队列中返回 null

**验收标准**:
- [ ] 所有测试用例通过
- [ ] 并发测试通过（consumeNext 原子性）
- [ ] 覆盖率 > 80%

---

### Task 2.5: Queue E2E 测试

**交付物**: `apps/api/src/modules/queue/__tests__/queue.e2e.spec.ts`

**E2E 测试场景**:

1. **完整队列流程**:
   - A 创建任务 → 支付成功 → 自动匹配命中 Busy Agent → 入队成功
   - 查询队列位置正确
   - Agent 完成当前订单 → consumeNext → 创建 Pairing
   - 队列位置更新

2. **并发入队测试**:
   - 10 个任务同时尝试入队同一 Agent
   - 验证队列容量限制

3. **取消排队流程**:
   - A 取消排队 → 队列项状态为 canceled
   - 重新自动匹配可以再次入队

**验收标准**:
- [ ] E2E 测试通过
- [ ] 队列流程完整可用

---

### Phase 2 验收清单

- [ ] QueueService 核心接口完整
- [ ] enqueue 幂等且队列容量限制有效
- [ ] consumeNext 原子性测试通过
- [ ] 单元测试覆盖率 > 80%
- [ ] E2E 测试通过
- [ ] `pnpm lint` 通过

---

## 🎨 Phase 3: 前端 Agent 市场页（2-3 天）

### 目标

实现 `/agents` 市场页，支持搜索、筛选、排序，展示 Agent 卡片列表。

---

### Task 3.1: 创建 Agent 市场页容器

**交付物**: `apps/web/src/app/agents/page.tsx`

**具体任务**:

1. 页面布局（参考设计稿）：
   ```tsx
   // apps/web/src/app/agents/page.tsx
   export default function AgentsMarketPage() {
     return (
       <div className="flex">
         {/* 左侧筛选面板 */}
         <AgentFilterPanel />

         {/* 右侧 Agent 列表 */}
         <div className="flex-1">
           <AgentSearchBar />
           <AgentSortSelector />
           <AgentCardList />
           <LoadMoreButton />
         </div>
       </div>
     );
   }
   ```

2. 状态管理：
   - 筛选条件状态
   - 排序状态
   - 分页状态
   - Agent 列表数据

3. API 对接：
   - 调用 `GET /agents` 接口
   - 支持筛选参数传递

**设计稿参考**: `assets/stitch_homepage_dashboard/agents_市场/screen.png`

**验收标准**:
- [ ] 页面布局与设计稿一致
- [ ] 筛选功能正常
- [ ] 排序功能正常
- [ ] 分页/加载更多正常

---

### Task 3.2: 实现 Agent 卡片组件

**交付物**: `apps/web/src/components/agent/AgentCard.tsx`

**组件 Props**:
```typescript
interface AgentCardProps {
  agent: Agent;
  showSelectButton?: boolean;
  onSelect?: (agentId: string) => void;
  disabled?: boolean;
  disabledReason?: string;
}
```

**UI 元素**（参考设计稿）:
- 头像 + 验证徽章
- 名称
- 评分（星级 + 评分数）
- 完成订单数
- 价格范围
- 技能标签（最多显示 3 个）
- 状态指示器（Idle/Busy/Queue）
- 「Select Agent」按钮

**验收标准**:
- [ ] 组件样式与设计稿一致
- [ ] 状态指示正确
- [ ] 按钮禁用状态正确

---

### Task 3.3: 实现筛选面板组件

**交付物**: `apps/web/src/components/agent/AgentFilterPanel.tsx`

**筛选项**（参考设计稿）:
- Budget：价格范围滑块
- Availability：状态筛选（All/Idle/Busy）
- Show only Idle：快捷开关
- Price Range：最低/最高价格输入
- Skills & Tags：标签多选

**验收标准**:
- [ ] 筛选组件样式与设计稿一致
- [ ] 筛选条件变化触发列表更新

---

### Task 3.4: 实现任务上下文选择流程

**交付物**: `apps/web/src/components/agent/AgentSelectModal.tsx`

**场景说明**:
当 A 从任务详情页点击「手动选择 Agent」时，跳转到 Agent 市场页，此时需要携带任务上下文。

**功能**:
1. URL 参数传递任务信息（taskId、reward、taskType）
2. 显示当前任务信息卡片
3. Agent 卡片显示匹配状态：
   - 价格不匹配：按钮置灰 + 提示
   - 队列已满：按钮置灰 + 提示
   - 可选择：按钮可点击
4. 点击「Select Agent」后：
   - 调用 Matching 模块的配对 API
   - 返回任务详情页

**验收标准**:
- [ ] 任务上下文正确传递
- [ ] 匹配状态判断正确
- [ ] 选择后流程正确

---

### Phase 3 验收清单

- [ ] `/agents` 页面可访问
- [ ] 筛选、排序、分页功能正常
- [ ] Agent 卡片样式与设计稿一致
- [ ] 任务上下文选择流程正常
- [ ] 响应式布局正确

---

## 🎨 Phase 4: 前端 Agent 详情页（2-3 天）

### 目标

实现 `/agents/[id]` 详情页，展示 Agent 完整信息，支持 A 端选择和 B 端管理。

---

### Task 4.1: 创建 Agent 详情页容器

**交付物**: `apps/web/src/app/agents/[id]/page.tsx`

**具体任务**:

1. 页面布局（参考设计稿）：
   ```tsx
   // apps/web/src/app/agents/[id]/page.tsx
   export default function AgentDetailPage({ params }: { params: { id: string } }) {
     return (
       <div>
         {/* Agent 基础信息 */}
         <AgentHeader agent={agent} />

         <div className="grid grid-cols-3 gap-6">
           {/* 左侧详情 */}
           <div className="col-span-2">
             <AboutAgent agent={agent} />
             <MastraIntegration agent={agent} />
             <RecentActivity agentId={agent.id} />
           </div>

           {/* 右侧操作 */}
           <div>
             <QuoteRange agent={agent} />
             <CurrentStatus agent={agent} />
             <ActionButtons agent={agent} />
             {isOwner && <ProviderControls agent={agent} />}
           </div>
         </div>
       </div>
     );
   }
   ```

2. 数据获取：
   - 调用 `GET /agents/:id` 接口
   - 判断当前用户是否为 Agent 所有者

**设计稿参考**: `assets/stitch_homepage_dashboard/agent_详情页/screen.png`

**验收标准**:
- [ ] 页面布局与设计稿一致
- [ ] 数据展示正确
- [ ] A/B 视角区分正确

---

### Task 4.2: 实现 About Agent 组件

**交付物**: `apps/web/src/components/agent/AboutAgent.tsx`

**UI 元素**:
- 详细描述文本
- Capabilities 标签列表

**验收标准**:
- [ ] 描述文本正确展示
- [ ] 标签样式正确

---

### Task 4.3: 实现 Mastra Integration 组件

**交付物**: `apps/web/src/components/agent/MastraIntegration.tsx`

**UI 元素**:
- Mastra URL 链接（可点击跳转）
- 验证状态标识
- Clone/Verify 操作按钮（如设计稿所示）

**验收标准**:
- [ ] URL 链接可点击
- [ ] 验证状态正确显示

---

### Task 4.4: 实现 Provider Controls 组件（B 视角）

**交付物**: `apps/web/src/components/agent/ProviderControls.tsx`

**功能**:
- Wallet Bound 状态显示
- 「Edit Agent Profile」按钮 → 跳转编辑页
- 「Pause Availability」开关 → 暂停/恢复接单

**验收标准**:
- [ ] 仅 Agent 所有者可见
- [ ] 操作功能正常

---

### Task 4.5: 实现 Recent Activity 组件

**交付物**: `apps/web/src/components/agent/RecentActivity.tsx`

**功能**:
- 展示该 Agent 近期完成的订单列表
- 显示订单标题、金额、完成时间

**API 调用**: `GET /agents/:id/orders?status=Completed&limit=5`

**验收标准**:
- [ ] 订单列表正确展示
- [ ] 空状态处理

---

### Phase 4 验收清单

- [ ] `/agents/[id]` 页面可访问
- [ ] A 视角：可选择 Agent
- [ ] B 视角：可编辑 Agent
- [ ] 所有组件样式与设计稿一致

---

## 🎨 Phase 5: B 工作台队列子组件（1-2 天）

### 目标

为 Owner #5 的 B 工作台提供队列相关子组件。

---

### Task 5.1: 实现队列任务卡片组件

**交付物**: `apps/web/src/components/queue/QueueTaskCard.tsx`

**组件 Props**:
```typescript
interface QueueTaskCardProps {
  queueItem: QueueItem;
  task: Task;
  position: number;
  onAccept?: (queueItemId: string) => void;
  onReject?: (queueItemId: string) => void;
}
```

**UI 元素**（参考设计稿）:
- 任务标题
- 金额
- 创建时间
- 排队位置
- 「Accept」「Reject」按钮

**验收标准**:
- [ ] 组件样式与设计稿一致
- [ ] 按钮操作正确

---

### Task 5.2: 实现队列列表组件

**交付物**: `apps/web/src/components/queue/QueueList.tsx`

**组件 Props**:
```typescript
interface QueueListProps {
  agentId: string;
}
```

**功能**:
- 调用 `GET /queue/agents/:agentId/status` 获取队列状态
- 渲染 QueueTaskCard 列表
- 空队列状态处理

**验收标准**:
- [ ] 队列列表正确展示
- [ ] 空状态处理
- [ ] 实时刷新（可选：WebSocket 或轮询）

---

### Phase 5 验收清单

- [ ] 队列子组件样式与设计稿一致
- [ ] 组件可被 Owner #5 集成到 B 工作台
- [ ] 操作功能正常

---

## 🔗 Phase 6: 集成测试与文档（1 天）

### 目标

完成模块间集成测试，编写接口文档。

---

### Task 6.1: 与 Matching 模块集成测试

**测试场景**:
1. 自动匹配 → 命中 Idle Agent → 创建 Pairing
2. 自动匹配 → 命中 Busy Agent → 入队成功
3. 自动匹配 → Agent 队列已满 → 跳过该 Agent
4. Agent 完成订单 → consumeNext → 自动创建 Pairing

**验收标准**:
- [ ] 集成测试通过
- [ ] 状态流转正确

---

### Task 6.2: 编写 QueueService 接口文档

**交付物**: `docs/owner4/INTERFACE.md`

**内容**:
- QueueService 接口说明
- 调用示例
- 错误码说明
- 并发注意事项

---

### Phase 6 验收清单

- [ ] 集成测试通过
- [ ] 接口文档完整

---

## 🔄 跨阶段依赖关系

```
Phase 1 (Agent 后端) ← 无依赖，可立即开始
    ↓
Phase 2 (Queue 后端) ← 依赖 Phase 1 的 AgentService
    ↓
Phase 3 (Agent 市场页) ← 依赖 Phase 1 的 API
    ↓
Phase 4 (Agent 详情页) ← 依赖 Phase 1 的 API
    ↓
Phase 5 (队列子组件) ← 依赖 Phase 2 的 API
    ↓
Phase 6 (集成测试) ← 依赖所有前置 Phase
```

**建议执行顺序**:
1. **Phase 1** 和 **Phase 3** 可并行（后端/前端分离）
2. **Phase 2** 在 Phase 1 完成后开始
3. **Phase 4** 和 **Phase 5** 可并行
4. **Phase 6** 在所有功能完成后进行

**总预估时间**: 10-14 天（单人全职）

---

## 🤝 与其他 Owner 的接口约定

### 调用 Owner #1 (Core 模块) 的接口

**数据库服务**:
- `SupabaseService` - 数据库操作

**配置常量**:
- `QUEUE_MAX_N` - 队列容量上限
- `PLATFORM_FEE_RATE` - 手续费率（用于计算）

**共享类型**:
- `Agent`, `QueueItem` - DTO 类型
- `AgentStatus`, `QueueItemStatus` - 枚举

---

### 暴露给 Owner #3 (Matching 模块) 的接口

**QueueService**:
```typescript
// Owner #3 可通过依赖注入使用
import { QueueService } from '../queue/queue.service';

@Injectable()
export class MatchingService {
  constructor(private readonly queueService: QueueService) {}

  async matchOrder(orderId: string) {
    // 找到合适的 Agent
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

**AgentService**:
```typescript
// Owner #3 可查询 Agent 信息
async findAvailableAgents(query: MatchingQuery): Promise<Agent[]>;
async getAgentById(id: string): Promise<Agent>;
```

---

### 暴露给 Owner #5 (Delivery 模块) 的接口

**QueueService.consumeNext**:
```typescript
// 当 Agent 完成订单后，Owner #5 调用此方法获取下一个队列任务
async onOrderCompleted(agentId: string) {
  const nextItem = await this.queueService.consumeNext(agentId);
  if (nextItem) {
    // 创建 Pairing
    await this.matchingService.createPairing(nextItem.orderId, agentId);
  } else {
    // 队列为空，Agent 变为 Idle
    await this.agentService.updateStatus(agentId, AgentStatus.Idle);
  }
}
```

---

### 暴露给其他容器 Owner 的子组件

**Agent 卡片组件** (给 Owner #3 任务详情页使用):
- `AgentCard` - Agent 信息展示卡片
- `AgentSelectButton` - Agent 选择按钮

**队列组件** (给 Owner #5 B 工作台使用):
- `QueueTaskCard` - 队列任务卡片
- `QueueList` - 队列列表

---

## 📁 关键文件路径汇总

### Phase 1 关键文件
- `apps/api/src/modules/agent/agent.module.ts` - **P0**: Agent 模块入口
- `apps/api/src/modules/agent/agent.service.ts` - **P0**: Agent 业务逻辑
- `apps/api/src/modules/agent/agent.controller.ts` - **P0**: Agent API Controller
- `apps/api/src/modules/agent/dto/` - **P1**: Agent DTO

### Phase 2 关键文件
- `apps/api/src/modules/queue/queue.module.ts` - **P0**: Queue 模块入口
- `apps/api/src/modules/queue/queue.service.ts` - **P0**: Queue 核心逻辑（最关键）
- `apps/api/src/modules/queue/queue.controller.ts` - **P1**: Queue API Controller

### Phase 3-4 关键文件
- `apps/web/src/app/agents/page.tsx` - **P0**: Agent 市场页容器
- `apps/web/src/app/agents/[id]/page.tsx` - **P0**: Agent 详情页容器
- `apps/web/src/components/agent/AgentCard.tsx` - **P0**: Agent 卡片组件
- `apps/web/src/components/agent/AgentFilterPanel.tsx` - **P1**: 筛选面板

### Phase 5 关键文件
- `apps/web/src/components/queue/QueueTaskCard.tsx` - **P0**: 队列任务卡片
- `apps/web/src/components/queue/QueueList.tsx` - **P0**: 队列列表

### 文档文件
- `docs/owner4/PLAN.md` - 本文件
- `docs/owner4/INTERFACE.md` - 接口文档（待创建）

**优先级说明**: P0 = 最高优先级（必须完成），P1 = 高优先级（建议完成），P2 = 中优先级（可延后）

---

## ✅ 最终交付标准

### Phase 1
- [ ] Agent CRUD API 完整可用
- [ ] 权限校验正确
- [ ] 单元测试覆盖率 > 80%

### Phase 2
- [ ] QueueService 核心接口完整
- [ ] consumeNext 原子性测试通过
- [ ] 单元测试覆盖率 > 80%

### Phase 3
- [ ] `/agents` 市场页可访问
- [ ] 筛选、排序、分页功能正常

### Phase 4
- [ ] `/agents/[id]` 详情页可访问
- [ ] A/B 视角区分正确

### Phase 5
- [ ] 队列子组件可被集成
- [ ] 操作功能正常

### Phase 6
- [ ] 与 Matching 模块集成测试通过
- [ ] 接口文档完整

---

## ⚠️ 预估风险点与应对

### 高风险

#### 1. consumeNext 并发问题
- **风险**: 多个请求同时消费导致重复
- **应对**: 使用 `FOR UPDATE SKIP LOCKED` 原子锁
- **验收**: 编写并发测试验证

#### 2. 队列容量竞态
- **风险**: 检查容量和入队之间有并发
- **应对**: 使用数据库事务 + 唯一约束
- **验收**: 并发入队测试

### 中风险

#### 3. Agent 状态计算延迟
- **风险**: 状态计算与实际不一致
- **应对**: 关键操作后立即更新状态
- **备选**: 改为实时计算（性能换正确性）

#### 4. 价格筛选精度问题
- **风险**: string 类型价格比较不正确
- **应对**: 数据库使用 numeric 类型比较
- **验收**: 边界值测试

### 低风险

#### 5. 前端组件复用
- **风险**: 子组件被其他 Owner 错误使用
- **应对**: 完善 Props 类型定义和文档

---

## 📚 参考文档

- [CONTEXT.md](../CONTEXT.md) - 全局约束与 Code Ownership
- [PRD.md](../PRD.md) - 产品需求文档
- [INTERFACE.md](../INTERFACE.md) - Owner #1 公共接口
- [owner1/INTERFACE.md](../owner1/INTERFACE.md) - 队列系统 SQL 参考
- [设计稿](../../assets/stitch_homepage_dashboard/) - UI 设计参考

---

**最后更新**: 2026-01-15
**状态**: 待开始
**完成日期**: 待定
