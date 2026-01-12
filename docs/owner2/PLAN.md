# Owner #2 开发计划（Task 发布 + 支付确认）

> **Owner**: Owner #2  \
> **模块**: A 端发布 + 支付确认（unpaid → published & Standby Order）  \
> **容器**: `apps/web/src/app/page.tsx`, `apps/web/src/app/tasks/create/page.tsx`  \
> **后端模块**: `apps/api/src/modules/task/**`  \
> **更新时间**: 2026-01-09

---

## ✅ Code Ownership 与边界

- **仅修改**: `apps/api/src/modules/task/**`、`apps/web/src/app/page.tsx`、`apps/web/src/app/tasks/create/page.tsx`、`apps/web/src/components/**`
- **禁止修改**: `packages/shared/**`、`packages/config/**`、`infra/supabase/migrations/**`、`apps/contracts/**`、其他 Owner 页面容器
- **跨模块协作**: 只通过 Service 接口调用，不跨模块写表、不直连他人模块

---

## 1) 后端模块（NestJS）与 API（Owner #2 负责）

### 模块：`apps/api/src/modules/task/**`

**职责**：任务发布、支付确认、任务读取视图（首页/任务广场/支付确认轮询）。

#### HTTP API 清单

1) **创建任务（未支付）**
- `POST /tasks`
- 用途：创建 Task，初始 `Task.status = unpaid`
- 输入：title、description、type、tags、attachments、expectedReward
- 输出：taskId、status

2) **支付确认（unpaid → published + Standby Order）**
- `POST /tasks/:id/payments/confirm`
- 用途：校验 payTxHash → 创建 Order（Standby）→ 记录 escrow → 发布 Task
- 输入：payTxHash
- 输出：taskId、orderId、status、confirmations
- 关键要求：`recordEscrow` 失败必须阻断后续流转

3) **任务详情**
- `GET /tasks/:id`
- 用途：任务详情 + 当前订单摘要（用于支付确认轮询、详情页跳转前判断）

4) **任务列表（我的任务 / 任务广场）**
- `GET /tasks?scope=mine|market&status=unpaid|published|archived&currentStatus=...`
- 用途：首页 Tab 数据源
- 规则：`mine` 返回当前用户任务；`market` 仅返回 published 且 Order.status=Standby

#### 模块内 Service 对外接口（供其他模块调用）

- `TaskQueryService.findById(taskId): Task`
- `TaskQueryService.getTaskSummary(taskId): { id, title, type, expectedReward, status, currentStatus }`
- `TaskQueryService.listPublishedStandbyTasks(filters): Task[]`

> 只读接口，禁止其他模块改写 Task 状态或字段。

---

## 2) 前端页面（Owner #2 负责）与对外子组件

### 页面容器（page.tsx）

1) `apps/web/src/app/page.tsx`
- 首页（我的任务 / 任务广场）Tab
- 绑定任务列表 API、展示任务卡片与状态
- 设计稿参考：`assets/stitch_homepage_dashboard/首页_/_任务广场/screen.png`

2) `apps/web/src/app/tasks/create/page.tsx`
- 发布任务表单 + 支付流程
- 支付成功后跳转 `apps/web/src/app/tasks/[id]/page.tsx`（Owner #3）
- 设计稿参考：`assets/stitch_homepage_dashboard/发布任务页/screen.png`

### 需要提供给其他容器 Owner 的子组件（放置于 `apps/web/src/components/**`）

- `TaskCard`：任务卡片（标题、类型、reward、状态）
- `TaskStatusBadge`：Task.status + Order.status 标签
- `PaymentStatusBanner`：支付确认中/成功/失败提示
- `TaskFilters`：任务筛选（Task.status / Order.status）

---

## 3) 对外接口（Core 服务调用 & 暴露给其他模块的 Service）

### 需要调用的 Core 服务（Owner #1）

- `ChainService.verifyPayment`：校验 payTxHash（receipt + confirmations + ERC20 Transfer 四元组）
- `ChainService.recordEscrow`：订单创建成功后必须调用，失败必须阻断发布
- `WalletBindingService.getActiveAddress`：获取 A 的当前支付地址用于 expectedFrom

### 需要暴露给其他模块的 Service 接口

- `TaskQueryService`（只读）
  - 供 Matching / Delivery / Dispute 等模块读取任务与状态摘要

---

## 4) 测试覆盖（每个模块/功能必须覆盖）

### 后端单元测试（`apps/api/src/modules/task/__tests__/*.spec.ts`）

1) 创建任务
- 必填字段校验失败
- expectedReward 小于最小值拒绝
- tags 数量上限校验

2) 支付确认
- payTxHash 无效（receipt.status=0）拒绝
- confirmations < MIN_CONFIRMATIONS 拒绝
- Transfer 四元组不匹配拒绝
- recordEscrow 失败时不更新 Task/Order
- 幂等：同一 txHash 重复确认不重复建单

3) 任务列表
- scope=mine 只返回当前用户任务
- scope=market 只返回 published + Standby

### 后端 E2E（`apps/api/src/modules/task/__tests__/task.e2e.spec.ts`）

- 创建 Task → 状态为 unpaid
- 支付确认成功 → Task=published + Order=Standby
- 重复确认 → Order 不重复创建
- 支付确认失败 → Task 仍为 unpaid
- 任务列表：market 只返回 published + Standby

### 前端测试（建议）

- 组件单测：`TaskCard`/`TaskStatusBadge`/`PaymentStatusBanner` 状态渲染
- 页面流程 E2E：创建任务 → 支付确认 → 回到首页显示在我的任务
- 页面流程 E2E：任务广场列表筛选与空状态展示

---

## 5) 风险与依赖

- **链上校验依赖 Core**：ChainService 必须可用且已配置 MockUSDT/Escrow 地址
- **recordEscrow 严格阻断**：未成功记录 escrow 不允许发布 Task
- **钱包地址来源**：依赖 WalletBindingService 提供支付地址

