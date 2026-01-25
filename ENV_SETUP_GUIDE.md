# 环境变量快速配置指南

本指南帮助您快速配置项目的环境变量。

## 快速开始（3 步）

### 1️⃣ 复制环境变量模板

```bash
cp .env.example .env
```

### 2️⃣ 编辑 .env 文件，填写实际值

打开 `.env` 文件，至少需要配置以下内容：

```bash
# Supabase 配置（本地开发运行 supabase start 后获取）
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=你的实际anon-key
SUPABASE_SERVICE_ROLE_KEY=你的实际service-role-key

# 区块链配置
CHAIN_RPC_URL=https://sepolia.infura.io/v3/你的INFURA_KEY

# 合约地址（部署后填入）
MOCK_USDT_ADDRESS=0x你的合约地址
ESCROW_ADDRESS=0x你的合约地址

# 平台操作员私钥（用于合约部署和调用）
PLATFORM_OPERATOR_PRIVATE_KEY=0x你的私钥

# WalletConnect（从 https://cloud.walletconnect.com 获取）
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=你的project-id

# 管理员账号
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=使用bcrypt生成的密码哈希
```

### 3️⃣ 运行自动生成脚本

```bash
pnpm env:generate
```

✅ 完成！脚本会自动生成：
- `apps/api/.env` - API 后端环境变量
- `apps/web/.env.local` - Web 前端环境变量

## 获取必要的密钥和地址

### Supabase 密钥

**本地开发：**
```bash
cd infra/supabase
supabase start
```
启动后会显示 `anon key` 和 `service_role key`

**云端项目：**
在 [Supabase Dashboard](https://app.supabase.com) → 项目设置 → API 中查看

### Infura RPC URL

1. 访问 [Infura](https://infura.io)
2. 创建新项目
3. 选择 Sepolia 测试网
4. 复制 HTTPS 端点

### WalletConnect Project ID

1. 访问 [WalletConnect Cloud](https://cloud.walletconnect.com)
2. 创建新项目
3. 复制 Project ID

### 合约地址

部署合约后获取：
```bash
pnpm contracts:deploy
```
部署成功后会显示 `MockUSDT` 和 `Escrow` 的合约地址

### 管理员密码哈希

使用 bcrypt 生成（可以使用在线工具或 Node.js）：
```javascript
// Node.js 示例
const bcrypt = require('bcrypt');
const hash = bcrypt.hashSync('your-password', 10);
console.log(hash);
```

## 修改环境变量

当需要修改配置时：

1. **编辑根目录 `.env` 文件**（不要直接修改 apps/ 下的文件）
2. **重新运行生成脚本**：
   ```bash
   pnpm env:generate
   ```

⚠️ **重要：**
- 不要手动编辑 `apps/api/.env` 或 `apps/web/.env.local`
- 这些文件会在运行脚本时被覆盖

## 环境变量说明

### 后端变量（API）

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `DATABASE_URL` | PostgreSQL 数据库连接 | ✅ |
| `SUPABASE_URL` | Supabase 项目 URL | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role 密钥 | ✅ |
| `CHAIN_RPC_URL` | 区块链 RPC 节点 | ✅ |
| `MOCK_USDT_ADDRESS` | MockUSDT 合约地址 | ✅ |
| `ESCROW_ADDRESS` | Escrow 合约地址 | ✅ |
| `PLATFORM_OPERATOR_PRIVATE_KEY` | 平台操作员私钥 | ✅ |
| `MIN_CONFIRMATIONS` | 最小确认数 | ❌ (默认: 1) |
| `QUEUE_MAX_N` | 队列最大数量 | ❌ (默认: 10) |
| `PLATFORM_FEE_RATE` | 平台费率 | ❌ (默认: 0.15) |

### 前端变量（Web）

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名密钥 | ✅ |
| `NEXT_PUBLIC_CHAIN_RPC_URL` | 区块链 RPC URL | ✅ |
| `NEXT_PUBLIC_MOCK_USDT_ADDRESS` | MockUSDT 合约地址 | ✅ |
| `NEXT_PUBLIC_ESCROW_ADDRESS` | Escrow 合约地址 | ✅ |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect 项目 ID | ✅ |
| `NEXT_PUBLIC_API_BASE_URL` | API 后端地址 | ❌ (默认: http://localhost:3001) |

## 安全注意事项

⚠️ **切勿提交敏感信息到 Git！**

- `.env` 文件已添加到 `.gitignore`
- 只有 `.env.example` 会被提交（不包含真实密钥）
- 生产环境使用平台的密钥管理服务
- 不要在代码中硬编码密钥

## 常见问题

### Q: API 启动失败，提示环境变量验证错误？

A: 检查 `apps/api/.env` 是否存在，并确保所有必需变量都已正确填写。运行 `pnpm env:generate` 重新生成。

### Q: 前端无法连接到后端？

A: 检查 `NEXT_PUBLIC_API_BASE_URL` 是否正确。本地开发应设置为 `http://localhost:3001`。

### Q: WalletConnect 无法连接？

A: 确保 `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` 已正确配置，并且项目 ID 有效。

### Q: 合约调用失败？

A:
1. 检查合约地址是否正确
2. 确认 RPC URL 可访问
3. 验证私钥账户有足够的测试币

## 相关文档

- [完整环境变量文档](./docs/env-setup.md)
- [API 环境变量说明](./apps/api/ENV.md)
- [脚本使用说明](./scripts/README.md)

## 需要帮助？

如果遇到问题，请检查：
1. `.env` 文件格式是否正确（`KEY=VALUE`，无空格）
2. 是否运行了 `pnpm env:generate`
3. 所有必需的环境变量是否都已填写
