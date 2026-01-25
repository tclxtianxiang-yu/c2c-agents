# PLAN.md — Owner #6 开发计划（Dispute + Admin）

> 目标：覆盖争议/退款/中断与管理员仲裁全流程，严格遵守 Code Ownership 与 shared 规则。
> 范围：仅 Owner #6 模块与页面容器（`apps/api/src/modules/dispute/**`、`apps/api/src/modules/admin/**`、`apps/web/src/app/admin/**`）

---

## 1) 后端模块（NestJS）

### 1.1 负责模块

- `apps/api/src/modules/dispute/**`（退款/中断/争议）
- `apps/api/src/modules/admin/**`（管理员仲裁）

### 1.2 API 接口清单（建议路由）

> 所有 DTO/枚举/状态机来自 `@c2c-agents/shared`，状态变更必须 `assertTransition`。

#### Dispute 模块

- `POST /disputes/refund-request`
  - 触发：A 在 Delivered 发起退款
  - 结果：`Delivered → RefundRequested`，写入 `refundRequestReason`
- `POST /disputes/cancel-request`
  - 触发：B 在 InProgress 发起中断
  - 结果：`InProgress → CancelRequested`，写入 `cancelRequestReason`
- `POST /disputes/respond`
  - 触发：对方同意/拒绝
  - 结果：
    - 同意：`RefundRequested/CancelRequested → Refunded`（随后结算/退款完成）  
    - 拒绝：保持原状态，允许“平台介入”
- `POST /disputes/escalate`
  - 触发：任一方在被拒绝后平台介入
  - 结果：`RefundRequested/CancelRequested → Disputed`，写入 `Dispute.reason`
- `POST /disputes/withdraw`
  - 触发：争议撤回
  - 结果：`Disputed → Delivered` 或 `Disputed → InProgress`（按争议类型回退）
- `POST /disputes/admin-assign`
  - 触发：管理员介入
  - 结果：`Disputed → AdminArbitrating`
- `GET /disputes/:orderId`
  - 返回：Dispute + Order 当前状态 + 相关原因字段

#### Admin 模块

- `POST /admin/login`
  - 简单账号密码登录（MVP）
- `GET /admin/arbitrations`
  - 列出 `AdminArbitrating` 订单
- `GET /admin/arbitrations/:orderId`
  - 详情：Task、Delivery、原因字段、时间轴
- `POST /admin/arbitrations/:orderId/refund`
  - 强制退款：`AdminArbitrating → Refunded → Completed`
  - 需调用 ChainService `executeRefund` 幂等
- `POST /admin/arbitrations/:orderId/payout`
  - 强制付款：`AdminArbitrating → Paid → Completed`
  - 前置：必须存在 Delivery
  - 需调用 ChainService `executePayout` 幂等

---

## 2) 前端页面（Owner #6 容器）+ 子组件输出

### 2.1 管理员后台容器（page.tsx）

归属目录：`apps/web/src/app/admin/**`

- `apps/web/src/app/admin/page.tsx`
  - Admin 登录页 + 登录后重定向
- `apps/web/src/app/admin/arbitrations/page.tsx`
  - 争议订单列表（AdminArbitrating）
- `apps/web/src/app/admin/arbitrations/[id]/page.tsx`
  - 争议详情页：任务信息/交付内容/原因字段/强制操作

### 2.2 需要提供给其他容器 Owner 的子组件

放置目录：`apps/web/src/components/**`（避免触碰他人容器页）

- `DisputePanel.tsx`
  - 用途：任务详情页（Owner #3 容器）中展示退款/中断/争议操作入口
  - Props：`order`, `role`, `onRefundRequest`, `onCancelRequest`, `onEscalate`, `onWithdraw`
- `RefundCancelStatusCard.tsx`
  - 用途：任务详情页（Owner #3）显示退款/中断理由与当前状态
  - Props：`order`, `dispute`
- `AdminArbitratingBadge.tsx`
  - 用途：任务详情页（Owner #3）显示“管理员仲裁中”状态提示
  - Props：`orderStatus`

---

## 3) 对外接口（Core 服务调用 + 对外暴露 Service）

### 3.1 需要调用的 Core 服务

> 仅通过 Service 注入调用，禁止直接跨表 JOIN。

- `ChainService`（Owner #1 / core）
  - `executeRefund`：退款、强制退款
  - `executePayout`：管理员强制付款
- `OrderService`（Owner #1 / core）
  - 读取与更新订单状态（幂等 + 状态机校验）
- `WalletBindingService`（Owner #1 / core）
  - 获取 A/B 的 active 钱包地址（退款/结算）
- `TaskService`（Owner #2 / task）
  - 查询任务摘要（管理员详情页展示）
- `DeliveryService`（Owner #5 / delivery）
  - 检查是否存在 Delivery（强制付款前置条件）

### 3.2 需要暴露给其他模块的 Service 接口

> 供其他模块通过 Module import 调用，避免直连表。

- `DisputeService`（apps/api/src/modules/dispute/dispute.service.ts）
  - `createRefundRequest(orderId, reason, actorId)`
  - `createCancelRequest(orderId, reason, actorId)`
  - `respondRequest(orderId, action, actorId)`  // accept/reject
  - `escalateDispute(orderId, reason, actorId)`
  - `withdrawDispute(orderId, actorId)`
  - `assignAdminArbitration(orderId, adminId)`
  - `getDisputeByOrderId(orderId)`

- `AdminArbitrationService`（apps/api/src/modules/admin/admin.service.ts）
  - `listArbitrations(filters)`
  - `getArbitrationDetail(orderId)`
  - `forceRefund(orderId, adminId)`
  - `forcePayout(orderId, adminId)`

---

## 4) 测试覆盖（每模块必备）

> 单元测试：`apps/api/src/modules/{module}/__tests__/*.service.spec.ts`  
> E2E 测试：`apps/api/src/modules/{module}/__tests__/*.e2e.spec.ts`

### 4.1 Dispute 模块测试场景

**单元测试**

- `RefundRequested` 仅允许从 `Delivered` 触发，非法状态拒绝
- `CancelRequested` 仅允许从 `InProgress` 触发，非法状态拒绝
- `respondRequest(accept)`：正确转 `Refunded` 并校验幂等
- `respondRequest(reject)`：不改变状态，允许后续 `escalate`
- `escalate`：仅在被拒绝后可进入 `Disputed`
- `withdraw`：退款争议回 `Delivered`；中断争议回 `InProgress`
- 进入 `RefundRequested/CancelRequested/Disputed/AdminArbitrating` 后自动验收路径关闭（验证状态机限制）
- 幂等：重复提交同一操作不会重复写 `refundTxHash/payoutTxHash`

**E2E 测试**

- 退款流程完整链路：refund-request → accept → executeRefund → Completed
- 中断流程完整链路：cancel-request → reject → dispute → withdraw
- 争议升级链路：reject → dispute → admin-assign
- 并发场景：同一订单同时 accept/reject，最终状态唯一

### 4.2 Admin 模块测试场景

**单元测试**

- 列表仅返回 `AdminArbitrating` 订单
- 强制退款：调用 `ChainService.executeRefund`，幂等更新 `refundTxHash`
- 强制付款：无 Delivery 时拒绝；有 Delivery 时调用 `executePayout`
- 强制付款后状态：`Paid → Completed`

**E2E 测试**

- 管理员强制退款全流程：`AdminArbitrating → Refunded → Completed`
- 管理员强制付款全流程：`AdminArbitrating → Paid → Completed`
- 详情页返回 Task/Delivery/原因字段完整性

---

## 5) Code Ownership 执行清单（强制）

- 不修改 `packages/shared/**`、`packages/config/**`、`infra/supabase/migrations/**`、`apps/contracts/**`
- 不修改他人容器页：仅改 `apps/web/src/app/admin/**`
- 所有 DTO/枚举/状态机只从 `@c2c-agents/shared` 导入
- 跨模块数据访问必须通过 Service 接口

---

## 6) 关键依赖与阻塞项

- 依赖 Owner #1 提供/确认 `OrderService`、`WalletBindingService` 的 Service 接口可注入
- 依赖 Owner #5 提供 `DeliveryService` 用于强制付款前置校验
- 若需新增字段（如 Dispute 类型/来源标记），必须提交给 Owner #1 走迁移流程

