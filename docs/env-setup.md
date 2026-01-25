# 环境变量配置指南

本文档说明如何配置和管理项目的环境变量。

## 概述

项目采用单一源头（根目录 `.env`）管理环境变量，通过自动化脚本生成各子项目所需的环境变量文件。

### 环境变量文件结构

```
c2c-agents/
├── .env.example          # 环境变量模板（提交到 git）
├── .env                  # 根配置文件（不提交，需手动创建）
├── apps/
│   ├── api/
│   │   └── .env          # API 后端环境变量（自动生成）
│   ├── web/
│   │   └── .env.local    # Web 前端环境变量（自动生成）
│   └── contracts/
│       └── (从根目录 .env 读取，无需单独文件)
└── scripts/
    └── generate-env.ts   # 环境变量生成脚本
```

## 快速开始

### 1. 创建根环境变量文件

首次设置时，复制模板文件并填写实际值：

```bash
cp .env.example .env
```

然后编辑 `.env` 文件，填写以下必需的环境变量：

```bash
# 数据库连接
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Supabase 配置
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your-actual-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-actual-service-role-key

# 链上配置
CHAIN_RPC_URL=https://sepolia.infura.io/v3/YOUR_ACTUAL_INFURA_KEY
MOCK_USDT_ADDRESS=0x... # 部署后填入实际地址
ESCROW_ADDRESS=0x...    # 部署后填入实际地址
PLATFORM_OPERATOR_PRIVATE_KEY=0x... # 实际私钥

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-actual-project-id

# 管理员账号
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=... # 使用 bcrypt 生成的密码哈希
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 生成子项目环境变量文件

运行自动生成脚本：

```bash
pnpm env:generate
```

这将自动生成：
- `apps/api/.env` - API 后端所需的环境变量
- `apps/web/.env.local` - Web 前端所需的环境变量

## 环境变量分类

### API 后端变量 (apps/api/.env)

API 需要以下环境变量：

- `NODE_ENV` - 运行环境（development/production）
- `DATABASE_URL` - PostgreSQL 数据库连接字符串
- `SUPABASE_URL` - Supabase 项目 URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase Service Role 密钥（绕过 RLS）
- `CHAIN_RPC_URL` - 区块链 RPC 节点 URL
- `MOCK_USDT_ADDRESS` - MockUSDT 合约地址
- `ESCROW_ADDRESS` - Escrow 合约地址
- `PLATFORM_OPERATOR_PRIVATE_KEY` - 平台操作员私钥
- `MIN_CONFIRMATIONS` - 最小确认数
- `QUEUE_MAX_N` - 队列最大数量
- `PAIRING_TTL_HOURS` - 配对过期时间（小时）
- `AUTO_ACCEPT_HOURS` - 自动接受时间（小时）
- `AUTO_ACCEPT_SCAN_INTERVAL_MINUTES` - 自动接受扫描间隔（分钟）
- `PLATFORM_FEE_RATE` - 平台费率
- `ADMIN_USERNAME` - 管理员用户名
- `ADMIN_PASSWORD_HASH` - 管理员密码哈希

### Web 前端变量 (apps/web/.env.local)

Web 前端需要以下公开环境变量（NEXT_PUBLIC_ 前缀）：

- `NEXT_PUBLIC_CHAIN_ID` - 区块链网络 ID
- `NEXT_PUBLIC_CHAIN_RPC_URL` - 区块链 RPC URL（客户端使用）
- `NEXT_PUBLIC_MOCK_USDT_ADDRESS` - MockUSDT 合约地址
- `NEXT_PUBLIC_ESCROW_ADDRESS` - Escrow 合约地址
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase 项目 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase 匿名密钥
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` - WalletConnect 项目 ID
- `NEXT_PUBLIC_API_BASE_URL` - API 后端地址（默认：http://localhost:3001）
- `NEXT_PUBLIC_QUEUE_MAX_N` - 队列最大数量

### Contracts 配置 (apps/contracts)

Contracts 项目通过 `hardhat.config.ts` 直接从根目录 `.env` 读取：

- `CHAIN_RPC_URL` - 用于 Sepolia 网络配置
- `PLATFORM_OPERATOR_PRIVATE_KEY` - 用于合约部署账户

## 修改环境变量

当需要修改环境变量时：

1. **编辑根目录 `.env` 文件**
2. **重新运行生成脚本**：
   ```bash
   pnpm env:generate
   ```

⚠️ **重要提醒**：
- 不要直接编辑 `apps/api/.env` 或 `apps/web/.env.local`
- 这些文件由脚本自动生成，手动修改会在下次运行脚本时被覆盖
- 所有修改应该在根目录 `.env` 中进行

## 环境变量验证

### API 启动时验证

API 在启动时会自动验证必需的环境变量（参见 [apps/api/ENV.md](../apps/api/ENV.md)）：

- `CHAIN_RPC_URL` - 必须是有效的 HTTP/HTTPS URL
- `MOCK_USDT_ADDRESS` - 必须是有效的以太坊地址，且不能为零地址
- `ESCROW_ADDRESS` - 必须是有效的以太坊地址，且不能为零地址
- `PLATFORM_OPERATOR_PRIVATE_KEY` - 必须是有效的 64 位十六进制私钥
- `SUPABASE_URL` - 必须是有效的 HTTP/HTTPS URL
- `SUPABASE_SERVICE_ROLE_KEY` - 必须存在

如果验证失败，API 会拒绝启动并显示错误信息。

## 安全注意事项

1. **不要提交敏感信息到 Git**
   - `.env` 文件已添加到 `.gitignore`
   - 只有 `.env.example` 会被提交
   - 确保 `.env.example` 中不包含真实的密钥和密码

2. **私钥管理**
   - `PLATFORM_OPERATOR_PRIVATE_KEY` 是平台操作员的私钥，具有调用 escrow 合约的权限
   - 绝对不要将真实私钥提交到 Git 或公开分享
   - 生产环境建议使用密钥管理服务（如 AWS KMS、HashiCorp Vault）

3. **密码哈希**
   - `ADMIN_PASSWORD_HASH` 应使用 bcrypt 生成
   - 不要存储明文密码
   - 生成示例：
     ```typescript
     import bcrypt from 'bcrypt';
     const hash = await bcrypt.hash('your-password', 10);
     ```

4. **环境隔离**
   - 开发环境和生产环境使用不同的 `.env` 文件
   - 生产环境的环境变量通过部署平台的密钥管理功能配置

## 常见问题

### Q: 为什么 Web 项目使用 .env.local 而不是 .env？

A: Next.js 推荐使用 `.env.local` 存储本地开发环境变量，该文件优先级高于 `.env`，且默认不会被提交到 Git。

### Q: 如果只想修改某个子项目的环境变量怎么办？

A: 仍然需要修改根目录的 `.env` 文件，然后重新运行 `pnpm env:generate`。这样可以确保所有环境变量保持同步。

### Q: 部署到生产环境时如何配置环境变量？

A: 生产环境通常通过平台提供的环境变量管理功能配置（如 Vercel、Railway、AWS 等）。每个子项目读取各自需要的环境变量。

### Q: 如何获取 Supabase 的密钥？

A:
1. 本地开发：运行 `supabase start` 后，密钥会显示在终端输出中
2. 云端项目：在 Supabase 项目设置的 API 页面可以找到

### Q: 合约地址在哪里获取？

A: 运行 `pnpm contracts:deploy` 部署合约后，地址会显示在终端输出中。将这些地址填入 `.env` 文件。

## 相关文档

- [apps/api/ENV.md](../apps/api/ENV.md) - API 环境变量详细说明
- [根目录 .env.example](./.env.example) - 环境变量模板
