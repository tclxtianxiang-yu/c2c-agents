# Owner #1 公共接口文档

> **目标读者**: 所有 Owner (2-6) 和 AI Agent
> **用途**: 与 Owner #1 管理的核心模块对接时的必读文档
> **补充说明**: 深度集成细节见 `docs/owner1/INTERFACE.md`
> **最后更新**: 2026-01-09

---

## 📋 目录

- [1. 核心职责说明](#1-核心职责说明)
- [2. 类型系统使用指南](#2-类型系统使用指南)
- [3. 状态机使用指南](#3-状态机使用指南)
- [4. 工具函数使用指南](#4-工具函数使用指南)
- [5. 错误处理规范](#5-错误处理规范)
- [6. 配置常量使用](#6-配置常量使用)
- [7. 合约对接速览](#7-合约对接速览)
- [8. 数据库交互规范](#8-数据库交互规范)

---

## 1. 核心职责说明

### Owner #1 管理的模块

```
packages/shared/**          - 核心 DTO/枚举/状态机/错误类型
packages/config/**          - 配置常量与环境变量校验
infra/supabase/migrations/** - 数据库迁移 SQL
apps/contracts/**           - 智能合约 + ABI + typechain
apps/api/src/modules/core/** - 链上网关/共享服务
```

### ⚠️ 重要约束

1. **只读模块**: 其他 Owner **禁止直接修改** 以上目录
2. **变更流程**: 如需修改 → 提交 Issue 或 PR → Owner #1 审核并合并
3. **导入规则**: 所有类型、枚举、状态机**必须**从 `@c2c-agents/shared` 导入

---

## 2. 类型系统使用指南

### 2.1 可用的核心 DTO

从 `@c2c-agents/shared` 导入以下类型:

```typescript
import {
  // 核心业务 DTO
  Task,
  Order,
  Agent,
  QueueItem,
  Delivery,
  Dispute,
  WalletBinding,
  AgentToken,
  CreateAgentTokenResponse,

  // 枚举类型
  OrderStatus,
  AgentStatus,
  TaskStatus,
  QueueItemStatus,
  AgentTokenStatus,
} from '@c2c-agents/shared';
```

### 2.2 DTO 使用示例

#### ✅ 正确用法

```typescript
import { Order, OrderStatus } from '@c2c-agents/shared';

// 在 Service 中使用
async findOrderById(orderId: string): Promise<Order> {
  const order = await this.db.query<Order>(`
    SELECT * FROM orders WHERE id = $1
  `, [orderId]);

  return order;
}

// 在 Controller 中返回
@Get(':id')
async getOrder(@Param('id') id: string): Promise<Order> {
  return this.orderService.findById(id);
}
```

#### ❌ 禁止用法

```typescript
// ❌ 禁止: 自定义 Order 类型
interface Order {
  id: string;
  status: string; // 错误!应该使用 OrderStatus 枚举
  // ...
}

// ❌ 禁止: 复制粘贴枚举定义
enum OrderStatus {
  Standby = 'Standby',
  Pairing = 'Pairing',
  // ...
}
```

### 2.3 金额字段类型规范

**重要**: 所有金额字段使用 `string` 类型（避免精度丢失）

```typescript
import { Order } from '@c2c-agents/shared';
import { toMinUnit, fromMinUnit, calculateFee } from '@c2c-agents/shared/utils';

// ✅ 正确: 金额字段是 string
const order: Order = {
  rewardAmount: '1000000',      // 1 USDT (6 decimals)
  escrowAmount: '1150000',       // 1.15 USDT
  platformFeeAmount: '150000',   // 0.15 USDT
  // ...
};

// ✅ 使用工具函数转换
const displayAmount = fromMinUnit(order.rewardAmount, 6); // '1.000000'
const minUnitAmount = toMinUnit('1.5', 6); // '1500000'

// ✅ 计算手续费（注意：feeRate 现为 number 类型）
const { feeAmount, netAmount } = calculateFee('1000000', 0.15);
// feeAmount: '150000', netAmount: '850000'
```

### 2.4 Agent Token 类型规范

Agent Token 用于 Mastra Agent 调用鉴权:

```typescript
import { AgentToken, AgentTokenStatus, CreateAgentTokenResponse } from '@c2c-agents/shared';

// Token 状态枚举
// AgentTokenStatus.Active   - 可用
// AgentTokenStatus.Revoked  - 已吊销
// AgentTokenStatus.Expired  - 已过期

// Token DTO
const token: AgentToken = {
  id: 'uuid',
  agentId: 'agent-uuid',
  name: 'Production Token',
  tokenPrefix: 'cagt_abcdef12345',  // 前 17 字符用于 UI 展示
  status: AgentTokenStatus.Active,
  expiresAt: '2027-01-01T00:00:00.000Z',  // 可为 null
  lastUsedAt: null,
  createdAt: '2026-01-24T12:00:00.000Z',
  revokedAt: null,
};

// 创建 Token 响应（rawToken 只在创建时返回一次）
const response: CreateAgentTokenResponse = {
  token,
  rawToken: 'cagt_abcdef123456789012345678901234567890123',  // 48 字符
};
```

**Token 格式规范**:

```
cagt_<43-char-base64url>
^^^^  ^^^^^^^^^^^^^^^^^^^^
前缀   32 bytes 随机数 (base64url 编码)

总长度: 48 字符
显示前缀: 17 字符 (cagt_abcdef12345)
```

### 2.5 时间戳字段规范

所有时间戳字段使用 `string` (ISO 8601 格式):

```typescript
const order: Order = {
  createdAt: '2026-01-05T12:00:00.000Z',
  updatedAt: '2026-01-05T12:30:00.000Z',
  deliveredAt: null, // 可为 null
  // ...
};

// 转换为 Date 对象
const date = new Date(order.createdAt);
```

---

## 3. 状态机使用指南

### 3.1 订单状态机 API

从 `@c2c-agents/shared/state-machine` 导入状态机函数:

```typescript
import {
  assertTransition,
  canTransition,
  getAllowedTransitions,
} from '@c2c-agents/shared/state-machine';
import { OrderStatus } from '@c2c-agents/shared';
```

### 3.2 状态转移验证

#### 使用 `assertTransition` (抛错模式)

```typescript
import { assertTransition } from '@c2c-agents/shared/state-machine';
import { InvalidTransitionError } from '@c2c-agents/shared/errors';

async updateOrderStatus(orderId: string, newStatus: OrderStatus) {
  const order = await this.findById(orderId);

  try {
    // 验证状态转移是否合法 (不合法会抛 InvalidTransitionError)
    assertTransition(order.status, newStatus);

    // 合法则执行更新
    await this.db.query(
      `UPDATE orders SET status = $1 WHERE id = $2`,
      [newStatus, orderId]
    );
  } catch (error) {
    if (error instanceof InvalidTransitionError) {
      throw new BadRequestException(error.message);
    }
    throw error;
  }
}
```

#### 使用 `canTransition` (布尔模式)

```typescript
import { canTransition } from '@c2c-agents/shared/state-machine';

async canAcceptOrder(orderId: string): Promise<boolean> {
  const order = await this.findById(orderId);

  // 检查是否可以转移到 InProgress
  return canTransition(order.status, OrderStatus.InProgress);
}
```

#### 使用 `getAllowedTransitions` (获取可选项)

```typescript
import { getAllowedTransitions } from '@c2c-agents/shared/state-machine';

async getAvailableActions(orderId: string) {
  const order = await this.findById(orderId);

  // 获取当前状态允许的所有目标状态
  const allowedStatuses = getAllowedTransitions(order.status);

  return {
    currentStatus: order.status,
    allowedActions: allowedStatuses,
  };
}
```

### 3.3 完整状态转移图

```
Standby (初始)
  ↓
Pairing (配对中)
  ↓
InProgress (进行中)
  ↓
Delivered (已交付)
  ↓
Accepted (已验收)
  ↓
Paid (已结算)
  ↓
Completed (完成) ← 唯一终态

# 分支与回流
Pairing → Standby
InProgress → CancelRequested (请求取消)
Delivered → AutoAccepted (自动验收)
Delivered → RefundRequested (请求退款)
Accepted → Paid
AutoAccepted → Paid
RefundRequested → Disputed
RefundRequested → Refunded
CancelRequested → Disputed
CancelRequested → Refunded
Disputed → Delivered (退款争议撤回)
Disputed → InProgress (中断争议撤回)
Disputed → AdminArbitrating (管理员仲裁中)
AdminArbitrating → Paid
AdminArbitrating → Refunded
Paid → Completed
Refunded → Completed
```

**重要规则**:

1. 进入 `RefundRequested`, `CancelRequested`, `Disputed`, `AdminArbitrating` 后，**永久关闭**自动验收路径
2. Disputed 允许撤回，按来源回到 `Delivered` 或 `InProgress`
3. **唯一终态是 `Completed`**，`Paid` / `Refunded` 仅为中间态，必须继续流转到 `Completed`

---

## 4. 工具函数使用指南

### 4.1 地址处理

```typescript
import { isValidAddress, normalizeAddress, formatAddress } from '@c2c-agents/shared/utils';

// 验证地址格式
isValidAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'); // false (太短)
isValidAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0'); // true

// 标准化地址 (EIP-55 checksum)
normalizeAddress('0xAbCdEf0123456789AbCdEf0123456789AbCdEf01');
// '0xabCDeF0123456789AbcdEf0123456789aBCDEF01'

// 格式化显示 (0x1234...5678)
formatAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0');
// '0x742d...bEb0'
```

### 4.2 金额转换

```typescript
import { toMinUnit, fromMinUnit, calculateFee } from '@c2c-agents/shared/utils';

// 用户金额 → 最小单位 (USDT 是 6 decimals)
toMinUnit('1.5', 6);    // '1500000'
toMinUnit('100', 6);    // '100000000'

// 最小单位 → 用户金额
fromMinUnit('1500000', 6);   // '1.500000'
fromMinUnit('100000000', 6); // '100.000000'

// 计算手续费 (15%)（注意：feeRate 现为 number 类型）
const { feeAmount, netAmount } = calculateFee('1000000', 0.15);
// feeAmount: '150000' (15% 手续费)
// netAmount: '850000' (剩余 85%)
```

**注意事项**:

- `decimals` 必须是非负整数,否则抛错
- 所有金额计算使用 `Decimal.js` 保证精度
- 返回值都是 `string` 类型

### 4.3 UUID 转换

```typescript
import { uuidToBytes32 } from '@c2c-agents/shared/utils';

// UUID → bytes32 (用于链上存储)
const bytes32 = uuidToBytes32('550e8400-e29b-41d4-a716-446655440000');
// '0x...' (keccak256 hash，不是直接 hex)
// Solidity 对应：keccak256(abi.encodePacked(uuid))
```

### 4.4 Agent Token 工具函数

```typescript
import {
  generateAgentToken,
  hashAgentToken,
  getTokenPrefix,
  isValidAgentTokenFormat,
} from '@c2c-agents/shared/utils';

// 生成新 Token (48 字符，cagt_ 前缀 + 43 字符 base64url)
const rawToken = generateAgentToken();
// 'cagt_abcdef123456789012345678901234567890123'

// 计算 Token 的 SHA-256 哈希 (用于数据库存储，永不存储原始 Token)
const tokenHash = hashAgentToken(rawToken);
// '64 字符十六进制哈希'

// 获取展示前缀 (前 17 字符，用于 UI 展示)
const prefix = getTokenPrefix(rawToken);
// 'cagt_abcdef12345'

// 验证 Token 格式
isValidAgentTokenFormat(rawToken);  // true
isValidAgentTokenFormat('invalid'); // false
```

**安全说明**:

- `rawToken` 只在创建时返回一次，之后无法再次获取
- 数据库只存储 `tokenHash`，不存储原始 Token
- Token 使用 256-bit (32 bytes) 密码学随机数生成

---

## 5. 错误处理规范

### 5.1 可用错误类

```typescript
import {
  InvalidTransitionError,
  ValidationError,
  // Agent Token 相关错误码
  ErrorCode,
} from '@c2c-agents/shared/errors';

// Agent Token 错误码 (6000-6999)
// ErrorCode.AGENT_TOKEN_INVALID       - Token 格式无效
// ErrorCode.AGENT_TOKEN_REVOKED       - Token 已吊销
// ErrorCode.AGENT_TOKEN_EXPIRED       - Token 已过期
// ErrorCode.AGENT_TOKEN_LIMIT_EXCEEDED - Token 数量超限
// ErrorCode.AGENT_TOKEN_NOT_FOUND     - Token 不存在
```

### 5.2 错误类使用示例

#### InvalidTransitionError

```typescript
import { InvalidTransitionError } from '@c2c-agents/shared/errors';
import { BadRequestException } from '@nestjs/common';

try {
  assertTransition(currentStatus, targetStatus);
} catch (error) {
  if (error instanceof InvalidTransitionError) {
    // 转换为 NestJS 异常
    throw new BadRequestException(error.message);
  }
  throw error;
}
```

#### ValidationError

```typescript
import { ValidationError } from '@c2c-agents/shared/errors';

// 自定义业务校验
if (!isValidAddress(walletAddress)) {
  throw new ValidationError('Invalid wallet address format');
}

if (amount < MIN_TASK_REWARD) {
  throw new ValidationError(`Reward must be at least ${MIN_TASK_REWARD}`);
}
```

### 5.3 NestJS 错误映射

```typescript
import {
  InvalidTransitionError,
  ValidationError
} from '@c2c-agents/shared/errors';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';

// 在 Service 层统一映射
async handleBusinessLogic() {
  try {
    // 业务逻辑
  } catch (error) {
    if (error instanceof ValidationError) {
      throw new BadRequestException(error.message);
    }
    if (error instanceof InvalidTransitionError) {
      throw new BadRequestException(error.message);
    }
    throw new InternalServerErrorException('Unexpected error');
  }
}
```

---

## 6. 配置常量使用

### 6.1 业务常量

从 `@c2c-agents/config/constants` 导入:

```typescript
import {
  // 业务逻辑常量
  PAIRING_TTL_HOURS,              // 24 (配对超时时长)
  QUEUE_MAX_N,                    // 10 (队列最大容量)
  AUTO_ACCEPT_HOURS,              // 24 (自动验收时长)
  PLATFORM_FEE_RATE,              // 0.15 (平台手续费率 15%)
  MIN_CONFIRMATIONS,              // 1 (最小确认数)
  AUTO_ACCEPT_SCAN_INTERVAL_MINUTES, // 5 (自动验收扫描间隔)

  // 链常量
  SEPOLIA_CHAIN_ID,               // 11155111
  DEFAULT_SEPOLIA_RPC_URL,        // 'https://rpc.sepolia.org'
  GAS_LIMITS,                     // { APPROVE, DEPOSIT, PAYOUT, REFUND }
  GAS_PRICE_MULTIPLIER,           // 1.2 (Gas 价格倍数)
  USDT_DECIMALS,                  // 6

  // 代币单位
  ONE_USDT,                       // '1000000'
  MIN_TASK_REWARD,                // '1000000' (1 USDT)
  MAX_TASK_REWARD,                // '100000000000' (100,000 USDT)
} from '@c2c-agents/config/constants';
```

**说明**：链上辅助函数的默认值位于 `@c2c-agents/shared/chain`，当未传参时会使用默认值。
若依赖环境变量覆盖，请将 `@c2c-agents/config/constants` 中的常量传入这些函数。

### 6.2 使用示例

```typescript
import { PAIRING_TTL_HOURS, AUTO_ACCEPT_HOURS } from '@c2c-agents/config/constants';

// 计算配对超时时间
async createPairing(orderId: string) {
  const pairingCreatedAt = new Date();

  await this.db.query(`
    UPDATE orders
    SET
      status = 'Pairing',
      pairing_created_at = $1
    WHERE id = $2
  `, [pairingCreatedAt, orderId]);

  // 过期点 = pairing_created_at + PAIRING_TTL_HOURS
}

// 计算自动验收时间
async createDelivery(orderId: string) {
  const deliveredAt = new Date();

  await this.db.query(`
    UPDATE orders
    SET
      status = 'Delivered',
      delivered_at = $1
    WHERE id = $2
  `, [deliveredAt, orderId]);

  // 自动验收触发点 = delivered_at + AUTO_ACCEPT_HOURS
}
```

### 6.3 Gas Limits 使用

```typescript
import { GAS_LIMITS } from '@c2c-agents/config/constants';

// 在链上交互时使用预设的 Gas Limit
const tx = await contract.approve(spender, amount, {
  gasLimit: GAS_LIMITS.APPROVE, // 60,000
});
```

### 6.4 环境变量校验

```typescript
import { getEnv, validateEnv } from '@c2c-agents/config/env';

// 获取已验证的环境变量 (懒加载,首次调用时验证)
const env = getEnv();
console.log(env.SUPABASE_URL);
console.log(env.CHAIN_RPC_URL);

// 手动触发验证 (会抛 ZodError 如果格式不正确)
try {
  const env = validateEnv();
} catch (error) {
  console.error('Environment validation failed:', error);
}
```

**注意**: 链上敏感变量（如 `MOCK_USDT_ADDRESS`、`ESCROW_ADDRESS`、`PLATFORM_OPERATOR_PRIVATE_KEY`）
不在 `@c2c-agents/config` 中校验，由 API 启动时的 `apps/api/src/config/env.ts` 校验，
环境清单见 `apps/api/ENV.md`。

---

## 7. 合约对接速览

> 面向多数模块的链上基础对接信息（合约已在 Phase 2 落地）
> 深度集成与 ChainService 细节见 `docs/owner1/INTERFACE.md`

### 7.1 合约与地址来源

**合约**:
- `MockUSDT` (6 decimals，测试币，支持 faucet)
- `Escrow` (托管池，operator 执行 payout/refund)

**地址来源**: `.env`

```bash
MOCK_USDT_ADDRESS=0x...
ESCROW_ADDRESS=0x...

NEXT_PUBLIC_MOCK_USDT_ADDRESS=0x...
NEXT_PUBLIC_ESCROW_ADDRESS=0x...
```

### 7.2 角色与权限

- `ADMIN`：拥有暂停、授权 operator、修改 feeReceiver 的权限
- `OPERATOR`：后端执行 `payout/refund` 的热钱包

### 7.3 常用交互（概念级）

- 支付闭环：Transfer → 链下校验 → recordEscrow → payout/refund
- A 支付：前端将 MockUSDT `transfer` 到 `ESCROW_ADDRESS`
- 支付确认成功后：后端 operator 调用 Escrow `recordEscrow(orderId, amount)`
- 后端结算：operator 调用 Escrow `payout(orderId, creator, provider, gross, net, fee)`
- 后端退款：operator 调用 Escrow `refund(orderId, creator, amount)`

### 7.4 事件（用于排查）

- `Paid(orderId, token, provider, netAmount, feeReceiver, feeAmount)`
- `Refunded(orderId, token, creator, amount)`
- `EscrowRecorded(orderId, amount)`

---

## 8. 数据库交互规范

### 8.1 禁止直接修改 Schema

**所有数据库 schema 变更必须通过 Owner #1**:

1. 提交 Issue 描述需求
2. Owner #1 编写 migration SQL
3. 在 `infra/supabase/migrations/` 添加新 migration 文件
4. 运行 `supabase migration up`

### 8.2 允许的数据库操作

各模块**可以**执行以下操作:

```typescript
// ✅ 允许: 查询自己模块管理的表
const tasks = await this.db.query<Task>(`
  SELECT * FROM tasks WHERE creator_id = $1
`, [userId]);

// ✅ 允许: 更新自己模块管理的字段
await this.db.query(`
  UPDATE tasks SET title = $1 WHERE id = $2
`, [newTitle, taskId]);

// ✅ 允许: 插入数据
await this.db.query(`
  INSERT INTO deliveries (order_id, file_url)
  VALUES ($1, $2)
`, [orderId, fileUrl]);
```

### 8.3 禁止的数据库操作

```typescript
// ❌ 禁止: 创建/删除表
await this.db.query(`CREATE TABLE custom_table (...)`);

// ❌ 禁止: 修改列定义
await this.db.query(`ALTER TABLE orders ADD COLUMN custom_field TEXT`);

// ❌ 禁止: 添加/删除外键
await this.db.query(`ALTER TABLE orders ADD FOREIGN KEY ...`);

// ❌ 禁止: 修改触发器
await this.db.query(`CREATE OR REPLACE FUNCTION ...`);
```

### 8.4 跨模块数据访问

**禁止直接跨表 JOIN,必须通过 Service 接口**:

```typescript
// ❌ 禁止: 直接 JOIN 其他模块的表
const result = await this.db.query(`
  SELECT o.*, a.username
  FROM orders o
  JOIN agents a ON o.agent_id = a.id
`);

// ✅ 正确: 通过 AgentService 获取数据
const order = await this.orderService.findById(orderId);
const agent = await this.agentService.findById(order.agentId);
```

### 8.5 幂等性约束

所有状态变更操作**必须幂等**:

```typescript
// ✅ 正确: 带幂等性检查的更新
await this.db.query(`
  UPDATE orders
  SET
    payout_tx_hash = $1,
    status = 'Paid'
  WHERE id = $2
    AND payout_tx_hash IS NULL  -- 幂等性检查
`, [txHash, orderId]);

// ❌ 错误: 无条件更新 (可能重复执行)
await this.db.query(`
  UPDATE orders
  SET payout_tx_hash = $1, status = 'Paid'
  WHERE id = $2
`, [txHash, orderId]);
```

---

## 📚 快速参考

### 常用导入语句

```typescript
// 类型和枚举
import {
  Order, Task, Agent,
  OrderStatus, AgentStatus, TaskStatus
} from '@c2c-agents/shared';

// 状态机
import {
  assertTransition,
  canTransition,
  getAllowedTransitions,
} from '@c2c-agents/shared/state-machine';

// 工具函数
import {
  formatAddress,
  toMinUnit,
  fromMinUnit,
  calculateFee,
  // Agent Token 工具
  generateAgentToken,
  hashAgentToken,
  getTokenPrefix,
  isValidAgentTokenFormat,
} from '@c2c-agents/shared/utils';

// 错误类
import {
  InvalidTransitionError,
  ValidationError,
} from '@c2c-agents/shared/errors';

// 配置常量
import {
  PAIRING_TTL_HOURS,
  AUTO_ACCEPT_HOURS,
  PLATFORM_FEE_RATE,
  GAS_LIMITS,
  ONE_USDT,
} from '@c2c-agents/config/constants';

// 环境变量
import { getEnv } from '@c2c-agents/config/env';
```

### 状态转移速查

```typescript
// 验证并抛错
assertTransition(from, to); // 失败抛 InvalidTransitionError

// 布尔检查
const allowed = canTransition(from, to); // true/false

// 获取可选项
const options = getAllowedTransitions(from); // OrderStatus[]
```

### 金额处理速查

```typescript
// 显示金额 → 最小单位
toMinUnit('1.5', 6) → '1500000'

// 最小单位 → 显示金额
fromMinUnit('1500000', 6) → '1.500000'

// 计算手续费（注意：feeRate 现为 number 类型）
calculateFee('1000000', 0.15) → { feeAmount: '150000', netAmount: '850000' }
```

---

## 🆘 遇到问题?

### 1. 需要新增字段/表?

→ 在 GitHub 提 Issue,标题格式: `[Schema Change] 描述需求`

### 2. 需要新增订单状态?

→ 在 GitHub 提 Issue,标题格式: `[State Machine] 新增状态 XXX`

### 3. 工具函数不够用?

→ 在 GitHub 提 Issue,标题格式: `[Shared Utils] 需要 XXX 功能`

### 4. 类型定义不完整?

→ 在 GitHub 提 Issue,标题格式: `[Types] XXX DTO 缺少字段`

---

**最后更新**: 2026-01-24
**维护者**: Owner #1
**版本**: v1.1.0
