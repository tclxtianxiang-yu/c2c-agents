# Owner #5 开发计划（交付 + 验收 + 正常结算）

> **Owner**: Owner #5  \
> **模块**: 交付 + 验收 + AutoAccepted + 正常结算（Delivered → Paid → Completed）  \
> **后端模块**: `apps/api/src/modules/delivery/**`, `apps/api/src/modules/settlement/**`  \
> **页面容器**: `apps/web/src/app/(b)/workbench/**`  \
> **创建日期**: 2026-01-05  \
> **预估工期**: 7-9 天（单人全职）

---

## ✅ Code Ownership 与边界

- **仅修改**: `apps/api/src/modules/delivery/**`, `apps/api/src/modules/settlement/**`, `apps/web/src/app/(b)/workbench/**`, `apps/web/src/components/**`
- **禁止修改**: `packages/shared/**`, `packages/config/**`, `infra/supabase/migrations/**`, `apps/contracts/**`, 其他 Owner 页面容器
- **跨模块协作**: 通过 Service 接口调用，不直连他人模块/表

---

## 1) 后端模块与 API（Owner #5 负责）

### 模块 A：`delivery`

**职责**：交付创建与读取（InProgress → Delivered）。

#### API 清单（对外 HTTP）

1) **提交交付**
- `POST /orders/:id/deliveries`
- 用途：创建 Delivery 并将 Order.status 推进为 Delivered
- 输入：contentText | externalUrl | attachments（至少一项）
- 输出：deliveryId, deliveredAt, orderStatus

2) **读取交付**
- `GET /orders/:id/delivery`
- 用途：提供交付内容与 Delivered 倒计时
- 输出：Delivery + deliveredAt + autoAcceptDeadline

#### 模块内 Service 对外接口（供其他模块调用）

- `DeliveryQueryService.getByOrderId(orderId): Delivery`
- `DeliveryQueryService.getSummary(orderId): { deliveredAt, contentText, externalUrl, attachments }`

> 供 Owner #3 任务详情页展示交付内容和倒计时。

---

### 模块 B：`settlement`

**职责**：人工验收结算与自动验收（Delivered → Paid → Completed）。

#### API 清单（对外 HTTP）

1) **人工验收**
- `POST /orders/:id/accept`
- 用途：A 验收通过后触发 payout
- 输出：paidAt, completedAt, payoutTxHash

2) **自动验收（内部定时任务）**
- `cron/auto-accept`
- 用途：扫描 Delivered 超时订单，执行 AutoAccepted → Paid → Completed

#### 模块内 Service 对外接口（供其他模块调用）

- `SettlementService.triggerAccept(orderId, actorId)`
- `SettlementService.processAutoAccept(orderId)`

> 仅用于内部编排或管理任务，不对外暴露写接口给其他模块。

---

## 2) 前端页面与对外组件

### 页面容器（Owner #5 独占）

- `apps/web/src/app/(b)/workbench/**`
  - B 工作台所有页（拟成单 / 进行中 / 已交付待结果 / 队列 / 历史）
  - 交付入口、交付状态展示

### 对外子组件（提供给其他 Owner 容器）

> 路径统一放在 `apps/web/src/components/**`

- `DeliverySubmitForm`：交付提交表单（文本/链接/附件，至少一项校验）
- `DeliverySummary`：交付内容摘要（任务详情页展示）
- `AutoAcceptCountdown`：自动验收倒计时展示
- `AcceptActionPanel`：A 侧验收入口面板（仅 UI，不含容器路由）

---

## 3) 对外接口依赖（Core 服务与跨模块协作）

### 需要调用的 Core 服务（Owner #1）

- **ChainService.executePayout**
  - 人工验收与自动验收的链上结算
- **WalletBindingService.getActiveAddress**
  - 获取 A/B 的当前地址（creator/provider）
- **状态机与枚举**（`@c2c-agents/shared`）
  - 使用 `assertTransition` 校验合法迁移

### 需要遵守的系统级规则

- **自动验收互斥**：进入 `RefundRequested` / `CancelRequested` / `Disputed` / `AdminArbitrating` 必须跳过
- **幂等**：payout 仅允许写入一次，`payout_tx_hash IS NULL` 才可更新
- **recordEscrow 前置**：若未 recordEscrow，结算必须失败并阻断

### 对外暴露给其他模块的 Service 接口

- `DeliveryQueryService`（只读）
  - 供任务详情页展示交付信息

---

## 4) 测试覆盖（单元 + E2E）

### 单元测试（`apps/api/src/modules/delivery/__tests__/*.spec.ts`）

- 交付内容为空（文本/链接/附件全空）应拒绝
- Order.status 非 InProgress 时拒绝交付
- 并发提交：只创建 1 个 Delivery
- deliveredAt 写入成功且状态变为 Delivered

### 单元测试（`apps/api/src/modules/settlement/__tests__/*.spec.ts`）

- Delivered → Accepted → Paid → Completed 正常路径
- payout 失败时不进入 Paid
- payout 重复调用不重复打款（幂等）
- 进入 RefundRequested/CancelRequested/Disputed/AdminArbitrating 时自动验收跳过

### E2E 测试（`apps/api/src/modules/delivery/__tests__/delivery.e2e.spec.ts`）

- InProgress 提交交付成功 → 状态 Delivered
- 重复提交交付返回已有 Delivery

### E2E 测试（`apps/api/src/modules/settlement/__tests__/settlement.e2e.spec.ts`）

- A 验收成功 → 结算完成 → Completed
- 自动验收触发路径 → Completed
- 争议状态订单不触发自动验收

---

## 5) 交付清单

- `apps/api/src/modules/delivery/**`
  - 交付创建与读取接口
- `apps/api/src/modules/settlement/**`
  - 人工验收、自动验收与结算逻辑
- `apps/web/src/app/(b)/workbench/**`
  - B 工作台容器
- `apps/web/src/components/**`
  - DeliverySubmitForm / DeliverySummary / AutoAcceptCountdown / AcceptActionPanel

---

## 6) 风险与前置依赖

- **链上依赖**：ChainService 必须稳定可用（payout 必须幂等）
- **自动验收**：依赖稳定的 cron 执行与状态互斥规则
- **权限与数据**：交付/验收 API 需要严格校验 A/B 身份与订单归属

