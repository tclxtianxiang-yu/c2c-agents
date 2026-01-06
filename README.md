# C2C Agents - Web3 任务接单平台

基于 pnpm + Turbo 的 Monorepo 架构,集成 Next.js 15、NestJS 10 和 Hardhat 的完整 Web3 应用。

> ⚠️ **重要提示**: 本项目采用严格的 Code Ownership 和模块化开发模式,请在开发前务必阅读 [CONTEXT.md](docs/CONTEXT.md)

---

## 📋 目录

- [项目结构](#项目结构)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [开发规范](#开发规范)
- [使用 AI 开发](#使用-ai-开发)
- [常用命令](#常用命令)
- [文档索引](#文档索引)

---

## 项目结构

```text
C2CAgents/
├── apps/
│   ├── web/          # Next.js 15 + React 19 前端
│   ├── api/          # NestJS 10 后端
│   └── contracts/    # Hardhat 智能合约
│
├── packages/
│   ├── shared/       # 核心共享包（DTO/枚举/状态机/错误）⚠️ Owner #1 only
│   ├── config/       # 配置管理（环境变量/常量）⚠️ Owner #1 only
│   └── ui/           # UI 组件库 (shadcn/ui)
│
├── docs/             # 产品文档
│   ├── CONTEXT.md    # 🔴 AI 开发必读：全局约束与硬性规则
│   ├── INTERFACE.md  # 📘 Owner #1 公共接口文档
│   ├── PRD.md        # 产品需求文档
│   └── CONTRACT.md   # 合约接口规范
│
├── infra/
│   ├── docker/       # Docker 配置
│   └── supabase/     # Supabase 配置与迁移
│       └── migrations/  # 数据库迁移 ⚠️ Owner #1 only
│
└── assets/           # UI 设计稿
```

### Workspace 依赖关系

```text
packages/shared (核心层，零依赖)
    ↓
    ├─→ packages/config (依赖 shared)
    ├─→ packages/ui (依赖 shared)
    ├─→ apps/web (依赖 shared/config/ui)
    ├─→ apps/api (依赖 shared/config)
    └─→ apps/contracts (依赖 shared/config)
```

---

## 技术栈

✅ **前端**: Next.js 15 + React 19 + Tailwind CSS + shadcn/ui
✅ **钱包**: Wagmi 2 + RainbowKit + WalletConnect
✅ **后端**: NestJS 10 + Supabase (PostgreSQL)
✅ **合约**: Hardhat + Solidity 0.8.24 + OpenZeppelin
✅ **包管理**: pnpm 10 + Turbo 2
✅ **类型**: TypeScript 5.6 strict 模式
✅ **代码质量**: Biome (格式化 + Lint) + Husky (Git Hooks)

---

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 环境配置

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，填写以下关键配置：
# - CHAIN_RPC_URL: Sepolia RPC URL (从 Infura/Alchemy 获取)
# - NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: 从 https://cloud.walletconnect.com 获取
# - SUPABASE_*: 运行 supabase start 后获取
```

### 3. 启动本地开发环境

```bash
# 方式 1：并行启动所有服务（推荐）
pnpm dev

# 方式 2：分别启动
pnpm --filter @c2c-agents/web dev    # 前端 http://localhost:3000
pnpm --filter @c2c-agents/api dev    # 后端 http://localhost:3001
```

### 4. 启动本地 Supabase（可选）

```bash
cd infra/supabase
supabase start
supabase migration up
```

---

## 开发规范

### 🚨 核心原则

1. **Code Ownership 严格遵守**
   - `packages/shared/**` - 只有 Owner #1 可以修改
   - `packages/config/**` - 只有 Owner #1 可以修改
   - `infra/supabase/migrations/**` - 只有 Owner #1 可以修改
   - `apps/contracts/**` - 只有 Owner #1 可以修改

2. **单一事实来源（SSOT）**
   - 所有类型、枚举、状态机**必须**从 `@c2c-agents/shared` 导入
   - **禁止**在业务模块中复制定义
   - **禁止**前后端各写一套类型

3. **模块隔离**
   - NestJS 模块只修改自己的 `apps/api/src/modules/xxx/**`
   - 前端页面容器由对应 Owner 维护
   - 跨模块调用通过 Service 接口

### ✅ 正确示例

```typescript
// ✅ 正确：从 shared 导入
import { OrderStatus, TaskStatus } from '@c2c-agents/shared';
import { assertTransition } from '@c2c-agents/shared/state-machine';
import { PAIRING_TTL_HOURS } from '@c2c-agents/config/constants';

// 使用状态机验证
assertTransition(currentStatus, targetStatus);
```

### ❌ 禁止示例

```typescript
// ❌ 禁止：复制枚举定义
enum OrderStatus {
  Standby = 'Standby',
  Pairing = 'Pairing',
  // ...
}

// ❌ 禁止：直连合约
const contract = new ethers.Contract(address, abi, provider);

// ❌ 禁止：跨模块直接操作数据表
await this.db.query('INSERT INTO queue_items ...');
```

### 📁 目录归属（NestJS 模块）

```text
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

**规则**: 只修改自己模块内的 `controller/service/dto/__tests__`

---

## 使用 AI 开发

### 🔴 必读文档

**在使用 AI（Claude Code / Cursor / Copilot）开发时,必须将 CONTEXT.md 作为上下文引用!**

```markdown
@docs/CONTEXT.md 请帮我实现 XXX 功能
```

### 为什么必须引用 CONTEXT.md?

1. **避免冲突**: CONTEXT.md 定义了严格的 Code Ownership,防止 6 人并行开发互踩
2. **类型统一**: 确保 AI 从 `packages/shared` 导入类型,而不是重复定义
3. **遵守约束**: 幂等性、状态机、队列并发等系统级约束必须遵守
4. **受限目录保护**: AI 会自动识别受限目录并提出变更提案,而不是直接修改

### AI 开发工作流

```bash
# 1. 在 AI 对话中引用 CONTEXT.md
@docs/CONTEXT.md

# 2. 描述你的需求
"我需要在 matching 模块中实现 Pairing TTL 过期检测"

# 3. AI 会自动：
# - 检查是否触碰受限目录
# - 使用 shared 中的类型
# - 遵守状态机规则
# - 提供符合规范的代码

# 4. 如果需要修改受限目录，AI 会：
# - 停止直接修改
# - 输出「变更提案」
# - 标注「需要 Owner #X 审批」
```

### AI 推荐配置

**Cursor / Copilot 用户**:

- 将 `docs/CONTEXT.md` 添加到工作区索引
- 在 `.cursorrules` 或 `.github/copilot-instructions.md` 中引用 CONTEXT.md

**Claude Code 用户**:

- 每次对话开始时使用 `@docs/CONTEXT.md`
- 配合 `@docs/PRD.md` 理解业务需求

---

## 常用命令

### 开发命令

```bash
pnpm dev              # 并行启动所有服务
pnpm build            # 构建所有项目
pnpm typecheck        # 全项目类型检查
pnpm test             # 运行所有测试

# 代码格式化（使用 Biome）
pnpm lint             # 运行 Biome lint 检查
pnpm lint:fix         # 自动修复 lint 问题
pnpm format           # 格式化所有代码
pnpm format:check     # 检查代码格式（不修改）
pnpm check            # 格式化 + lint + 自动修复（提交前推荐）

pnpm clean            # 清理所有构建产物
```

### 🔴 代码提交规范（Git Hooks）

项目已配置 **Biome + Husky** 强制代码格式化,所有开发者必须遵守:

```bash
# ⚠️ 提交代码前会自动运行 lint-staged（格式化暂存文件）
git add .
git commit -m "feat: xxx"  # 触发 pre-commit hook

# ⚠️ Push 前会强制检查代码格式
git push  # 触发 pre-push hook

# 如果格式检查失败：
pnpm format     # 格式化所有代码
git add .       # 重新暂存
git push        # 再次推送
```

**重要**:

- ✅ 所有代码必须通过 Biome 格式化才能 push
- ✅ 使用 VSCode 的团队成员会自动在保存时格式化（已配置 `.vscode/settings.json`）
- ✅ 推荐 VSCode 用户安装 Biome 扩展: `biomejs.biome`
- ❌ 禁止使用 `--no-verify` 跳过 hooks（除非紧急情况并通知团队）

### 合约命令

```bash
pnpm contracts:compile    # 编译合约
pnpm contracts:deploy     # 部署合约到 Sepolia
```

### 数据库命令

```bash
pnpm db:migrate       # 运行数据库迁移
pnpm db:reset         # 重置数据库
```

### 添加依赖

```bash
# 根目录添加开发依赖
pnpm add -D <package> -w

# 给特定 workspace 添加依赖
pnpm add <package> --filter @c2c-agents/web
pnpm add <package> --filter @c2c-agents/api
pnpm add <package> --filter @c2c-agents/shared

# 添加 workspace 间依赖
cd apps/web
pnpm add @c2c-agents/shared@workspace:*
```

### 添加 UI 组件

```bash
cd packages/ui
npx shadcn@latest add button card input label dialog
```

---

## 开发流程

### 1. 开发前检查

```bash
# 检查你要修改的文件是否在受限目录
packages/shared/**          → Owner #1 only
packages/config/**          → Owner #1 only
infra/supabase/migrations/** → Owner #1 only
apps/contracts/**           → Owner #1 only
apps/web/src/app/**/page.tsx → 容器 Owner only
```

**如果在受限目录 → 停止,提交变更提案 Issue**

### 2. 创建新功能

```bash
# 1. 创建功能分支
git checkout -b feature/your-feature-name

# 2. 在 AI 对话中引用 CONTEXT.md
@docs/CONTEXT.md 请帮我实现 XXX 功能

# 3. 开发（AI 会自动遵守约束）

# 4. 测试
pnpm typecheck
pnpm lint
pnpm test

# 5. 提交 PR
git add .
git commit -m "[模块] 功能描述"
git push origin feature/your-feature-name
```

### 3. PR 检查清单

提交 PR 时必须包含:

- [ ] PR 标题格式: `[模块] 简短描述`
- [ ] 影响模块: Owner #X
- [ ] 是否涉及状态机/幂等/队列/链上?
- [ ] 是否触碰受限目录?
- [ ] 测试用例（如涉及关键逻辑）
- [ ] 类型检查通过 `pnpm typecheck`

**受限目录 PR**: 必须标注 `[RESTRICTED]` 前缀,由对应 Owner 合并

---

## 常见问题

### Q: 我需要添加一个新的订单状态,怎么做?

**A**: 这涉及 `packages/shared` 的修改,你需要:

1. 停止直接修改
2. 提交 Issue:「变更提案：添加新状态 XYZ」
3. 描述: 状态名称、触发条件、允许的状态迁移
4. 等待 Owner #1 审批并落地

### Q: 我要在前端调用合约,怎么办?

**A**: 不能直接 `new ethers.Contract`,应该:

```typescript
// ✅ 使用 shared 提供的封装
import { validatePayTx, executePayoutTx } from '@c2c-agents/shared/chain';
```

### Q: 我需要操作队列,怎么办?

**A**: 不能直接操作 `queue_items` 表,应该:

```typescript
// ✅ 调用 QueueService
import { QueueService } from '../queue/queue.service';

// 在模块中注入
@Module({
  imports: [QueueModule],
  // ...
})
```

### Q: AI 生成的代码重复定义了枚举,怎么办?

**A**: 这说明你没有引用 `CONTEXT.md`! 重新开始对话:

```markdown
@docs/CONTEXT.md 请重新生成代码，使用 shared 中的类型
```

### Q: 我想改任务详情页的布局,怎么办?

**A**: 检查页面归属:

- `apps/web/src/app/tasks/[id]/page.tsx` → Owner #3 维护
- 如果你不是 Owner #3: 创建子组件提供给 Owner #3 集成

---

## 验收清单

- [x] `pnpm install` 成功安装 1601 个包
- [x] `pnpm list --recursive` 显示 7 个 workspace
- [x] `pnpm build` 能按依赖顺序构建
- [x] `pnpm typecheck` 类型检查通过
- [x] packages/shared 和 packages/config 构建成功
- [x] Workspace 间依赖正确链接 (link:)

---

## 文档索引

| 文档                                          | 用途                                          | 读者          |
| --------------------------------------------- | --------------------------------------------- | ------------- |
| [README.md](README.md)                        | 项目概览与开发指南                            | 开发人员      |
| [CONTEXT.md](docs/CONTEXT.md)                 | 🔴 **AI 开发必读**: 全局约束与硬性规则        | AI + 开发人员 |
| [INTERFACE.md](docs/INTERFACE.md)             | 📘 **Owner #1 公共接口**: 类型/状态机/工具函数 | AI + 开发人员 |
| [owner1/INTERFACE.md](docs/owner1/INTERFACE.md) | 📗 Owner #1 专用接口: 链上网关/队列系统       | 特定 Owner    |
| [PRD.md](docs/PRD.md)                         | 完整产品需求文档                              | AI + 开发人员 |
| [DEVIDE_THE_WORK.md](docs/DEVIDE_THE_WORK.md) | 模块化分工                                    | 开发人员      |
| [CONTRACT.md](docs/CONTRACT.md)               | 智能合约接口规范                              | 合约开发      |

---

## 下一步

### 立即可做

1. ✅ **启动开发环境**: `pnpm dev`
2. ✅ **配置环境变量**: 复制 `.env.example` → `.env`
3. ✅ **添加 UI 组件**: `cd packages/ui && npx shadcn@latest add button`

### 等待 Owner #1

1. ⏳ **开发智能合约**: 实现 `MockUSDT.sol` 和 `Escrow.sol`
2. ⏳ **实现链上网关**: `apps/api/src/modules/core/chain-gateway/`
3. ⏳ **实现队列服务**: `apps/api/src/modules/queue/`

### 配置第三方服务

1. **WalletConnect**: 在 [cloud.walletconnect.com](https://cloud.walletconnect.com) 创建项目
2. **Sepolia RPC**: 从 [Infura](https://infura.io) 或 [Alchemy](https://alchemy.com) 获取
3. **Supabase**: 运行 `cd infra/supabase && supabase start`

---

## 团队协作提示

### ✅ DO（推荐做法）

- ✅ 开发前先引用 `@docs/CONTEXT.md`
- ✅ 查阅 `@docs/INTERFACE.md` 了解如何使用 shared/config
- ✅ 从 `@c2c-agents/shared` 导入类型
- ✅ 使用状态机验证 `assertTransition(from, to)`
- ✅ 只修改自己模块的代码
- ✅ 跨模块调用通过 Service 接口
- ✅ PR 标题格式: `[模块] 简短描述`

### ❌ DON'T（禁止做法）

- ❌ 不引用 CONTEXT.md 就让 AI 生成代码
- ❌ 复制枚举/类型定义
- ❌ 直连合约/数据表
- ❌ 修改受限目录（shared/config/migrations/contracts）
- ❌ 直接修改别人的容器页面
- ❌ "顺手改" 不在自己模块范围内的代码

---

## License

UNLICENSED - Internal Project

---

**🔴 再次提醒**: 使用 AI 开发时,必须先引用 `@docs/CONTEXT.md`,然后查阅 `@docs/INTERFACE.md` 了解如何对接 Owner #1 的核心功能!

```markdown
@docs/CONTEXT.md
@docs/INTERFACE.md
请帮我实现 XXX 功能
```
