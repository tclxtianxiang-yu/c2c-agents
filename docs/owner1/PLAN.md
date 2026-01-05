# Owner #1 Platform Core 开发计划

> **Owner**: Owner #1
> **模块**: Platform Core（平台核心层）
> **职责**: packages/shared、packages/config、apps/contracts、apps/api/src/modules/core
> **创建日期**: 2026-01-05
> **预估工期**: 9-12 天（单人全职）

---

## 📋 总览

### 核心职责（来自 CONTEXT.md）

- 定义并维护全局数据模型与约束（schema、索引、外键）
- 定义并维护订单状态机
- 定义并维护全局幂等与并发策略
- 提供全局共享类型与错误码（DTO/types、错误码、统一校验规则）
- 提供链上统一网关（支付确认校验、payout、refund）
- 提供后端共享中间件（requestId、auth、错误映射）

### 独占修改权限

```
packages/shared/**          - 核心 DTO/枚举/状态机/错误类型
packages/config/**          - 配置常量与环境变量校验
infra/supabase/migrations/** - 数据库迁移 SQL
apps/contracts/**           - 智能合约 + ABI + typechain
```

⚠️ **重要**: 其他 Owner 对以上目录的修改只能提 PR，由 Owner #1 审核并合并。

---

## 🎯 项目现状分析

### ✅ 已完成

1. **packages/shared 核心框架**
   - ✅ 订单状态机（14 个状态 + 转移矩阵）
   - ✅ 4 个核心枚举（OrderStatus、AgentStatus、TaskStatus、QueueItemStatus）
   - ✅ 基础错误类（InvalidTransitionError、ValidationError）
   - ✅ 工具函数（formatAddress）

2. **packages/config 完整配置**
   - ✅ 环境变量 Zod 校验
   - ✅ 业务常量（PAIRING_TTL、QUEUE_MAX_N、手续费等）

3. **infra/supabase/migrations/supabase_init.sql**
   - ✅ 完整的数据库 schema（728 行）
   - ✅ 所有核心表：tasks、orders、agents、deliveries、disputes、queue_items、wallet_bindings
   - ✅ 自动触发器 + 索引

4. **apps/contracts 框架**
   - ✅ Hardhat 配置就位（Sepolia 网络）
   - ✅ TypeChain 集成
   - ✅ 部署脚本框架（Lock.sol 占位）

### 🟡 待完成

1. `packages/shared/src/types/index.ts` - DTO 定义（当前是占位注释）
2. 智能合约实现（MockUSDT + Escrow）
3. 链上交互工具（`packages/shared/src/chain/`）
4. API 核心模块（`apps/api/src/modules/core/`）

---

## 📦 Phase 1: 基础层完善（2-3 天）

### 目标

补全所有 DTO 类型定义、扩展错误类、添加必要的工具函数，为整个系统提供类型安全的基础。

---

### Task 1.1: 补全核心 DTO 类型定义

**交付物**: `packages/shared/src/types/index.ts`

**具体任务**:

1. 基于 `infra/supabase/migrations/supabase_init.sql` 定义 7 个核心 DTO：
   - `Task` (tasks 表，第 328-383 行)
   - `Order` (orders 表，第 404-500 行)
   - `Agent` (agents 表，第 220-288 行)
   - `QueueItem` (queue_items 表，第 548-578 行)
   - `Delivery` (deliveries 表，第 506-542 行)
   - `Dispute` (disputes 表，第 586-625 行)
   - `WalletBinding` (wallet_bindings 表，第 294-323 行)

2. 扩展 DTO（关联表）：
   - `UserProfile` (user_profiles 表)
   - `File` (files 表)
   - `Review` (reviews 表)

3. 金额类型处理决策：
   - 数据库使用 `numeric(78,0)` 存储最小单位整数
   - TypeScript 定义为 `string`（避免精度丢失）

4. 时间戳类型统一：
   - 数据库 `timestamptz` → TypeScript `string` (ISO 8601)

**关键决策**:
- ✅ 金额字段使用 `string` 而非 `number`/`bigint`（JSON 序列化兼容）
- ✅ 严格遵循数据库 schema 的 nullable 约束
- ✅ 所有状态字段使用已定义的枚举

**依赖**: 无

**验收标准**:
- [ ] 所有 DTO 接口定义完整
- [ ] 类型与数据库 schema 一致（字段名、可空性）
- [ ] `pnpm typecheck --filter @c2c-agents/shared` 通过

---

### Task 1.2: 扩展错误类与错误码

**交付物**: `packages/shared/src/errors/index.ts`

**具体任务**:

1. 新增业务错误类：
   - `PaymentVerificationError` - 支付校验失败
   - `InsufficientBalanceError` - 余额不足
   - `ContractInteractionError` - 合约调用失败
   - `IdempotencyViolationError` - 幂等性违规

2. 统一错误码枚举：
   ```typescript
   export enum ErrorCode {
     INVALID_TRANSITION = 'INVALID_TRANSITION',
     PAYMENT_VERIFICATION_FAILED = 'PAYMENT_VERIFICATION_FAILED',
     INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
     CONTRACT_CALL_FAILED = 'CONTRACT_CALL_FAILED',
     DUPLICATE_OPERATION = 'DUPLICATE_OPERATION',
     VALIDATION_ERROR = 'VALIDATION_ERROR',
     QUEUE_FULL = 'QUEUE_FULL',
     QUEUE_ITEM_NOT_FOUND = 'QUEUE_ITEM_NOT_FOUND',
   }
   ```

3. 错误格式化工具：
   ```typescript
   export function toApiError(error: Error): { code: string; message: string }
   ```

**依赖**: Task 1.1 的枚举定义

**验收标准**:
- [ ] 所有错误类继承自 Error
- [ ] 错误码枚举覆盖主要业务场景
- [ ] `toApiError()` 可映射所有自定义错误

---

### Task 1.3: 添加工具函数库

**交付物**: `packages/shared/src/utils/index.ts`

**具体任务**:

1. 金额转换工具：
   - `toMinUnit(amount: string, decimals: number): string` - UI 金额 → 最小单位
   - `fromMinUnit(minUnitAmount: string, decimals: number): string` - 最小单位 → UI 金额
   - `calculateFee(grossAmount: string, feeRate: number): { feeAmount, netAmount }` - 计算手续费

2. 时间计算工具：
   - `isTTLExpired(createdAt: Date, ttlHours: number): boolean` - 检查 TTL 过期
   - `getRemainingMs(createdAt: Date, ttlHours: number): number` - 计算剩余时间
   - `shouldAutoAccept(deliveredAt: Date, autoAcceptHours: number): boolean` - 检查自动验收

3. 地址验证工具（增强版）：
   - `isValidAddress(address: string): boolean` - 验证 EVM 地址格式
   - `normalizeAddress(address: string): string` - 标准化地址（checksum）

4. 哈希工具：
   - `uuidToBytes32(uuid: string): string` - UUID → bytes32（用于合约调用）

**技术选择**:
- 金额计算：使用 `decimal.js` 或 `bignumber.js`
- 时间库：`date-fns`（轻量级）或原生 Date

**依赖**: `packages/config` 的常量（AUTO_ACCEPT_HOURS 等）

**验收标准**:
- [ ] 所有工具函数包含单元测试
- [ ] 金额转换测试覆盖边界情况（大额、小额、极端精度）
- [ ] 时间计算测试覆盖时区问题（统一使用 UTC）

---

### Task 1.4: 扩展 packages/config

**交付物**: `packages/config/src/constants.ts` + `packages/config/src/env.ts`

**具体任务**:

1. 新增链上相关常量：
   ```typescript
   export const MOCK_USDT_ADDRESS = process.env.MOCK_USDT_ADDRESS || '';
   export const ESCROW_ADDRESS = process.env.ESCROW_ADDRESS || '';
   export const GAS_LIMIT_PAYOUT = 200000;
   export const GAS_LIMIT_REFUND = 150000;
   export const MAX_RETRIES = 3;
   ```

2. 扩展 env.ts 的 Zod Schema：
   ```typescript
   MOCK_USDT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
   ESCROW_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
   PLATFORM_OPERATOR_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
   CHAIN_ID: z.string().default('11155111'), // Sepolia
   RPC_TIMEOUT_MS: z.string().default('30000'),
   ```

**依赖**: 无

**验收标准**:
- [ ] 环境变量校验通过
- [ ] 缺失必需变量时抛出明确错误

---

### Phase 1 验收清单

- [ ] 所有 DTO 类型定义完整，与数据库 schema 一致
- [ ] 金额字段使用 `string` 类型，避免精度丢失
- [ ] 错误类覆盖主要业务场景（状态机、链上、幂等）
- [ ] 工具函数包含单元测试（金额转换、时间计算）
- [ ] `pnpm typecheck` 通过
- [ ] `pnpm build --filter @c2c-agents/shared` 成功

---

## 🔗 Phase 2: 合约层实现（3-4 天）

### 目标

实现 MockUSDT 和 Escrow 两个核心合约，提供完整的托管+结算+退款能力。

---

### Task 2.1: 实现 MockUSDT 合约

**交付物**: `apps/contracts/contracts/MockUSDT.sol`

**具体任务**:

1. 基于 OpenZeppelin ERC20 实现：
   - Decimals: 6（与真实 USDT 一致）
   - Owner: 部署者地址
   - Faucet: 公开铸造功能（每次 1000 USDT）

2. 核心功能：
   - `mint(address to, uint256 amount)` - Owner 铸造（受保护）
   - `faucet()` - 公开水龙头（每次 1000 USDT）

**技术决策**:
- ✅ Decimals = 6（USDT 标准）
- ✅ MVP 允许 public faucet，简化测试

**验收标准**:
- [ ] `decimals()` 返回 6
- [ ] `mint()` 只有 owner 可调用
- [ ] `faucet()` 任何人可调用，铸造 1000 USDT
- [ ] `transfer()` / `approve()` / `transferFrom()` 正常工作
- [ ] 测试用例通过（`test/MockUSDT.test.ts`）

---

### Task 2.2: 实现 Escrow 合约

**交付物**: `apps/contracts/contracts/Escrow.sol`

**具体任务**:

1. 核心数据结构（参考 CONTRACT.md）：
   ```solidity
   enum SettlementStatus { None, Paid, Refunded }

   struct Settlement {
       SettlementStatus status;
       address token;
       address creator;      // A 地址
       address provider;     // B 地址
       uint256 grossAmount;
       uint256 feeAmount;
       uint256 netAmount;
       uint64 timestamp;
   }

   mapping(bytes32 => Settlement) public settlements;
   ```

2. 权限控制（OpenZeppelin AccessControl）：
   - `OPERATOR_ROLE` - 后端操作员（可调用 payout/refund）
   - `ADMIN_ROLE` - 管理员（可修改 feeReceiver、暂停合约）

3. 核心函数：
   - `payout(orderId, creator, provider, grossAmount, netAmount, feeAmount)`
     - 检查幂等（status == None）
     - 验证 `netAmount + feeAmount == grossAmount`
     - 转账给 provider 和 feeReceiver
     - 更新状态为 Paid
   - `refund(orderId, creator, amount)`
     - 检查幂等（status == None）
     - 转账给 creator
     - 更新状态为 Refunded

4. 安全功能（OpenZeppelin Pausable）：
   - `pause()` / `unpause()` - 紧急暂停
   - `sweep()` - 紧急提款

5. 事件定义：
   - `Paid(orderId, token, provider, netAmount, feeReceiver, feeAmount)`
   - `Refunded(orderId, token, creator, amount)`

**关键决策**:
- ✅ 资金模型：方案 A（池子模式）- 简化实现，快速交付
- ✅ orderId 类型：`bytes32`（后端通过 `keccak256(abi.encodePacked(uuid))` 生成）

**依赖**: MockUSDT 部署地址

**验收标准**:
- [ ] 部署成功，初始化参数正确
- [ ] operator 调用 payout 成功，B 收到 netAmount，平台收到 feeAmount
- [ ] operator 调用 refund 成功，A 收到 amount
- [ ] 同一 orderId 第二次 payout/refund 必须 revert（幂等）
- [ ] payout 后无法 refund（反之亦然）
- [ ] 非 operator 调用 payout/refund 必须 revert
- [ ] pause() 后 payout/refund 被阻止

---

### Task 2.3: 编写 Escrow 测试用例

**交付物**: `apps/contracts/test/Escrow.test.ts`

**测试覆盖**（参考 CONTRACT.md 第 329-338 行）:

1. 基础流程
2. payout 测试（7 个场景）
3. refund 测试（4 个场景）
4. 幂等性测试（3 个场景）
5. 权限测试（2 个场景）
6. 参数验证测试（3 个场景）
7. 暂停功能测试（2 个场景）

**验收标准**:
- [ ] 所有测试用例通过（`pnpm contracts:test`）
- [ ] 测试覆盖率 > 90%

---

### Task 2.4: 部署脚本与 TypeChain 集成

**交付物**: `apps/contracts/scripts/deploy.ts`

**具体任务**:

1. 编写部署脚本：
   - 部署 MockUSDT
   - 部署 Escrow（传入 MockUSDT 地址）
   - 授予后端操作员权限
   - 输出部署信息（用于更新 .env）

2. 验证 TypeChain 生成：
   - 检查 `typechain-types/contracts/MockUSDT.ts` 生成
   - 检查 `typechain-types/contracts/Escrow.ts` 生成

**技术决策**:
- ✅ 部署顺序：MockUSDT → Escrow
- ✅ 部署时立即授予后端操作员权限

**验收标准**:
- [ ] MockUSDT 合约部署成功，decimals = 6
- [ ] Escrow 合约部署成功，初始化参数正确
- [ ] TypeChain 类型生成正确
- [ ] 部署脚本可重复执行（幂等）
- [ ] 合约地址记录到 `.env`

---

### Phase 2 验收清单

- [ ] MockUSDT 合约部署成功，decimals = 6
- [ ] Escrow 合约部署成功，初始化参数正确
- [ ] 所有测试用例通过（`pnpm contracts:test`）
- [ ] TypeChain 类型生成正确
- [ ] 部署脚本可重复执行（幂等）
- [ ] 合约地址记录到 `.env`

---

## ⛓️ Phase 3: 链上集成层（2-3 天）

### 目标

封装合约交互逻辑，提供统一的链上网关供后端调用。

---

### Task 3.1: 创建合约实例获取工具

**交付物**: `packages/shared/src/chain/contracts.ts`

**具体任务**:

1. Provider 管理（缓存单例）：
   ```typescript
   export function getProvider(): ethers.JsonRpcProvider
   ```

2. Signer 管理（后端专用）：
   ```typescript
   export function getSigner(): ethers.Wallet
   ```

3. 合约实例获取：
   ```typescript
   export function getMockUSDTContract(signerOrProvider?): MockUSDT
   export function getEscrowContract(signerOrProvider?): Escrow
   ```

**技术决策**:
- ✅ Provider 缓存，避免重复创建连接
- ✅ Signer 仅在后端使用，前端通过用户钱包签名

**依赖**:
- Phase 2 的 TypeChain 类型
- 配置 `packages/shared/package.json` 添加 contracts workspace 依赖

**验收标准**:
- [ ] `getProvider()` 返回正确的 provider
- [ ] `getSigner()` 返回正确的 signer（后端环境）
- [ ] 合约实例可正常调用
- [ ] 类型导入路径正确

---

### Task 3.2: 实现支付确认校验

**交付物**: `packages/shared/src/chain/payment-verification.ts`

**具体任务**:

1. 四元组校验函数（参考 PRD 支付确认逻辑）：
   ```typescript
   export async function verifyPayment(params: {
     txHash: string;
     expectedFrom: string;      // A 的钱包地址
     expectedTo: string;        // Escrow 合约地址
     expectedAmount: string;    // 预期金额（最小单位）
   }): Promise<{
     verified: boolean;
     actualAmount?: string;
     failureReason?: string;
     confirmations?: number;
   }>
   ```

2. 校验步骤：
   - 获取交易 receipt
   - 检查交易状态（status == 1）
   - 检查确认数（>= MIN_CONFIRMATIONS）
   - 解析 Transfer 事件
   - 四元组验证（token、from、to、amount）

3. 便捷校验函数：
   ```typescript
   export async function validateTaskPayment(
     txHash: string,
     creatorAddress: string,
     expectedReward: string
   ): Promise<PaymentVerificationResult>
   ```

**技术决策**:
- ✅ 确认数：默认 1（Sepolia 测试网）
- ✅ 事件解析：使用 ethers.js Interface
- ✅ 错误处理：返回详细的失败原因

**依赖**: Task 3.1 的合约实例获取

**验收标准**:
- [ ] 正确的交易验证通过
- [ ] 错误的交易（from/to/amount 不匹配）验证失败
- [ ] 确认数不足时验证失败
- [ ] 单元测试通过（模拟 receipt）

---

### Task 3.3: 实现 Payout 调用封装

**交付物**: `packages/shared/src/chain/settlement.ts`

**具体任务**:

1. Payout 封装函数：
   ```typescript
   export async function executePayout(params: {
     orderId: string;           // Order.id (UUID)
     creatorAddress: string;    // A 地址
     providerAddress: string;   // B 地址（来自 WalletBinding）
     grossAmount: string;       // Order.escrowAmount
   }): Promise<{
     success: boolean;
     txHash?: string;
     error?: string;
     netAmount?: string;
     feeAmount?: string;
   }>
   ```

2. 执行步骤：
   - 计算手续费（使用 `calculateFee()`）
   - 转换 orderId 为 bytes32（使用 `uuidToBytes32()`）
   - 检查是否已结算（幂等）
   - 调用合约 payout
   - 等待确认

3. 重试逻辑（可选，建议在 API 层实现）：
   ```typescript
   export async function executePayoutWithRetry(
     params: PayoutParams,
     maxRetries: number = MAX_RETRIES
   ): Promise<PayoutResult>
   ```

**技术决策**:
- ✅ Gas Limit：使用固定值（从配置读取）
- ✅ 幂等检查：调用前先查询链上状态
- ✅ 重试策略：指数退避，最多 3 次

**依赖**: Task 1.3 的工具函数、Task 3.1 的合约实例

**验收标准**:
- [ ] Payout 调用成功（Sepolia 测试网）
- [ ] 幂等性验证通过（重复调用返回错误）
- [ ] Gas 估算正确

---

### Task 3.4: 实现 Refund 调用封装

**交付物**: `packages/shared/src/chain/settlement.ts`（扩展）

**具体任务**:

1. Refund 封装函数：
   ```typescript
   export async function executeRefund(params: {
     orderId: string;
     creatorAddress: string;    // A 地址（退款接收方）
     amount: string;            // 退款金额（通常等于 grossAmount）
   }): Promise<{
     success: boolean;
     txHash?: string;
     error?: string;
   }>
   ```

2. 重试逻辑：
   ```typescript
   export async function executeRefundWithRetry(...)
   ```

**依赖**: Task 3.3 的基础设施

**验收标准**:
- [ ] Refund 调用成功（Sepolia 测试网）
- [ ] 幂等性验证通过
- [ ] Gas 估算正确

---

### Task 3.5: 导出统一链上网关

**交付物**: `packages/shared/src/chain/index.ts`

**具体任务**:

1. 导出所有链上接口：
   ```typescript
   export * from './contracts';
   export * from './payment-verification';
   export * from './settlement';
   ```

2. 更新 `packages/shared/src/index.ts`：
   ```typescript
   export * from './chain';  // 新增
   ```

**验收标准**:
- [ ] 导出的 API 类型完整
- [ ] `pnpm typecheck --filter @c2c-agents/shared` 通过

---

### Phase 3 验收清单

- [ ] 合约实例获取工具正常工作
- [ ] 支付校验通过单元测试（模拟 receipt）
- [ ] Payout 调用成功（Sepolia 测试网）
- [ ] Refund 调用成功（Sepolia 测试网）
- [ ] 幂等性验证通过（重复调用返回错误）
- [ ] 导出的 API 类型完整
- [ ] `pnpm typecheck --filter @c2c-agents/shared` 通过

---

## 🚀 Phase 4: API 核心层（2 天）

### 目标

提供链上网关服务、共享中间件、数据库连接，供其他业务模块调用。

---

### Task 4.1: 配置 Supabase 数据库连接

**交付物**: `apps/api/src/database/supabase.service.ts`

**具体任务**:

1. 安装依赖：
   ```bash
   cd apps/api && pnpm add @supabase/supabase-js
   ```

2. 创建 Supabase 服务：
   ```typescript
   @Injectable()
   export class SupabaseService implements OnModuleInit {
     private client: SupabaseClient;

     onModuleInit() {
       this.client = createClient(supabaseUrl, supabaseKey);
     }

     getClient(): SupabaseClient { return this.client; }
     async query<T>(table: string) { return this.client.from<T>(table); }
   }
   ```

3. 创建 Database 模块（Global）：
   ```typescript
   @Global()
   @Module({
     providers: [SupabaseService],
     exports: [SupabaseService],
   })
   export class DatabaseModule {}
   ```

4. 在 AppModule 中注册

**技术决策**:
- ✅ 直接使用 Supabase JS SDK，而非 Prisma/TypeORM
- ✅ Global 模块，所有模块可直接注入

**验收标准**:
- [ ] Supabase 连接成功
- [ ] `SupabaseService` 可被其他模块注入

---

### Task 4.2: 创建 Core 模块（链上网关服务）

**交付物**: `apps/api/src/modules/core/chain.service.ts`

**具体任务**:

1. 创建 ChainService（封装 shared 包的链上接口）：
   ```typescript
   @Injectable()
   export class ChainService {
     async verifyTaskPayment(params): Promise<PaymentVerificationResult>
     async payout(params): Promise<PayoutResult>
     async refund(params): Promise<RefundResult>
   }
   ```

2. 创建 Core 模块（Global）：
   ```typescript
   @Global()
   @Module({
     providers: [ChainService],
     exports: [ChainService],
   })
   export class CoreModule {}
   ```

**技术决策**:
- ✅ Global 模块，所有模块都可以直接注入 ChainService
- ✅ Service 层只负责调用 shared 包，不包含业务逻辑

**依赖**: Phase 3 的 `@c2c-agents/shared/chain`

**验收标准**:
- [ ] ChainService 可被其他模块注入
- [ ] 方法调用正常（集成测试）

---

### Task 4.3: 创建共享中间件

**交付物**: `apps/api/src/common/middleware/` + `apps/api/src/common/filters/`

**具体任务**:

1. RequestId 中间件（日志追踪）：
   ```typescript
   @Injectable()
   export class RequestIdMiddleware implements NestMiddleware
   ```

2. Auth 中间件（JWT 验证占位）：
   ```typescript
   @Injectable()
   export class AuthMiddleware implements NestMiddleware
   ```

3. 全局异常过滤器（错误映射）：
   ```typescript
   @Catch()
   export class HttpExceptionFilter implements ExceptionFilter
   ```

4. 在 main.ts 中应用全局异常过滤器

5. 在 AppModule 中配置中间件

**技术决策**:
- ✅ Auth 实现：MVP 阶段使用占位实现
- ✅ 错误码统一：使用 `@c2c-agents/shared` 的 ErrorCode 枚举

**依赖**: Phase 1 的错误类定义

**验收标准**:
- [ ] RequestId 中间件正常工作（响应头包含 X-Request-Id）
- [ ] 全局异常过滤器捕获自定义错误
- [ ] 错误响应格式统一

---

### Task 4.4: 创建健康检查端点

**交付物**: `apps/api/src/modules/core/health.controller.ts`

**具体任务**:

1. 创建健康检查控制器：
   ```typescript
   @Controller('health')
   export class HealthController {
     @Get()
     async check() {
       const dbHealthy = await this.checkDatabase();
       const rpcHealthy = await this.checkRPC();
       return { status, checks: { database, rpc } };
     }
   }
   ```

2. 更新 CoreModule 注册 controller

**验收标准**:
- [ ] `GET /api/health` 返回 database: ok
- [ ] `GET /api/health` 返回 rpc: ok

---

### Phase 4 验收清单

- [ ] Supabase 连接成功（`GET /api/health` 返回 database: ok）
- [ ] RPC 连接成功（`GET /api/health` 返回 rpc: ok）
- [ ] ChainService 可被其他模块注入
- [ ] RequestId 中间件正常工作（响应头包含 X-Request-Id）
- [ ] 全局异常过滤器捕获自定义错误
- [ ] `pnpm dev --filter @c2c-agents/api` 成功启动

---

## 🔄 跨阶段依赖关系

```
Phase 1 (基础层) ✅ 优先级最高
    ↓
Phase 2 (合约层) ← 可并行开始（依赖 Phase 1 的部分类型）
    ↓
Phase 3 (链上集成) ← 必须等待 Phase 2 完成
    ↓
Phase 4 (API 核心) ← 必须等待 Phase 3 完成
```

**建议执行顺序**:
1. 优先完成 **Phase 1** (2-3 天)
2. **Phase 2** 可与 Phase 1 后期并行开始 (3-4 天)
3. **Phase 3** 在 Phase 2 部署完成后开始 (2-3 天)
4. **Phase 4** 在 Phase 3 完成后开始 (2 天)

**总预估时间**: 9-12 天（单人全职）

---

## 🎯 关键技术决策总结

### 1. 金额类型统一
- **数据库**: `numeric(78,0)` (最小单位整数)
- **TypeScript**: `string` (避免精度丢失)
- **工具**: 提供 `toMinUnit()` / `fromMinUnit()` 转换

### 2. 合约资金模型
- **采用方案 A（池子模式）**: Escrow 不区分订单子账户
- **优点**: 实现简单，MVP 快速交付
- **风险**: 依赖链下对账，需要运营监控

### 3. 链上幂等策略
- **orderId 唯一键**: 使用 `bytes32` (由 UUID hash 得到)
- **双重检查**: 调用前先查询链上状态 + 合约内检查
- **错误返回**: 重复调用返回明确错误，而非 revert

### 4. API 架构模式
- **数据库**: 直接使用 Supabase JS SDK（放弃 ORM）
- **模块化**: Core 模块作为全局服务，业务模块独立
- **中间件**: RequestId、Auth、异常过滤统一处理

### 5. 类型安全策略
- **单一事实来源**: 所有类型从 `@c2c-agents/shared` 导入
- **TypeChain 集成**: 合约类型自动生成
- **严格模式**: 所有 workspace 启用 TypeScript strict

---

## ⚠️ 预估风险点与应对

### 高风险（需提前规避）

#### 1. 金额精度丢失
- **应对**: 统一使用 `string` 类型 + `decimal.js` 计算
- **验收**: 编写边界值测试（大额、小额、极端精度）

#### 2. 合约资金池不足
- **应对**: 实现监控脚本，定期检查 Escrow 余额
- **降级方案**: 如余额不足，暂停新订单创建

#### 3. RPC 节点不稳定
- **应对**: 配置多个 RPC URL，实现自动切换
- **降级方案**: 支付校验失败时进入人工审核队列

### 中风险（可接受）

#### 4. TypeChain 类型导入路径问题
- **应对**: 调整 `tsconfig.json` 的 paths 配置
- **备选**: 使用相对路径导入

#### 5. Supabase RLS 权限问题
- **应对**: MVP 阶段使用 Service Key 绕过 RLS
- **后续**: 逐步配置细粒度 RLS 策略

### 低风险（可忽略）

#### 6. 单元测试编写时间长
- **应对**: 优先覆盖核心路径（状态机、支付校验、结算）
- **降级**: 非核心工具函数可延后测试

---

## 🤝 与其他 Owner 的接口约定

### Owner #2 (Task 模块)

**调用 Core 模块的接口**:
- `ChainService.verifyTaskPayment()` - 校验支付交易
- 使用 `@c2c-agents/shared` 的 Task DTO

**依赖**: Phase 1 的 DTO 定义、Phase 3 的支付校验

---

### Owner #3 (Matching 模块)

**调用 Core 模块的接口**:
- 使用 `@c2c-agents/shared` 的状态机（`assertTransition`）
- SupabaseService 查询 agents、queue_items

**依赖**: Phase 1 的状态机、Phase 4 的数据库服务

---

### Owner #4 (Agent/Queue 模块)

**调用 Core 模块的接口**:
- SupabaseService 操作 agents、queue_items 表

**依赖**: Phase 1 的 DTO 定义、Phase 4 的数据库服务

---

### Owner #5 (Delivery/Settlement 模块)

**调用 Core 模块的接口**:
- `ChainService.payout()` - 执行付款
- 使用 `@c2c-agents/shared` 的状态机

**依赖**: Phase 1 的状态机、Phase 3 的结算调用

---

### Owner #6 (Dispute/Admin 模块)

**调用 Core 模块的接口**:
- `ChainService.refund()` - 执行退款
- `ChainService.payout()` - 强制付款（仲裁）

**依赖**: Phase 1 的状态机、Phase 3 的结算调用

---

## 📁 关键文件路径汇总

### Phase 1 关键文件

- `packages/shared/src/types/index.ts` - **P0**: 所有 DTO 定义
- `packages/shared/src/errors/index.ts` - **P0**: 错误类与错误码
- `packages/shared/src/utils/index.ts` - **P1**: 工具函数库
- `packages/config/src/constants.ts` - **P1**: 业务常量
- `packages/config/src/env.ts` - **P1**: 环境变量校验

### Phase 2 关键文件

- `apps/contracts/contracts/MockUSDT.sol` - **P0**: MockUSDT 合约
- `apps/contracts/contracts/Escrow.sol` - **P0**: Escrow 合约（最核心）
- `apps/contracts/test/Escrow.test.ts` - **P0**: Escrow 测试
- `apps/contracts/scripts/deploy.ts` - **P1**: 部署脚本

### Phase 3 关键文件

- `packages/shared/src/chain/contracts.ts` - **P1**: 合约实例获取
- `packages/shared/src/chain/payment-verification.ts` - **P0**: 支付校验（关键）
- `packages/shared/src/chain/settlement.ts` - **P0**: 结算调用封装（关键）
- `packages/shared/src/chain/index.ts` - **P1**: 统一导出

### Phase 4 关键文件

- `apps/api/src/database/supabase.service.ts` - **P1**: 数据库服务
- `apps/api/src/modules/core/chain.service.ts` - **P0**: 链上网关服务
- `apps/api/src/common/middleware/request-id.middleware.ts` - **P2**: 请求 ID
- `apps/api/src/common/filters/http-exception.filter.ts` - **P1**: 异常过滤器
- `apps/api/src/modules/core/health.controller.ts` - **P2**: 健康检查

**优先级说明**: P0 = 最高优先级（必须完成），P1 = 高优先级（建议完成），P2 = 中优先级（可延后）

---

## ✅ 最终交付标准

### Phase 1
- [ ] `pnpm typecheck` 通过
- [ ] `pnpm build --filter @c2c-agents/shared` 成功
- [ ] 所有工具函数包含单元测试

### Phase 2
- [ ] `pnpm contracts:test` 通过
- [ ] MockUSDT 和 Escrow 部署到 Sepolia
- [ ] 合约地址记录到 `.env`

### Phase 3
- [ ] 支付校验单元测试通过
- [ ] Payout/Refund 集成测试通过（Sepolia）
- [ ] `pnpm typecheck --filter @c2c-agents/shared` 通过

### Phase 4
- [ ] `GET /api/health` 返回 ok
- [ ] `pnpm dev --filter @c2c-agents/api` 成功启动
- [ ] ChainService 可被其他模块注入

---

## 📚 参考文档

- [CONTEXT.md](../CONTEXT.md) - 全局约束与 Code Ownership
- [PRD.md](../PRD.md) - 产品需求文档
- [CONTRACT.md](../CONTRACT.md) - 合约接口规范
- [supabase_init.sql](../../infra/supabase/migrations/supabase_init.sql) - 数据库 schema

---

**最后更新**: 2026-01-05
**状态**: 待开始执行
**预计完成**: 2026-01-17 (假设全职投入)
