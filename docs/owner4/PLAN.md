# Owner #4 Agent + Queue 模块开发计划

> **Owner**: Owner #4
> **模块**: Module D（Agent 管理 + 队列系统）
> **职责**: apps/api/src/modules/agent + apps/api/src/modules/queue + apps/web/src/components/**（Agent 市场/详情与队列子组件）
> **创建日期**: 2026-01-05
> **预估工期**: 7-10 天（单人全职）

---

## 📋 总览

### 核心职责（来自 CONTEXT.md / DEVIDE_THE_WORK.md）

- Agent 资产管理：创建/编辑/查询（面向 B）、市场检索/筛选展示（面向 A）
- 队列核心能力：enqueue / cancel / consume-next（FIFO）
- 队列 P0 约束：去重（queued 唯一）、队列上限 N、consume-next 原子性
- 对外服务抽象：向 Matching 模块提供 QueueService（Matching 不触碰队列表）
- 队列相关 UI 输出：Agent 市场/详情页、B 工作台队列 Tab 子组件（容器不归我）

### 修改权限边界（严格遵守）

- ✅ 允许：
  - `apps/api/src/modules/agent/**`
  - `apps/api/src/modules/queue/**`
  - `apps/web/src/components/**`
- ❌ 禁止：
  - `packages/shared/**` / `packages/config/**` / `infra/supabase/migrations/**`
  - `apps/contracts/**`
  - `apps/web/src/app/**/page.tsx`（容器页）

---

## 🎯 项目现状分析

### ✅ 已具备的依赖

- `@c2c-agents/shared` 提供 DTO/枚举/状态机/错误类
- `@c2c-agents/config` 提供 `QUEUE_MAX_N` 等常量
- Owner #1 Core 模块将提供：SupabaseService、ChainService、全局错误映射

### 🟡 待完成

- Agent 模块 API（CRUD + 列表/筛选/详情）
- Queue 模块 API（enqueue/cancel/consume-next + 队列查询）
- Agent 市场/详情页组件与队列展示组件（供容器集成）
- QueueService 与 Matching 模块对接契约
- 单元测试与 e2e 测试（队列原子性、幂等与上限约束）

---

## 📦 Phase 1: Agent 模块后端（2-3 天）

### 目标

完成 Agent 管理 API 与数据库交互，支持 B 创建/编辑 Agent，支持 A 侧市场检索/筛选。

### Task 1.1: Agent CRUD 与查询接口

**交付物**: `apps/api/src/modules/agent/*`

**具体任务**:

1. 创建 AgentModule/Controller/Service/DTO：
   - `POST /agents`：创建 Agent
   - `PUT /agents/:id`：编辑 Agent（仅 owner）
   - `GET /agents/:id`：Agent 详情
   - `GET /agents`：Agent 列表（支持过滤、排序、分页）
2. DTO 仅使用 `@c2c-agents/shared` 的 Agent 类型与枚举
3. 查询支持 PRD 字段：tags、taskType、价格区间、状态（Idle/Busy/Queueing）

**关键决策**:

- 金额字段使用 `string`
- 不新增 schema 字段，如需字段变更走 Owner #1 变更提案

**验收标准**:

- [ ] CRUD 接口可用，错误处理一致
- [ ] 列表筛选/排序正确，返回字段完整
- [ ] `pnpm lint --filter @c2c-agents/api` 通过

### Task 1.2: Agent 状态与队列信息聚合

**交付物**: `apps/api/src/modules/agent/agent.service.ts`

**具体任务**:

1. Agent 状态计算逻辑：
   - InProgress 存在 → Busy
   - Busy 且队列非空 → Queueing
   - 无 InProgress 且队列空 → Idle
2. 列表与详情接口返回 queueSize 与 status（按 PRD 字段）

**验收标准**:

- [ ] Agent.status 与 queueSize 计算正确
- [ ] 队列长度与 QUEUE_MAX_N 对齐

---

## 📦 Phase 2: Queue 模块后端（2-3 天）

### 目标

实现队列核心能力与并发一致性，提供可复用 QueueService 给 Matching 模块调用。

### Task 2.1: 队列核心 API

**交付物**: `apps/api/src/modules/queue/*`

**具体任务**:

1. QueueService 公开方法：
   - `enqueue(agentId, taskId, orderId)`
   - `cancel(agentId, orderId)`
   - `consumeNext(agentId)`
   - `getQueueItems(agentId)`（按 createdAt 排序）
   - `getQueuePosition(agentId, orderId)`
2. 对外 Controller（仅供内部/模块调用，避免暴露过多）

**并发与幂等约束**:

- 去重：同一 `agentId + orderId` 仅允许一个 `queued`
- 上限：enqueue 前检查队列长度 < `QUEUE_MAX_N`
- 原子性：consume-next 使用单 SQL + `FOR UPDATE SKIP LOCKED`
- cancel 幂等：重复 cancel 不抛错

**验收标准**:

- [ ] enqueue 去重与上限生效
- [ ] consume-next 原子性通过并发测试
- [ ] cancel 幂等

### Task 2.2: 与 Matching 模块接口契约

**交付物**: `apps/api/src/modules/queue/queue.service.ts`（公开方法文档）

**具体任务**:

1. 定义 Matching 模块可调用方法签名与返回值
2. 明确异常场景：QueueFull / QueueItemNotFound / DuplicateOperation
3. 记录示例调用与典型返回结构

**验收标准**:

- [ ] Matching 调用无需触碰队列表
- [ ] 异常与错误码一致（对齐 shared 错误类）

---

## 📦 Phase 3: 前端组件交付（1-2 天）

### 目标

交付 Agent 市场与详情组件，以及 B 工作台队列 Tab 子组件（不触碰容器页）。

### Task 3.1: Agent 市场/详情组件

**交付物**: `apps/web/src/components/agent/*`

**具体任务**:

1. 市场列表卡片组件（AgentCard）：
   - 名称、评分、完成单量、价格区间、状态与队列信息
   - “选择此 Agent”按钮及置灰原因提示
2. Agent 详情组件（AgentProfile）：
   - 详情字段、评价摘要、选择/编辑入口（仅组件）

**验收标准**:

- [ ] 组件可复用，props 类型来自 shared
- [ ] 在移动端与桌面端展示正常

### Task 3.2: 队列子组件（B 工作台）

**交付物**: `apps/web/src/components/queue/*`

**具体任务**:

1. 队列列表组件（按 Agent 分组，按 createdAt 排序）
2. 只读展示队列序号与任务摘要

**验收标准**:

- [ ] 不触碰 `apps/web/src/app/(b)/workbench/**`
- [ ] 组件可由容器 Owner 直接引用

---

## 📦 Phase 4: 测试与验收（1-2 天）

### 目标

补齐队列幂等与并发测试，确保核心约束不被破坏。

### Task 4.1: Queue 单元测试

**交付物**: `apps/api/src/modules/queue/__tests__/*`

**覆盖场景**:

- enqueue 去重
- 队列上限 `QUEUE_MAX_N`
- consume-next 原子性（并发）
- cancel 幂等

### Task 4.2: Agent/Queue E2E

**交付物**: `apps/api/src/modules/agent/__tests__/*` + `apps/api/src/modules/queue/__tests__/*`

**覆盖场景**:

- Agent 创建 → 列表/详情可见
- enqueue → queueSize 更新 → consume-next FIFO

**验收标准**:

- [ ] 核心测试通过
- [ ] 主流程覆盖（happy path）

---

## 🔄 依赖与协作

- **Owner #1**: 提供 SupabaseService 与共享错误码，必要时添加字段/索引
- **Owner #3**: Matching 模块调用 QueueService；Queue 行为的接口契约需要对齐
- **Owner #5**: B 工作台容器引用队列子组件

---

## ✅ 最终交付标准

- [ ] Agent 模块 API 可用（CRUD + 列表/筛选/详情）
- [ ] Queue 模块满足去重、上限、原子消费约束
- [ ] QueueService 可被 Matching 模块调用
- [ ] Agent 市场/详情与队列子组件交付完毕
- [ ] 核心测试覆盖并通过

---

## 📚 参考文档

- `docs/CONTEXT.md`
- `docs/DEVIDE_THE_WORK.md`
- `docs/PRD.md`
- `docs/INTERFACE.md`

---

**最后更新**: 2026-01-05
**状态**: 待开始执行
**预计完成**: 2026-01-15 (假设全职投入)
