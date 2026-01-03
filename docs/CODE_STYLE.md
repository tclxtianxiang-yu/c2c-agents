# 代码风格规范

本文档说明 C2C Agents 项目的代码风格规范和自动化工具配置。

---

## 工具选择：Biome

我们使用 [Biome](https://biomejs.dev/) 作为项目的格式化和 lint 工具，替代传统的 ESLint + Prettier 组合。

**为什么选择 Biome？**

- ⚡ **性能极快**：比 ESLint + Prettier 快 25-100 倍
- 🔧 **零配置**：开箱即用的合理默认值
- 🎯 **统一工具**：格式化 + lint + import 排序一体化
- 📦 **单一依赖**：不需要安装多个插件和配置文件
- 🔄 **兼容性好**：与现有 TypeScript/React 项目无缝集成

---

## 自动化流程

### 1. 保存时自动格式化（VSCode）

项目已配置 `.vscode/settings.json`，使用 VSCode 的开发者会自动享受保存时格式化：

```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.biome": "explicit"
  }
}
```

**安装 VSCode 扩展**：

```bash
# 在 VSCode 中搜索并安装
Biome (biomejs.biome)
```

### 2. 提交时自动格式化（Git Hooks）

项目配置了 Husky + lint-staged，在每次 `git commit` 时自动格式化暂存文件：

```bash
# .husky/pre-commit
pnpm exec lint-staged

# .lintstagedrc.json
{
  "*.{js,jsx,ts,tsx,json,css,md}": [
    "biome check --write --no-errors-on-unmatched"
  ]
}
```

### 3. Push 前强制检查（Git Hooks）

在 `git push` 前会强制检查所有代码格式：

```bash
# .husky/pre-push
pnpm format:check

# 如果失败，必须先格式化再 push
```

---

## 代码风格规则

### 基础格式

```typescript
// ✅ 推荐：单引号、分号、2 空格缩进
const message = 'Hello World';

// ✅ 推荐：箭头函数总是带括号
const add = (a, b) => a + b;

// ✅ 推荐：对象属性按需引号
const config = {
  apiUrl: 'https://api.example.com',
  'Content-Type': 'application/json',
};

// ✅ 推荐：尾随逗号（ES5 风格）
const array = [
  'item1',
  'item2',
];
```

### TypeScript 规则

```typescript
// ✅ 推荐：使用 import type
import type { OrderStatus } from '@c2c-agents/shared';

// ❌ 禁止：类型导入使用普通 import（会被自动修复）
import { OrderStatus } from '@c2c-agents/shared';

// ✅ 推荐：使用 const
const MAX_RETRY = 3;

// ❌ 禁止：使用 var
var count = 0;

// ⚠️ 警告：避免使用 any（测试文件除外）
const data: any = {};

// ✅ 推荐：明确的类型注解
const data: Record<string, unknown> = {};
```

### React/JSX 规则

```tsx
// ✅ 推荐：JSX 属性使用双引号
<Button className="primary" onClick={handleClick} />

// ✅ 推荐：单标签自闭合
<Image src="/logo.png" alt="Logo" />

// ✅ 推荐：多属性换行
<Button
  variant="primary"
  size="large"
  onClick={handleClick}
  disabled={isLoading}
>
  Submit
</Button>
```

### 导入顺序

Biome 会自动组织和排序导入语句：

```typescript
// ✅ 自动排序后的导入顺序
import { useEffect, useState } from 'react';

import type { OrderStatus } from '@c2c-agents/shared';
import { assertTransition } from '@c2c-agents/shared/state-machine';
import { PAIRING_TTL_HOURS } from '@c2c-agents/config';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
```

---

## 常用命令

```bash
# 检查代码格式（不修改）
pnpm format:check

# 格式化所有代码
pnpm format

# 运行 lint 检查
pnpm lint

# 自动修复 lint 问题
pnpm lint:fix

# 一键格式化 + lint + 修复（推荐）
pnpm check
```

---

## 配置文件说明

### [biome.json](../biome.json)

```json
{
  "$schema": "https://biomejs.dev/schemas/2.3.10/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignoreUnknown": false,
    "includes": [
      "**",
      "!**/node_modules",
      "!**/dist",
      "!**/.next",
      "!**/build",
      "!**/artifacts",
      "!assets/**"
    ]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "always",
      "trailingCommas": "es5"
    }
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  }
}
```

### 关键配置说明

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `indentWidth` | 2 | 使用 2 空格缩进 |
| `lineWidth` | 100 | 单行最大 100 字符 |
| `quoteStyle` | `'single'` | 字符串使用单引号 |
| `jsxQuoteStyle` | `"double"` | JSX 属性使用双引号 |
| `semicolons` | `always` | 总是使用分号 |
| `trailingCommas` | `es5` | ES5 风格尾随逗号 |
| `arrowParentheses` | `always` | 箭头函数总是带括号 |

---

## 特殊规则覆盖

### CSS 文件（允许 Tailwind）

```json
{
  "overrides": [
    {
      "includes": ["**/*.css"],
      "linter": {
        "rules": {
          "suspicious": {
            "noUnknownAtRules": "off"
          }
        }
      }
    }
  ]
}
```

### 测试文件（允许 any）

```json
{
  "overrides": [
    {
      "includes": ["**/*.test.ts", "**/*.spec.ts"],
      "linter": {
        "rules": {
          "suspicious": {
            "noExplicitAny": "off"
          }
        }
      }
    }
  ]
}
```

### 配置文件（允许 var）

```json
{
  "overrides": [
    {
      "includes": ["**/hardhat.config.ts", "**/next.config.ts"],
      "linter": {
        "rules": {
          "style": {
            "useConst": "off"
          }
        }
      }
    }
  ]
}
```

---

## 团队协作规范

### ✅ DO（应该做的）

- 在 VSCode 中安装 Biome 扩展
- 开启保存时自动格式化
- 提交代码前运行 `pnpm check`
- 如果 push 失败，运行 `pnpm format` 后重新提交

### ❌ DON'T（禁止做的）

- 不要使用 `git commit --no-verify` 跳过 hooks（除非紧急情况）
- 不要手动调整代码格式（交给 Biome 自动处理）
- 不要安装 ESLint 或 Prettier 扩展（避免冲突）
- 不要修改 `.vscode/settings.json` 中的格式化配置

### 🚨 Git Hooks 失败怎么办？

**场景 1：Pre-commit hook 失败**

```bash
# 错误信息
✖ biome check --write failed

# 解决方案
pnpm check          # 手动格式化
git add .           # 重新暂存
git commit -m "..." # 重新提交
```

**场景 2：Pre-push hook 失败**

```bash
# 错误信息
❌ Format check failed! Please run 'pnpm format' before pushing.

# 解决方案
pnpm format         # 格式化所有代码
git add .           # 暂存修改
git commit -m "chore: format code"
git push            # 重新推送
```

**场景 3：紧急修复需要跳过 hooks**

```bash
# ⚠️ 仅在紧急情况下使用
git commit --no-verify -m "hotfix: critical bug"

# ✅ 事后必须补充格式化提交
pnpm format
git add .
git commit -m "chore: format code after hotfix"
```

---

## 常见问题

### Q1: 为什么选择 Biome 而不是 ESLint + Prettier？

**A**: Biome 是 Rust 编写的现代化工具，性能远超传统工具链，且配置更简单。对于 Monorepo 项目，Biome 的速度优势尤为明显。

### Q2: Biome 会影响现有的 ESLint 配置吗？

**A**: 项目已移除 Prettier，但保留了 ESLint 用于 Next.js 特定规则。Biome 和 ESLint 可以共存，但格式化由 Biome 统一处理。

### Q3: 如何在 CI/CD 中集成 Biome？

**A**: 在 CI 中添加格式化检查步骤：

```yaml
- name: Check code format
  run: pnpm format:check

- name: Run lint
  run: pnpm lint
```

### Q4: 团队成员不使用 VSCode 怎么办？

**A**: Biome 支持多种编辑器（WebStorm、Vim、Neovim 等），也可以依赖 Git hooks 确保代码格式统一。

### Q5: 如何禁用某个特定规则？

**A**: 在 `biome.json` 的 `linter.rules` 中添加规则覆盖：

```json
{
  "linter": {
    "rules": {
      "suspicious": {
        "noExplicitAny": "off"
      }
    }
  }
}
```

---

## 参考资源

- [Biome 官方文档](https://biomejs.dev/)
- [Biome 规则列表](https://biomejs.dev/linter/rules/)
- [Biome vs Prettier 性能对比](https://biomejs.dev/blog/biome-wins-prettier-challenge/)
- [Husky 官方文档](https://typicode.github.io/husky/)
- [lint-staged 官方文档](https://github.com/okonet/lint-staged)
