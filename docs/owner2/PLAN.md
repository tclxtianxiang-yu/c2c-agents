# Owner #2 开发计划（Task 发布 + 支付确认）

> **Owner**: Owner #2  \
> **模块**: A 端发布 + 支付确认（unpaid → published & Standby Order）  \
> **容器**: `apps/web/src/app/page.tsx`, `apps/web/src/app/tasks/create/page.tsx`  \
> **后端模块**: `apps/api/src/modules/task/**`  \
> **创建日期**: 2026-01-05  \
> **预估工期**: 6-8 天（单人全职）

---

## ✅ Code Ownership 与边界

- **仅修改**: `apps/api/src/modules/task/**`、`apps/web/src/app/page.tsx`、`apps/web/src/app/tasks/create/page.tsx`、`apps/web/src/components/**`
- **禁止修改**: `packages/shared/**`、`packages/config/**`、`infra/supabase/migrations/**`、`apps/contracts/**`、其他 Owner 页面容器
- **跨模块协作**: 通过 Service 接口调用，不直连他人表/模块

---

## 1) 后端模块与 API（Owner #2 负责）

### 模块：`task`

**职责**：任务发布、支付确认、任务读取视图（用于首页/任务广场/支付确认状态）。

#### API 清单（对外 HTTP）

1) **创建任务（未支付）**
- `POST /tasks`
- 用途：创建 `Task.status = unpaid`
- 输入：title, description, type, tags, attachments, expectedReward
- 输出：taskId, status

2) **支付确认（unpaid → published + Standby Order）**
- `POST /tasks/:id/payments/confirm`
- 用途：校验 payTxHash → 创建 Order（Standby）→ 记录 escrow → 发布 Task
- 输入：payTxHash
- 输出：taskId, orderId, status, confirmations

3) **任务详情**
- `GET /tasks/:id`
- 用途：任务详情 + 当前订单信息（用于支付确认轮询、详情页跳转前状态判断）
- 输出：Task + current Order 摘要

4) **任务列表（我的任务 / 任务广场）**
- `GET /tasks?scope=mine|market&status=unpaid|published|archived&currentStatus=...`
- 用途：首页 Tab 数据源
- 规则：
  - `mine` 返回当前用户任务
  - `market` 仅返回 `published` 且当前 Order 为 `Standby`

#### 模块内 Service 对外接口（供其他模块调用）

- `TaskQueryService.findById(taskId): Task`
- `TaskQueryService.getTaskSummary(taskId): { id, title, type, expectedReward, status, currentStatus }`
- `TaskQueryService.listPublishedStandbyTasks(filters): Task[]`

> 仅提供只读接口，禁止其他模块改写 Task 状态或字段。

---

## 2) 前端页面与对外组件

### 页面容器（Owner #2 独占）

1) `apps/web/src/app/page.tsx`
- 首页（我的任务 / 任务广场）Tab
- 绑定任务列表 API，展示任务卡片
- UI 设计稿：[首页](assets/stitch_homepage_dashboard/首页_/_任务广场/screen.png)
- html参考：[首页](assets/stitch_homepage_dashboard/首页_/_任务广场/code.html)

2) `apps/web/src/app/tasks/create/page.tsx`
- 发布任务表单 + 支付流程
- 支付成功后跳转 `tasks/[id]`（Owner #3 容器）
- UI 设计稿：[发布任务页](assets/stitch_homepage_dashboard/发布任务页/screen.png)
- html参考：[发布任务页](assets/stitch_homepage_dashboard/发布任务页/code.html)

### 对外子组件（提供给其他 Owner 容器）

> 路径统一放在 `apps/web/src/components/**`

- `TaskCard`：任务卡片（标题、类型、reward、状态）
- `TaskStatusBadge`：Task.status + Order.status 统一状态标签
- `PaymentStatusBanner`：支付确认中/成功/失败展示
- `TaskFilters`：任务筛选组件（Task.status / Order.status）

---

## 3) 对外接口依赖（需要调用的 Core 服务）

### 需要调用的 Core 服务（Owner #1）

- **ChainService.verifyPayment**
  - 校验 `payTxHash`（receipt + confirmations + ERC20 Transfer 四元组）
- **ChainService.recordEscrow**
  - 订单创建成功后必须调用；失败必须阻断后续流转
- **WalletBindingService.getActiveAddress**（来自核心/账户体系）
  - 获取 A 的当前支付地址，用于校验 expectedFrom

### 对外暴露给其他模块的 Service 接口

- `TaskQueryService`（只读）
  - 提供任务摘要、任务详情给 Matching / Delivery / Dispute 等模块展示

---

## 4) 测试覆盖（每个模块/功能）

### 单元测试（`apps/api/src/modules/task/__tests__/*.spec.ts`）

1) 创建任务
- 必填字段校验失败
- expectedReward 小于最小值（应拒绝）
- tags 数量上限校验

2) 支付确认
- payTxHash 无效（receipt.status=0）→ 拒绝
- confirmations < MIN_CONFIRMATIONS → 拒绝
- Transfer 四元组不匹配 → 拒绝
- recordEscrow 失败 → 不更新 Task/Order
- 幂等：同一 txHash 重复确认不重复建单

3) 任务列表
- scope=mine 只返回当前用户
- scope=market 只返回 published + Standby

### E2E 测试（`apps/api/src/modules/task/__tests__/task.e2e.spec.ts`）

- 创建 Task → 状态为 unpaid
- 支付确认成功 → Task=published + Order=Standby
- 重复确认 → Order 不重复创建
- 支付确认失败 → Task 仍为 unpaid

---

## 5) 交付清单

- `apps/api/src/modules/task/**`
  - 任务创建、支付确认、任务读取与列表接口
  - 对外只读 TaskQueryService
- `apps/web/src/app/page.tsx`
  - 首页任务 Tab 与任务广场
- `apps/web/src/app/tasks/create/page.tsx`
  - 发布任务表单 + 支付流程
- `apps/web/src/components/**`
  - TaskCard / TaskStatusBadge / PaymentStatusBanner / TaskFilters

---

## 6) 风险与前置依赖

- **链上校验依赖 Core**：ChainService 必须可用且已配置 MockUSDT/Escrow 地址
- **recordEscrow 严格阻断**：未成功记录 escrow 不允许创建有效订单
- **钱包地址来源**：需依赖 WalletBindingService 提供支付地址

