# CONTEXT.md — 全局上下文与硬约束（约束 AI 与开发人员）

> 目的：这是本仓库的 **唯一全局约束文档**。
> 所有 AI（Codex / Claude Code）与开发人员必须遵守，避免 6 人并行互踩、状态机分裂、DB/ABI 冲突、页面容器冲突。

---

## 1) 项目目标与范围（MVP）

- 构建一个任务接单平台（A 发布任务并支付；B 以 Agent 形式接单交付；平台负责撮合、交付、验收、退款/争议、管理员仲裁）。
- 订单执行状态以 **Order** 为准；Task 只承担发布/展示壳层（Task 不承载执行状态细节）。
- 链上：Sepolia + MockUSDT + escrow。所有链上交互必须走 **packages/shared 暴露的链上工具**（禁止各模块自行直连合约）。

---

## 2) 强制工程结构（必须一致，否则必冲突）

```txt
Monorepo（pnpm + Turbo）：

C2CAgents/
├── apps/
│   ├── web/          # Next.js 15 + React 19 前端
│   ├── api/          # NestJS 10 后端
│   └── contracts/    # Hardhat 智能合约
│
├── packages/
│   ├── shared/       # 核心共享包（DTO/枚举/状态机/错误）
│   ├── config/       # 配置管理（环境变量/常量）
│   └── ui/           # UI 组件库（shadcn/ui）
│
├── docs/             # 产品文档与约束
│   ├── CONTEXT.md    # 本文件（AI 开发时必须 @CONTEXT.md）
│   ├── PRD.md        # 产品需求文档
│   ├── OWNER1.md     # Core 模块文档
│   └── CONTRACT.md   # 合约接口规范
│
├── infra/
│   ├── docker/       # Docker 配置
│   └── supabase/     # Supabase 配置与迁移
│       └── migrations/  # 数据库迁移（仅 Owner #1 可修改）
│
└── assets/           # UI 设计稿
```

---

## 3) Code Ownership（硬性归属，违者不合并）

### 3.1 绝对收口区（只允许指定 Owner 合并）

**Owner #1（Platform Core）独占目录：**

- `packages/shared/**` - 核心 DTO/枚举/状态机/错误类型
- `packages/config/**` - 配置常量与环境变量校验
- `infra/supabase/migrations/**` - 数据库迁移 SQL
- `apps/contracts/**` - 智能合约 + ABI + typechain 产物

> ⚠️ **任何人对以上目录的修改：只能提 PR，但无权合并；最终由 Owner #1 统一落地与合并。**

### 3.2 Next.js 页面容器 Owner（只允许一个人改容器）

**容器页面归属：**

| 路由                                     | Owner    | 说明            |
| ---------------------------------------- | -------- | --------------- |
| `apps/web/src/app/page.tsx`              | Owner #2 | 首页 / 任务市场 |
| `apps/web/src/app/tasks/create/page.tsx` | Owner #2 | 发布任务页      |
| `apps/web/src/app/tasks/[id]/page.tsx`   | Owner #3 | 任务详情容器    |
| `apps/web/src/app/agents/page.tsx`       | Owner #4 | Agent 市场页    |
| `apps/web/src/app/agents/[id]/page.tsx`  | Owner #4 | Agent 详情页    |
| `apps/web/src/app/(b)/workbench/**`      | Owner #5 | B 工作台容器    |
| `apps/web/src/app/account/page.tsx`      | Owner #1 | 账户中心        |
| `apps/web/src/app/admin/**`              | Owner #6 | 管理员后台      |

> **每个 Owner 负责自己的页面容器（page.tsx）和对应子组件。跨模块 UI 需求通过 `apps/web/src/components/**` 提供可复用组件，由容器 Owner 集成。\*\*

### 3.3 NestJS 模块目录归属（强制隔离，天然不踩）

**仅允许在 `apps/api/src/modules/**` 以模块维度开发：\*\*

```
apps/api/src/modules/
├── task/         # Owner #2（任务发布+支付确认）
├── matching/     # Owner #3（匹配+Pairing）
├── agent/        # Owner #4（Agent 管理）
├── queue/        # Owner #4（队列系统）
├── delivery/     # Owner #5（交付+验收）
├── settlement/   # Owner #5（结算+自动验收）
├── dispute/      # Owner #6（退款/争议）
├── admin/        # Owner #6（管理员仲裁）
└── core/         # Owner #1 only（链上网关/共享服务）
```

**每个模块只改：**

- 自己模块内的 `controller/service/dto`（DTO 必须引用自 `@c2c-agents/shared`）
- 自己模块内的 `__tests__/*.spec.ts`
- 自己模块内的 helper（可写 raw SQL helper，但**不得改 schema**）

---

## 4) 单一事实来源（Single Source of Truth）

### 4.1 DTO / Types / Enums / Error Codes

**唯一来源：`packages/shared`**

```typescript
// ✅ 正确用法
import { OrderStatus, TaskStatus } from '@c2c-agents/shared';
import { assertTransition } from '@c2c-agents/shared/state-machine';

// ❌ 禁止
enum OrderStatus { ... }  // 禁止在模块内重复定义
```

**禁止：**

- 在各模块里复制/重定义 `OrderStatus`、`TaskStatus`、错误码
- 前后端各写一套不一致的类型
- 假设字段存在但未在 `packages/shared/src/types` 中定义

**允许：**

- 模块内部定义 "仅模块内部使用" 的临时类型，但对外（API/组件 props/跨模块调用）必须使用 shared 导出类型

### 4.2 订单状态机（OrderStatus Transition）

**状态机实现位置：`packages/shared/src/state-machine/order-transitions.ts`**

```typescript
// 状态流转必须调用
import {
  assertTransition,
  canTransition,
} from "@c2c-agents/shared/state-machine";

// 修改订单状态前
assertTransition(currentStatus, targetStatus);
```

**规则：**

- 状态机迁移矩阵（允许/禁止迁移）由 `packages/shared` 维护
- 任何模块要改变订单状态，必须使用 shared 的迁移校验
- 不能私自添加"捷径状态"或跳转规则

---

## 5) 数据库迁移规则（Supabase/Postgres：零冲突）

**迁移文件位置：`infra/supabase/migrations/**`\*\*

**规则：**

- 只允许 Owner #1 写入/修改迁移文件
- 其他人需要加字段/索引/约束：
  1. 提 PR，内容为「迁移需求说明」
  2. 描述：字段名/类型/约束 + 为什么需要 + 影响模块
  3. Owner #1 负责最终 SQL 落地

**禁止：**

- 模块为了方便"偷偷改表结构"
- 在代码里假设不存在的字段/索引（必须等 core migration 合并后再依赖）
- 直接在模块代码中执行 DDL（CREATE/ALTER TABLE）

---

## 6) 合约与 ABI 规则（Hardhat：零冲突）

**合约目录：`apps/contracts/**`\*\*

**规则：**

- 只允许 Owner #1（或指定合约 owner）修改 `.sol` 文件并重新生成 ABI/typechain
- 其他人：
  - 只能消费 `apps/contracts/typechain-types/**`（通过 workspace 引用）
  - 禁止本地重编译后提交覆盖 ABI/typechain 产物

**使用方式：**

```typescript
// ✅ 正确：通过 shared 或 config 提供的封装使用合约
import { getEscrowContract } from "@c2c-agents/shared/contracts";

// ❌ 禁止：各模块自行 new Contract
const contract = new ethers.Contract(address, abi, provider);
```

---

## 7) 幂等与并发（所有模块必须遵守的系统级约束）

> ⚠️ 这些规则不是"建议"，是系统正确性的底线。

### 7.1 幂等键（TxHash / 业务幂等）

**必须遵守：**

```sql
-- payout 必须幂等
UPDATE orders SET
  payout_tx_hash = $1,
  status = 'Paid'
WHERE id = $2
  AND payout_tx_hash IS NULL;  -- 幂等检查

-- refund 必须幂等
UPDATE orders SET
  refund_tx_hash = $1,
  status = 'Refunded'
WHERE id = $2
  AND refund_tx_hash IS NULL;  -- 幂等检查
```

**约束：**

- `payoutTxHash` 存在则不得重复打款
- `refundTxHash` 存在则不得重复退款
- `payTxHash` 必须幂等：同一 task/order 重复提交不得重复创建资源
- `recordEscrow` 是支付确认后的必需步骤：未 recordEscrow 的订单不得进入 payout/refund（系统级硬约束）

### 7.2 队列并发（Queue：必须原子）

**队列表约束：**

```sql
-- 唯一约束
UNIQUE (agent_id, order_id) WHERE status = 'queued'

-- 队列上限检查（enqueue 前）
SELECT COUNT(*) FROM queue_items
WHERE agent_id = $1 AND status = 'queued';
-- 必须 < QUEUE_MAX_N

-- consume-next 必须单 SQL 原子抢占
UPDATE queue_items
SET status = 'consumed', consumed_at = NOW()
WHERE id = (
  SELECT id FROM queue_items
  WHERE agent_id = $1 AND status = 'queued'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

### 7.3 状态互斥（跨模块共识）

**关键规则：**

进入以下状态后，自动验收路径**永久关闭**：

- `RefundRequested`
- `CancelRequested`
- `Disputed`
- `AdminArbitrating`

**实现要求：**

```typescript
// 自动验收 cron 必须跳过这些状态
const shouldSkipAutoAccept = [
  'RefundRequested',
  'CancelRequested',
  'Disputed',
  'AdminArbitrating',
  'Refunded',
  'Paid',
  'Completed'
];

// 查询待自动验收订单时排除
WHERE status = 'Delivered'
  AND status NOT IN (${shouldSkipAutoAccept})
```

---

## 8) 跨模块依赖边界（只允许"调用接口"，禁止"直连内部"）

### 8.1 模块间调用规范

**✅ 正确：通过 Service 接口调用**

```typescript
// matching 模块需要队列能力
import { QueueService } from "../queue/queue.service";

@Module({
  imports: [QueueModule],
  controllers: [MatchingController],
  providers: [MatchingService],
})
export class MatchingModule {}
```

**❌ 禁止：直接操作其他模块的数据表**

```typescript
// ❌ 禁止在 matching 模块中直接操作 queue_items 表
await this.db.query("INSERT INTO queue_items ...");
```

### 8.2 链上调用规范

**所有链上调用必须通过 shared 或 core 提供的封装：**

```typescript
// ✅ 正确
import { validatePayTx, executePayoutTx } from "@c2c-agents/shared/chain";

// ❌ 禁止各模块自行 new provider/contract
const provider = new ethers.JsonRpcProvider(rpcUrl);
const contract = new ethers.Contract(address, abi, provider);
```

---

## 9) 前端协作边界（避免页面互踩）

### 9.1 容器 vs 组件职责划分

**容器 Owner 负责：**

- 页面级路由（`apps/web/src/app/**/page.tsx`）
- Layout 与状态编排
- 跨模块组件拼装

**子组件提供者负责：**

- 可复用组件（`apps/web/src/components/**`）
- 清晰的 props 契约
- 不触碰容器文件

### 9.2 禁止行为

**❌ 禁止：**

- 为了加按钮/展示信息去直接改别人的容器页
- 在多个位置复制同一块业务 UI（必须抽组件到 `packages/ui` 或 `apps/web/src/components`）
- 直接修改 `apps/web/src/app/layout.tsx` 根布局（需要 Owner #1 审批）

**✅ 正确做法：**

```typescript
// 1. 创建可复用组件
// apps/web/src/components/TaskCard.tsx
export function TaskCard({ task }: { task: Task }) { ... }

// 2. 容器 Owner 引用
// apps/web/src/app/tasks/page.tsx
import { TaskCard } from '@/components/TaskCard';
```

---

## 10) 测试与验收（每个模块的最低交付标准）

### 10.1 NestJS 模块测试要求

**每个 Nest 模块必须包含：**

```
apps/api/src/modules/task/
├── task.controller.ts
├── task.service.ts
└── __tests__/
    ├── task.service.spec.ts      # 单元测试
    └── task.e2e.spec.ts           # E2E 测试
```

**测试覆盖：**

- 主流程（happy path）
- 幂等场景（重复提交同一操作）
- 并发/竞态（若模块涉及队列/状态变更）

### 10.2 关键测试场景

**任何影响以下内容的改动必须附带测试：**

- 状态机迁移
- 幂等逻辑（payoutTxHash/refundTxHash）
- 队列操作（enqueue/consume）
- 链上交互（支付/结算）

---

## 11) PR 与合并纪律（强制）

### 11.1 PR 标题规范

```
[模块] 简短描述

示例：
[task] 添加支付确认校验逻辑
[matching] 实现 Pairing TTL 过期检测
[core] 更新订单状态机添加新状态
```

### 11.2 PR 描述必须包含

- **影响模块**：Owner #1 / Owner #2 / Owner #3 ...
- **是否涉及**：
  - [ ] 状态机修改
  - [ ] 幂等逻辑
  - [ ] 队列操作
  - [ ] 链上交互
  - [ ] 数据库 schema 变更
- **是否触碰受限目录**：
  - [ ] `packages/shared`
  - [ ] `packages/config`
  - [ ] `infra/supabase/migrations`
  - [ ] `apps/contracts`
  - [ ] 页面容器

### 11.3 受限目录 PR 流程

**触碰受限目录的 PR：**

1. 必须标注 `[RESTRICTED]` 前缀
2. 必须由对应 Owner 最终合并
3. 其他 Owner 可以 Review，但不能 Merge

### 11.4 禁止"顺手改"

**❌ 禁止：**

- 发现需要 shared/schema/ABI 变更时直接修改
- "顺便" 修改不在自己模块范围内的代码

**✅ 正确做法：**

1. 停止当前工作
2. 提交「变更提案」Issue
3. 等待对应 Owner 落地后再继续

---

## 12) AI 执行约束（给 Codex / Claude Code 的明确指令）

### 12.1 AI 权限边界

**你（AI）只能修改被分配模块的白名单路径。**

**遇到跨模块需求时：**

1. 立即停止直接修改
2. 在响应中输出「需求清单」
3. 明确标注「所需 Owner 动作」
4. 等待对应 Owner 落地后再继续实现

### 12.2 受限目录触碰规则

**当你发现需要修改以下目录时：**

```
packages/shared/**
packages/config/**
infra/supabase/migrations/**
apps/contracts/**
apps/web/src/app/**/page.tsx（容器页）
```

**必须：**

1. 停止直接修改
2. 输出「变更提案」：
   - 需要添加/修改的内容
   - 原因与影响范围
   - 建议的实现方式
3. 标注「需要 Owner #X 审批」

### 12.3 类型与规则来源

**永远以 `packages/shared` 为类型与规则来源：**

```typescript
// ✅ 正确
import { OrderStatus, assertTransition } from '@c2c-agents/shared';

// ❌ 禁止
enum OrderStatus { Standby = 'Standby', ... }  // 复制定义
const ALLOWED_TRANSITIONS = { ... };          // 复制状态机
```

---

## 13) 冲突点清单（已知高冲突，必须按规则规避）

### 13.1 高冲突区

| 冲突点                                      | Owner    | 说明              |
| ------------------------------------------- | -------- | ----------------- |
| 1. `packages/shared/**`                     | Owner #1 | DTO/枚举/状态机   |
| 2. `packages/config/**`                     | Owner #1 | 配置常量/环境变量 |
| 3. `infra/supabase/migrations/**`           | Owner #1 | 数据库 schema     |
| 4. `apps/contracts/**`                      | Owner #1 | 合约 + ABI        |
| 5. `apps/web/src/app/page.tsx`              | Owner #2 | 首页 / 任务市场   |
| 6. `apps/web/src/app/tasks/create/page.tsx` | Owner #2 | 发布任务页        |
| 7. `apps/web/src/app/tasks/[id]/page.tsx`   | Owner #3 | 任务详情页容器    |
| 8. `apps/web/src/app/agents/page.tsx`       | Owner #4 | Agent 市场页      |
| 9. `apps/web/src/app/agents/[id]/page.tsx`  | Owner #4 | Agent 详情页      |
| 10. `apps/web/src/app/(b)/workbench/**`     | Owner #5 | B 工作台容器      |
| 11. `apps/web/src/app/account/page.tsx`     | Owner #1 | 账户中心          |
| 12. `apps/web/src/app/admin/**`             | Owner #6 | 管理员后台        |

### 13.2 规避策略（强制执行）

**绝对收口（Owner #1）：**

- 所有 shared/config/migrations/contracts 修改

**容器隔离：**

- Owner #2 维护首页 / 任务市场 / 发布任务页
- Owner #3 维护任务详情页
- Owner #4 维护 Agent 市场页 / Agent 详情页
- Owner #5 维护 B 工作台
- Owner #1 维护账户中心
- Owner #6 维护管理员后台
- 其他人只提供子组件

**模块隔离：**

- 每个 NestJS 模块只修改自己的 `modules/xxx/**`
- 跨模块调用通过 Service 接口

---

## 14) 代码格式规范（强制执行）

### 14.1 Biome 自动格式化

**本项目使用 Biome 进行代码格式化和 lint，所有代码必须通过 Biome 检查才能提交。**

**关键规则：**

```typescript
// ✅ 推荐：单引号、分号、2 空格缩进
const message = "Hello World";

// ✅ 推荐：使用 import type
import type { OrderStatus } from "@c2c-agents/shared";

// ✅ 推荐：使用 const
const MAX_RETRY = 3;

// ❌ 禁止：使用 var
var count = 0;

// ⚠️ 警告：避免使用 any（测试文件除外）
const data: any = {};
```

### 14.2 Git Hooks 强制检查

**Pre-commit Hook（自动格式化）：**

```bash
git add .
git commit -m "feat: xxx"  # 自动运行 lint-staged 格式化
```

**Pre-push Hook（强制检查）：**

```bash
git push  # 如果格式检查失败会阻止 push

# 解决方案
pnpm format
git add .
git commit -m "chore: format code"
git push
```

### 14.3 AI 开发时的格式化要求

**当 AI 生成代码时，必须：**

1. 使用单引号（字符串）+ 双引号（JSX 属性）
2. 使用 `import type` 导入类型
3. 使用 `const` 代替 `var`
4. 箭头函数总是带括号：`(a) => a + 1`
5. 对象/数组使用 ES5 风格尾随逗号

**详细规范参考**：[docs/CODE_STYLE.md](./CODE_STYLE.md)

---

## 15) 快速检查清单（开发前必看）

### 15.1 我要修改的文件是否在受限目录？

```bash
# 检查路径
packages/shared/**          → Owner #1 only
packages/config/**          → Owner #1 only
infra/supabase/migrations/** → Owner #1 only
apps/contracts/**           → Owner #1 only
apps/web/src/app/**/page.tsx → 容器 Owner only
```

**如果是 → 停止，提变更提案**

### 14.2 我要添加的类型/枚举是否已在 shared 中定义？

```typescript
// 先检查
import { OrderStatus, TaskStatus } from "@c2c-agents/shared";
```

**如果已存在 → 直接使用，禁止复制**

### 14.3 我要操作的数据表是否属于其他模块？

```
queue_items → queue 模块
tasks → task 模块
orders → core 模块（通过各业务模块调用）
```

**如果是 → 通过对应模块的 Service 调用**

### 14.4 我要调用合约是否需要直连？

**❌ 禁止直连 → ✅ 使用 shared 提供的封装**

---

## 15) 违反约束的后果

- **受限目录未经 Owner 审批合并** → PR 回退 + 重新提交
- **复制 shared 的类型/枚举** → 代码审查不通过
- **直连数据表/合约** → 重构要求
- **容器页冲突** → 由容器 Owner 决定保留版本

---

## 附录：当前 Workspace 结构

```
7 个 workspaces:
- c2c-agents-monorepo (根)
- @c2c-agents/shared (packages/shared)
- @c2c-agents/config (packages/config)
- @c2c-agents/ui (packages/ui)
- @c2c-agents/web (apps/web)
- @c2c-agents/api (apps/api)
- @c2c-agents/contracts (apps/contracts)
```

**依赖关系：**

```
packages/shared (核心层，零依赖)
    ↓
    ├─→ packages/config (依赖 shared)
    ├─→ packages/ui (依赖 shared)
    ├─→ apps/web (依赖 shared/config/ui)
    ├─→ apps/api (依赖 shared/config)
    └─→ apps/contracts (依赖 shared/config)
```

---

**文档版本**：v1.1 (2026-01-03)
**下次更新**：当项目结构发生重大变化或新增 Owner 时
