# Owner #5 开发计划（交付 + 验收 + 结算）

> **Owner**: Owner #5  
> **职责范围**: 交付（Delivered）+ 验收（Accepted）+ 正常结算（Paid/Completed）+ 自动验收  
> **后端模块**: `apps/api/src/modules/delivery/**`, `apps/api/src/modules/settlement/**`  
> **页面容器**: `apps/web/src/app/(b)/workbench/**`  
> **创建日期**: 2026-01-09

---

## 0) Code Ownership 与边界

- **仅修改**: `apps/api/src/modules/delivery/**`, `apps/api/src/modules/settlement/**`, `apps/web/src/app/(b)/workbench/**`, `apps/web/src/components/**`
- **禁止修改**: `packages/shared/**`, `packages/config/**`, `infra/supabase/migrations/**`, `apps/contracts/**`, 其他 Owner 页面容器
- **跨模块协作**: 只通过 Service 或公开 API 调用，不跨模块直接写表

---

## 1) 后端模块与 API（Owner #5 负责）

### 模块：delivery

**职责**: InProgress 阶段交付内容提交与读取（Delivered）。

**HTTP API**
1. `POST /orders/:id/deliveries`
   - 用途：提交交付内容，推动 Order.status: InProgress → Delivered
   - 入参：contentText | externalUrl | attachments（至少一项）
   - 出参：deliveryId, deliveredAt, orderStatus
2. `GET /orders/:id/delivery`
   - 用途：获取交付详情 + 自动验收截止时间
   - 出参：Delivery + deliveredAt + autoAcceptDeadline

**对外 Service（只读）**
- `DeliveryQueryService.getByOrderId(orderId): Delivery`
- `DeliveryQueryService.getSummary(orderId): { deliveredAt, contentText, externalUrl, attachments }`

---

### 模块：settlement

**职责**: A 侧验收与自动验收，驱动链上结算（Paid/Completed）。

**HTTP API**
1. `POST /orders/:id/accept`
   - 用途：A 侧验收，触发 payout 并更新 Order.status
   - 出参：paidAt, completedAt, payoutTxHash

**内部任务**
- 自动验收任务：扫描 Delivered 超时订单，执行 AutoAccepted → Paid → Completed

**对外 Service（内部编排使用）**
- `SettlementService.triggerAccept(orderId, actorId)`
- `SettlementService.processAutoAccept(orderId)`

---

## 2) 前端页面与对外组件

### 页面容器（Owner #5 独占）

- `apps/web/src/app/(b)/workbench/**`
  - B 工作台页容器：进行中、待交付、已交付、历史等
  - 交付入口与状态展示

### 对外子组件（供其他容器 Owner 使用）

- `DeliverySubmitForm`
  - 交付提交表单（文本/链接/附件，至少一项校验）
- `DeliverySummary`
  - 交付内容摘要展示（任务详情页使用）
- `AutoAcceptCountdown`
  - 自动验收倒计时（Delivered 阶段）
- `AcceptActionPanel`
  - A 侧验收按钮面板（任务详情页使用）

---

## 3) 对外接口依赖与暴露

### 需要调用的 Core 服务（Owner #1）

- `ChainService.executePayout`
  - 人工验收与自动验收结算
- `WalletBindingService.getActiveAddress`
  - 获取 A/B 地址（creator/provider）
- `assertTransition` / `OrderStatus` / `TaskStatus`
  - 来自 `@c2c-agents/shared` 的状态机校验与枚举

### 需要暴露给其他模块的接口

- `DeliveryQueryService`
  - 任务详情页展示交付内容与截止时间

---

## 4) 测试覆盖（单元 + E2E）

### delivery 模块

**单元测试**
- 交付内容全空（text/url/attachments）→ 400
- Order.status 非 InProgress → 400
- 并发提交交付 → 只创建 1 条 Delivery
- Delivered 后写入 deliveredAt 且状态一致

**E2E**
- InProgress 提交交付成功 → Order.status = Delivered
- 重复提交交付返回已存在 Delivery
- GET /orders/:id/delivery 返回交付内容与自动验收截止时间

### settlement 模块

**单元测试**
- Delivered → Accepted → Paid → Completed 正常路径
- payout 失败不进入 Paid/Completed
- 幂等：payout_tx_hash 已存在时不重复打款
- RefundRequested/CancelRequested/Disputed/AdminArbitrating 跳过自动验收

**E2E**
- A 验收成功 → Completed
- 自动验收触发 → Completed
- 争议状态订单不会进入自动验收

---

## 5) 依赖与风险

- `recordEscrow` 已完成且有效是 payout 前置条件
- 链上失败必须阻断状态推进（不可误更新）
- 自动验收与争议分支互斥，需严格判断当前 OrderStatus
- 所有状态流转必须通过 `@c2c-agents/shared` 的状态机校验
