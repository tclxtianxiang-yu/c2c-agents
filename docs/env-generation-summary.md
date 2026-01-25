# 环境变量自动生成功能说明

## 概述

本项目实现了从根目录 `.env` 自动生成 apps/ 下各项目所需环境变量文件的功能。

## 实现内容

### 1. 自动生成脚本

**文件位置：** `scripts/generate-env.js`

**功能：**
- 读取根目录 `.env` 文件
- 解析环境变量（跳过注释和空行）
- 根据预定义的变量列表生成各子项目的环境变量文件
- 在生成的文件中添加警告注释，提醒不要手动编辑

**生成的文件：**
- `apps/api/.env` - API 后端环境变量（16 个变量）
- `apps/web/.env.local` - Web 前端环境变量（9 个变量）
- `apps/contracts` - 直接从根目录读取，无需生成

### 2. NPM 脚本

在 `package.json` 中添加了命令：
```json
{
  "scripts": {
    "env:generate": "node scripts/generate-env.js"
  }
}
```

使用方法：
```bash
pnpm env:generate
```

### 3. 环境变量模板更新

更新了 `.env.example`，添加了前端所需的变量：
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_QUEUE_MAX_N`

### 4. 文档

创建了以下文档：

1. **ENV_SETUP_GUIDE.md** - 快速配置指南
   - 3 步快速开始
   - 获取各种密钥和地址的方法
   - 环境变量说明表格
   - 常见问题解答

2. **docs/env-setup.md** - 完整环境变量配置文档
   - 详细的环境变量说明
   - 文件结构说明
   - 安全注意事项
   - 修改流程

3. **scripts/README.md** - 脚本使用说明
   - 脚本功能详解
   - 变量分配规则
   - 注意事项

## 环境变量分配规则

### API 后端变量 (apps/api/.env)

包含所有服务端和敏感配置：
```
NODE_ENV
DATABASE_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
CHAIN_RPC_URL
MOCK_USDT_ADDRESS
ESCROW_ADDRESS
PLATFORM_OPERATOR_PRIVATE_KEY
MIN_CONFIRMATIONS
QUEUE_MAX_N
PAIRING_TTL_HOURS
AUTO_ACCEPT_HOURS
AUTO_ACCEPT_SCAN_INTERVAL_MINUTES
PLATFORM_FEE_RATE
ADMIN_USERNAME
ADMIN_PASSWORD_HASH
```

### Web 前端变量 (apps/web/.env.local)

仅包含公开变量（NEXT_PUBLIC_ 前缀）：
```
NEXT_PUBLIC_CHAIN_ID
NEXT_PUBLIC_CHAIN_RPC_URL
NEXT_PUBLIC_MOCK_USDT_ADDRESS
NEXT_PUBLIC_ESCROW_ADDRESS
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
NEXT_PUBLIC_API_BASE_URL
NEXT_PUBLIC_QUEUE_MAX_N
```

### Contracts 配置

通过 `hardhat.config.ts` 直接从根目录 `.env` 读取：
```typescript
dotenvConfig({ path: resolve(__dirname, '../../.env') });
```

使用的变量：
- `CHAIN_RPC_URL`
- `PLATFORM_OPERATOR_PRIVATE_KEY`

## 使用流程

```
┌─────────────────┐
│  1. 创建 .env   │  cp .env.example .env
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  2. 编辑 .env   │  填写实际值（密钥、地址等）
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  3. 运行脚本    │  pnpm env:generate
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  自动生成：                         │
│  - apps/api/.env                    │
│  - apps/web/.env.local              │
└─────────────────────────────────────┘
```

## 修改流程

```
┌─────────────────┐
│  修改根 .env    │  编辑根目录的 .env 文件
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  重新生成       │  pnpm env:generate
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  子项目环境变量自动更新             │
└─────────────────────────────────────┘
```

⚠️ **重要：不要直接修改 apps/ 下的 .env 文件！**

## 安全措施

1. **Git 忽略**
   - `.env` 已添加到 `.gitignore`
   - `apps/api/.env` 和 `apps/web/.env.local` 被忽略
   - 只有 `.env.example` 会被提交

2. **文件头部警告**
   每个生成的文件都包含注释：
   ```
   # 此文件由 scripts/generate-env.js 自动生成
   # 请勿手动编辑，修改根目录 .env 后重新运行生成脚本
   ```

3. **环境变量隔离**
   - 前端只能访问 `NEXT_PUBLIC_` 前缀的变量
   - 后端敏感变量（私钥、Service Role Key）不会暴露给前端

## 技术实现细节

### 为什么用 JavaScript 而不是 TypeScript？

1. **零依赖**：不需要安装 `tsx` 或其他运行时
2. **启动快**：直接用 Node.js 运行，无需编译
3. **兼容性好**：适用于所有 Node.js 版本
4. **简单直接**：环境变量生成是简单的文本处理，不需要类型系统

### 解析逻辑

```javascript
function parseEnv(content) {
  const env = new Map();
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // 跳过注释和空行
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      env.set(match[1].trim(), match[2].trim());
    }
  }

  return env;
}
```

### 生成逻辑

```javascript
function generateEnvContent(variables, envMap, header) {
  const lines = [];
  lines.push('# ' + '='.repeat(60));
  lines.push(`# ${header}`);
  lines.push('# 此文件由 scripts/generate-env.js 自动生成');
  lines.push('# 请勿手动编辑，修改根目录 .env 后重新运行生成脚本');
  lines.push('# ' + '='.repeat(60));
  lines.push('');

  for (const key of variables) {
    const value = envMap.get(key) || '';
    lines.push(`${key}=${value}`);
  }

  return lines.join('\n') + '\n';
}
```

## 优势

1. **单一源头**：所有环境变量在根目录 `.env` 集中管理
2. **自动同步**：修改后运行脚本即可同步到所有子项目
3. **防止错误**：避免手动复制粘贴导致的配置不一致
4. **清晰分离**：API 和 Web 各自只包含需要的变量
5. **安全可靠**：生成的文件有明确警告，防止误编辑

## 未来扩展

如需添加新的环境变量：

1. 在 `.env.example` 中添加变量及说明
2. 在 `scripts/generate-env.js` 的对应数组中添加变量名：
   - `apiEnvVars` - 用于 API
   - `webEnvVars` - 用于 Web
3. 更新相关文档

## 参考文档

- [ENV_SETUP_GUIDE.md](../ENV_SETUP_GUIDE.md) - 快速配置指南
- [docs/env-setup.md](./env-setup.md) - 完整配置文档
- [apps/api/ENV.md](../apps/api/ENV.md) - API 环境变量校验说明
- [scripts/README.md](../scripts/README.md) - 脚本详细说明
