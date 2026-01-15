# Owner #5 对外接口文档

> **目标读者**: 需要对接交付/验收/结算能力的模块 Owner
> **用途**: 交付提交、交付读取、验收与自动验收接口说明
> **最后更新**: 2026-01-09

---

## 📋 目录

- [1. 模块职责](#1-模块职责)
- [2. HTTP API](#2-http-api)
- [3. 对外 Service 接口](#3-对外-service-接口)
- [4. Core 依赖与外部调用](#4-core-依赖与外部调用)
- [5. 幂等与状态机规则](#5-幂等与状态机规则)
- [6. 数据与字段规范](#6-数据与字段规范)
- [7. 认证与请求头](#7-认证与请求头)
- [8. 错误码与失败场景](#8-错误码与失败场景)

---

## 1. 模块职责

Owner #5 负责：

- `apps/api/src/modules/delivery/**`：交付提交与交付读取（InProgress → Delivered）
- `apps/api/src/modules/settlement/**`：A 侧验收与自动验收（Delivered → Paid → Completed）
- `apps/web/src/app/(b)/workbench/**`：B 工作台页面容器
- `apps/web/src/components/**`：交付/验收相关可复用子组件

> 说明：订单执行状态以 `Order.status` 为准，状态迁移必须通过 `@c2c-agents/shared` 状态机校验。

---

## 2. HTTP API

### 2.1 提交交付（InProgress → Delivered）

`POST /orders/:id/deliveries`

**用途**: B 提交交付内容，推动订单进入 Delivered

**请求头**:
- `x-user-id`: B 侧用户 `auth.users.id`（开发期占位认证）

**请求体**:

```json
{
  "contentText": "Delivery notes...",
  "externalUrl": "https://example.com/result",
  "attachments": ["file-uuid-1"]
}
```

**约束**:
- `contentText` / `externalUrl` / `attachments` 至少一项不为空
- `Order.status` 必须为 `InProgress`

**响应示例**:

```json
{
  "deliveryId": "delivery-uuid",
  "deliveredAt": "2026-01-09T12:00:00.000Z",
  "orderStatus": "Delivered"
}
```

---

### 2.2 获取交付详情

`GET /orders/:id/delivery`

**用途**: 获取交付内容与自动验收截止时间

**请求头**:
- `x-user-id`: A/B 侧用户 `auth.users.id`（开发期占位认证）

**响应示例**:

```json
{
  "orderId": "order-uuid",
  "deliveredAt": "2026-01-09T12:00:00.000Z",
  "autoAcceptDeadline": "2026-01-12T12:00:00.000Z",
  "contentText": "Delivery notes...",
  "externalUrl": "https://example.com/result",
  "attachments": ["file-uuid-1"]
}
```

---

### 2.3 A 侧验收（结算）

`POST /orders/:id/accept`

**用途**: A 侧验收交付，触发链上 payout，驱动 Paid → Completed

**请求头**:
- `x-user-id`: A 侧用户 `auth.users.id`（开发期占位认证）

**响应示例**:

```json
{
  "orderId": "order-uuid",
  "paidAt": "2026-01-09T12:10:00.000Z",
  "completedAt": "2026-01-09T12:10:00.000Z",
  "payoutTxHash": "0xabc..."
}
```

**关键流程**:
1. 校验订单状态可从 Delivered 进入 Paid/Completed
2. 调用 Core `ChainService.executePayout`
3. 更新 Order.status 与 `paidAt`/`completedAt`

---

## 3. 对外 Service 接口

> 供其他模块只读访问交付信息或触发验收流程，禁止跨模块直接写表。

```typescript
export class DeliveryQueryService {
  getByOrderId(orderId: string): Promise<Delivery>;

  getSummary(orderId: string): Promise<{
    deliveredAt: string | null;
    contentText: string | null;
    externalUrl: string | null;
    attachments: string[] | null;
  }>;
}

export class SettlementService {
  triggerAccept(orderId: string, actorId: string): Promise<{
    payoutTxHash: string;
    paidAt: string;
    completedAt: string;
  }>;
}
```

---

## 4. Core 依赖与外部调用

### 4.1 Core 服务调用（Owner #1）

- `ChainService.executePayout`
- `WalletBindingService.getActiveAddress`
- `assertTransition` / `OrderStatus`（来自 `@c2c-agents/shared`）

### 4.2 共享类型与状态机

必须使用 `@c2c-agents/shared` 中的 DTO/枚举，禁止在模块内重定义。

---

## 5. 幂等与状态机规则

- **交付幂等**: 同一订单只允许存在 1 条 Delivery；重复提交返回已有记录。
- **验收幂等**: 若 `payoutTxHash` 已存在，不允许重复打款。
- **自动验收互斥**: 订单进入 `RefundRequested` / `CancelRequested` / `Disputed` / `AdminArbitrating` 时跳过自动验收。
- **状态机校验**: 所有状态迁移必须调用 `assertTransition`。

---

## 6. 数据与字段规范

- 金额字段使用最小单位 `string`（如 `grossAmount` / `feeAmount` / `netAmount`）。
- 时间戳使用 ISO 8601 `string`。
- `attachments` 存储文件 UUID 数组（具体文件服务由上传模块负责）。

---

## 7. 认证与请求头

- 开发期使用 `x-user-id` 作为身份标识。
- A/B 角色校验由 API 内部根据订单关联关系判断。

---

## 8. 错误码与失败场景

- `400 BadRequest`: 交付内容为空 / 状态不可达 / 自动验收互斥
- `401 Unauthorized`: 缺少 `x-user-id`
- `403 Forbidden`: 非订单相关方尝试交付/验收
- `409 Conflict`: 幂等冲突（重复交付/重复验收）
- `502 BadGateway`: 链上 payout 失败（必须阻断状态推进）

