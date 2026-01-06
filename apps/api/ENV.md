# API 环境变量校验说明

> **目标读者**: 运行 API 的开发/运维同学
> **用途**: 明确 API 进程启动时的 env 校验与失败策略

---

## 校验入口

API 启动时在 `apps/api/src/main.ts` 调用 `validateApiEnv()` 执行校验。  
校验失败会 **fail fast**，避免带错配置启动。

对应实现：`apps/api/src/config/env.ts`

---

## 必填变量

以下变量在 API 进程中 **必须配置**:

- `CHAIN_RPC_URL`
- `MOCK_USDT_ADDRESS`
- `ESCROW_ADDRESS`
- `PLATFORM_OPERATOR_PRIVATE_KEY`

---

## 校验规则

- `CHAIN_RPC_URL` 必须是 `http/https` 的合法 URL
- `MOCK_USDT_ADDRESS` / `ESCROW_ADDRESS` 必须是合法 EVM 地址，且 **不能为零地址**
- `PLATFORM_OPERATOR_PRIVATE_KEY` 允许无 `0x` 前缀，内部会自动补全

---

## 常见错误信息

- `CHAIN_RPC_URL is required`
- `CHAIN_RPC_URL must be a valid http/https URL`
- `MOCK_USDT_ADDRESS is invalid`
- `MOCK_USDT_ADDRESS must not be zero address`
- `ESCROW_ADDRESS is invalid`
- `ESCROW_ADDRESS must not be zero address`
- `PLATFORM_OPERATOR_PRIVATE_KEY is invalid`

---

## 与 @c2c-agents/config 的关系

`@c2c-agents/config` 仅提供 **公共可用配置**，不负责 server-only 变量校验。  
链上敏感变量由 API 进程在启动时校验，避免前端构建链路依赖私钥。
