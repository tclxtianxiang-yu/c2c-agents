# Owner #2 对外接口文档

> **目标读者**: 需要读取 Task / Order 视图或与任务发布流程对接的模块 Owner
> **用途**: 任务发布、支付确认、任务查询接口说明
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

Owner #2 负责 `apps/api/src/modules/task/**`：

- 任务发布（Task.status: unpaid → published）
- 支付确认与 Standby Order 创建
- 任务列表与任务详情读取视图（供首页与任务广场）

> 说明：订单执行状态以 Order.status 为准；Task.currentStatus 仅为镜像字段。

---

## 2. HTTP API

### 2.1 创建任务（未支付）

`POST /tasks`

**用途**: 创建 Task，初始状态为 `unpaid`

**请求头**:
- `x-user-id`: 发布者 A 的 `auth.users.id`（开发期占位认证）

**请求体**:

```json
{
  "title": "Build a landing page",
  "description": "Need a simple marketing landing page",
  "type": "website",
  "tags": ["nextjs", "ui"],
  "attachments": ["file-uuid-1"],
  "expectedReward": "1000000"
}
```

**响应示例**:

```json
{
  "id": "task-uuid",
  "status": "unpaid"
}
```

**约束**:
- `expectedReward` 使用最小单位字符串
- `expectedReward` 范围：`MIN_TASK_REWARD` ≤ amount ≤ `MAX_TASK_REWARD`
- 字段校验失败返回 400

---

### 2.2 支付确认（unpaid → published + Standby）

`POST /tasks/:id/payments/confirm`

**用途**: 校验支付交易，创建 Order 并记录 escrow

**请求头**:
- `x-user-id`: 发布者 A 的 `auth.users.id`（开发期占位认证）

**请求体**:

```json
{
  "payTxHash": "0xabc..."
}
```

**响应示例**:

```json
{
  "taskId": "task-uuid",
  "orderId": "order-uuid",
  "status": "published",
  "confirmations": 1
}
```

**关键流程**:
1. 调用 Core `ChainService.verifyPayment`
2. 创建 Order（status = Standby）
3. 调用 `ChainService.recordEscrow`
4. 更新 Task.status = published，并写入 currentOrderId / currentStatus

**失败策略**:
- 校验失败: 不创建 Order，Task 状态保持 unpaid
- recordEscrow 失败: 任务不进入 published

---

### 2.3 任务详情

`GET /tasks/:id`

**用途**: 任务详情 + 当前订单摘要（供支付确认轮询与详情页）

**响应示例**:

```json
{
  "id": "task-uuid",
  "title": "Build a landing page",
  "type": "website",
  "expectedReward": "1000000",
  "status": "published",
  "currentStatus": "Standby",
  "currentOrderId": "order-uuid"
}
```

---

### 2.4 任务列表（我的任务 / 任务广场）

`GET /tasks?scope=mine|market&status=unpaid|published|archived&currentStatus=Standby|Pairing|...&type=website&tags=nextjs,ui&minReward=1000000&maxReward=2000000`

**用途**:
- `scope=mine`: 返回当前用户任务
- `scope=market`: 仅返回 published 且 Order.status=Standby 的任务

**请求头**:
- `x-user-id`: `scope=mine` 必填

**响应示例**:

```json
[
  {
    "id": "task-uuid",
    "title": "Build a landing page",
    "type": "website",
    "expectedReward": "1000000",
    "status": "published",
    "currentStatus": "Standby"
  }
]
```

---

## 3. 对外 Service 接口

> 供其他模块只读访问 Task 数据，禁止跨模块写入 Task 状态。

```typescript
export class TaskQueryService {
  findById(taskId: string): Promise<Task>;

  getTaskSummary(taskId: string): Promise<{
    id: string;
    title: string;
    type: string;
    expectedReward: string;
    status: TaskStatus;
    currentStatus: OrderStatus | null;
  }>;

  listPublishedStandbyTasks(filters?: {
    type?: string;
    tags?: string[];
    minReward?: string;
    maxReward?: string;
  }): Promise<Task[]>;
}
```

---

## 4. Core 依赖与外部调用

### 4.1 Core 服务调用（Owner #1）

- `ChainService.verifyPayment`
- `ChainService.recordEscrow`
- `WalletBindingService.getActiveAddress`（当前实现通过读取 `wallet_bindings` 表获取 A 地址）

### 4.2 共享类型与状态机

- 必须使用 `@c2c-agents/shared` 的 DTO/枚举
- 状态迁移必须使用 `assertTransition`

---

## 5. 幂等与状态机规则

- **支付确认幂等**: 同一 `payTxHash` 不得重复创建 Order
- **recordEscrow 强制**: 未成功记录 escrow 不得发布 Task
- **状态机约束**: Order 状态迁移必须通过 `@c2c-agents/shared/state-machine`

---

## 6. 数据与字段规范

- 金额字段使用 `string`（最小单位）
- 时间戳字段使用 ISO 8601 `string`
- `Task.currentStatus` 为镜像字段，仅用于查询展示，真实执行状态以 `Order.status` 为准

---

## 7. 认证与请求头

- 开发期使用 `x-user-id` 作为占位认证头
- `POST /tasks`、`POST /tasks/:id/payments/confirm`、`GET /tasks?scope=mine` 必填
- 未提供将返回 `VALIDATION_FAILED`

---

## 8. 错误码与失败场景

- `VALIDATION_FAILED`: 字段校验失败、缺少 `x-user-id`
- `PAYMENT_VERIFICATION_FAILED`: 链上校验失败（receipt/confirmations/Transfer 不匹配）
- `BUSINESS_IDEMPOTENCY_VIOLATION`: payTxHash 重复提交或绑定到其他任务
- `BUSINESS_RESOURCE_NOT_FOUND`: taskId 不存在
- `AUTH_FORBIDDEN`: 任务不属于当前用户
