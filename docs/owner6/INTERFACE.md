# Owner #6 接口文档（Dispute + Admin）

> 目标读者: 与退款/争议/管理员仲裁模块对接的 Owner 与 Agent
> 说明: 公共规则以 `docs/INTERFACE.md` 为准，本文件补充 Owner #6 的接口与流程约束
> 最后更新: 2026-01-24

---

## 1. 范围与所有权

**后端模块**:
- `apps/api/src/modules/dispute/**`
- `apps/api/src/modules/admin/**`

**前端容器**:
- `apps/web/src/app/admin/**`

**共享组件**:
- `apps/web/src/components/DisputePanel.tsx`
- `apps/web/src/components/RefundCancelStatusCard.tsx`
- `apps/web/src/components/AdminArbitratingBadge.tsx`

---

## 2. Dispute API

> 所有 DTO/枚举/状态机来自 `@c2c-agents/shared`，状态变更必须 `assertTransition`。

### 2.1 `POST /disputes/refund-request`

**触发**: A 在 Delivered 发起退款  
**状态**: `Delivered -> RefundRequested`

**Request**
```json
{
  "orderId": "string",
  "reason": "string"
}
```

**Response**
```json
{
  "order": "Order",
  "dispute": "Dispute"
}
```

**备注**: 写入 `refundRequestReason`。

### 2.2 `POST /disputes/cancel-request`

**触发**: B 在 InProgress 发起中断  
**状态**: `InProgress -> CancelRequested`

**Request**
```json
{
  "orderId": "string",
  "reason": "string"
}
```

**Response**
```json
{
  "order": "Order",
  "dispute": "Dispute"
}
```

**备注**: 写入 `cancelRequestReason`。

### 2.3 `POST /disputes/respond`

**触发**: 对方同意/拒绝  
**状态**:
- 同意: `RefundRequested/CancelRequested -> Refunded` (后续触发退款/结算)
- 拒绝: 状态保持不变，允许后续平台介入

**Request**
```json
{
  "orderId": "string",
  "action": "accept | reject"
}
```

**Response**
```json
{
  "order": "Order",
  "dispute": "Dispute"
}
```

### 2.4 `POST /disputes/escalate`

**触发**: 任一方在被拒绝后平台介入  
**状态**: `RefundRequested/CancelRequested -> Disputed`

**Request**
```json
{
  "orderId": "string",
  "reason": "string"
}
```

**Response**
```json
{
  "order": "Order",
  "dispute": "Dispute"
}
```

**备注**: 写入 `Dispute.reason`。

### 2.5 `POST /disputes/withdraw`

**触发**: 争议撤回  
**状态**:
- 退款争议: `Disputed -> Delivered`
- 中断争议: `Disputed -> InProgress`

**Request**
```json
{
  "orderId": "string"
}
```

**Response**
```json
{
  "order": "Order",
  "dispute": "Dispute"
}
```

### 2.6 `POST /disputes/admin-assign`

**触发**: 管理员介入  
**状态**: `Disputed -> AdminArbitrating`

**Request**
```json
{
  "orderId": "string",
  "adminId": "string"
}
```

**Response**
```json
{
  "order": "Order",
  "dispute": "Dispute"
}
```

### 2.7 `GET /disputes/:orderId`

**返回**: Dispute + Order 当前状态 + 相关原因字段

**Response**
```json
{
  "order": "Order",
  "dispute": "Dispute"
}
```

---

## 3. Admin API

### 3.1 `POST /admin/login`

**用途**: 简单账号密码登录 (MVP)

**Request**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response**
```json
{
  "admin": {
    "id": "string",
    "name": "string"
  },
  "token": "string"
}
```

### 3.2 `GET /admin/arbitrations`

**用途**: 列出 `AdminArbitrating` 订单

**Response**
```json
{
  "items": [
    {
      "order": "Order",
      "dispute": "Dispute"
    }
  ]
}
```

### 3.3 `GET /admin/arbitrations/:orderId`

**用途**: 详情 (Task/Delivery/原因字段/时间轴)

**Response**
```json
{
  "order": "Order",
  "task": "Task",
  "delivery": "Delivery | null",
  "dispute": "Dispute",
  "timeline": [
    {
      "status": "OrderStatus",
      "at": "ISO8601"
    }
  ]
}
```

### 3.4 `POST /admin/arbitrations/:orderId/refund`

**用途**: 强制退款  
**状态**: `AdminArbitrating -> Refunded -> Completed`

**Request**
```json
{
  "adminId": "string",
  "reason": "string"
}
```

**Response**
```json
{
  "order": "Order",
  "dispute": "Dispute"
}
```

**备注**: 需调用 `ChainService.executeRefund` 幂等。

### 3.5 `POST /admin/arbitrations/:orderId/payout`

**用途**: 强制付款  
**状态**: `AdminArbitrating -> Paid -> Completed`

**Request**
```json
{
  "adminId": "string",
  "reason": "string"
}
```

**Response**
```json
{
  "order": "Order",
  "dispute": "Dispute"
}
```

**备注**: 必须存在 Delivery，需调用 `ChainService.executePayout` 幂等。

---

## 4. 对外 Service 接口

### 4.1 DisputeService

```typescript
createRefundRequest(orderId: string, reason: string, actorId: string)
createCancelRequest(orderId: string, reason: string, actorId: string)
respondRequest(orderId: string, action: 'accept' | 'reject', actorId: string)
escalateDispute(orderId: string, reason: string, actorId: string)
withdrawDispute(orderId: string, actorId: string)
assignAdminArbitration(orderId: string, adminId: string)
getDisputeByOrderId(orderId: string)
```

### 4.2 AdminArbitrationService

```typescript
listArbitrations(filters?: Record<string, unknown>)
getArbitrationDetail(orderId: string)
forceRefund(orderId: string, adminId: string)
forcePayout(orderId: string, adminId: string)
```

---

## 5. 依赖与对接约束

**依赖服务**:
- `ChainService` (Owner #1): `executeRefund`, `executePayout`
- `OrderService` (Owner #1): 读取与更新订单状态 (幂等 + 状态机校验)
- `WalletBindingService` (Owner #1): 获取 A/B active 钱包地址
- `TaskService` (Owner #2): 管理员详情页任务摘要
- `DeliveryService` (Owner #5): 强制付款前置校验

**关键约束**:
- 状态变更必须通过 `assertTransition`
- 不允许跨模块直连表，只能通过 Service 注入调用
- 金额字段均为 `string` (最小单位)
- 退款/付款必须幂等，重复请求不应重复写 `refundTxHash/payoutTxHash`

---

## 6. 典型流程速览

**退款**: refund-request -> respond(accept) -> executeRefund -> Completed  
**中断**: cancel-request -> respond(reject) -> escalate -> admin-assign  
**强制付款**: admin-assign -> payout -> Completed
