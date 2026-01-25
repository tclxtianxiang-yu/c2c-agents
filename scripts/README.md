# Scripts 说明

本目录包含项目的自动化脚本。

## generate-env.js

自动生成 apps/ 下各项目所需的环境变量文件。

### 用途

从根目录的 `.env` 文件中读取环境变量，自动生成：
- `apps/api/.env` - API 后端环境变量
- `apps/web/.env.local` - Web 前端环境变量

### 使用方法

```bash
# 方式 1：使用 pnpm 脚本（推荐）
pnpm env:generate

# 方式 2：直接运行脚本
node scripts/generate-env.js
```

### 前置条件

1. 根目录必须存在 `.env` 文件
2. Node.js 环境（无需额外依赖）

### 工作原理

1. 读取根目录 `.env` 文件
2. 解析所有环境变量（跳过注释和空行）
3. 根据预定义的变量列表，为每个子项目生成对应的环境变量文件
4. 在生成的文件头部添加说明注释

### 变量分配规则

#### API 后端 (apps/api/.env)

包含所有后端和链上相关的环境变量：
- 数据库配置：`DATABASE_URL`
- Supabase 配置：`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- 区块链配置：`CHAIN_RPC_URL`, `MOCK_USDT_ADDRESS`, `ESCROW_ADDRESS`
- 平台配置：`PLATFORM_OPERATOR_PRIVATE_KEY`, 各种业务参数
- 管理员配置：`ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`

#### Web 前端 (apps/web/.env.local)

仅包含 `NEXT_PUBLIC_` 前缀的公开变量：
- 区块链配置：`NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_CHAIN_RPC_URL`
- 合约地址：`NEXT_PUBLIC_MOCK_USDT_ADDRESS`, `NEXT_PUBLIC_ESCROW_ADDRESS`
- Supabase 配置：`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- 其他配置：`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, `NEXT_PUBLIC_API_BASE_URL`

#### Contracts (apps/contracts)

Hardhat 配置直接从根目录 `.env` 读取，不需要单独生成文件。

### 输出示例

```
✅ 已生成 apps/api/.env
✅ 已生成 apps/web/.env.local
ℹ️  apps/contracts 从根目录 .env 读取配置，无需单独生成

🎉 环境变量文件生成完成！

⚠️  提醒：
  1. 请确保根目录 .env 中的敏感信息（私钥、密码等）已正确配置
  2. 生成的文件已自动添加到 .gitignore，不会被提交到 git
  3. 如需修改环境变量，请编辑根目录 .env 后重新运行此脚本
```

### 注意事项

1. **不要手动编辑生成的文件**
   - `apps/api/.env` 和 `apps/web/.env.local` 由脚本自动生成
   - 手动修改会在下次运行脚本时被覆盖
   - 所有修改应在根目录 `.env` 中进行

2. **环境变量同步**
   - 修改根目录 `.env` 后，必须重新运行脚本
   - 确保所有子项目的环境变量保持同步

3. **安全性**
   - 生成的环境变量文件已添加到 `.gitignore`
   - 不要将包含敏感信息的 `.env` 文件提交到 Git

### 相关文档

- [../docs/env-setup.md](../docs/env-setup.md) - 环境变量配置详细指南
- [../apps/api/ENV.md](../apps/api/ENV.md) - API 环境变量说明
- [../.env.example](../.env.example) - 环境变量模板
