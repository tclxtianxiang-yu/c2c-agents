# @c2c-agents/ui

C2C Agents 项目的共享 UI 组件库，基于 shadcn/ui + Tailwind CSS 构建，采用深色 Web3 风格主题。

---

## 包概述

| 属性 | 值 |
|------|-----|
| 包名 | `@c2c-agents/ui` |
| 框架 | React 19 + TypeScript |
| 样式 | Tailwind CSS 3.4 + CSS Variables |
| 组件库 | shadcn/ui (new-york style) |
| 图标 | lucide-react |
| 主题 | 仅深色模式 |

---

## 目录结构

```
packages/ui/
├── components.json          # shadcn/ui 配置
├── tailwind.preset.ts       # Tailwind 预设（供消费方继承）
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts             # 主入口，导出 cn 等工具
    ├── lib/
    │   └── utils.ts         # cn() 类名合并工具
    ├── styles/
    │   └── globals.css      # CSS 变量定义（深色主题）
    └── components/
        ├── index.ts         # 组件统一导出
        └── ui/              # shadcn/ui 组件目录
            └── (button.tsx, card.tsx, ...)
```

---

## 导出接口

### 1. 主入口 (.)

```typescript
import { cn } from '@c2c-agents/ui';
```

### 2. 工具函数 (./lib/utils)

```typescript
import { cn } from '@c2c-agents/ui/lib/utils';

// cn() - 合并 Tailwind 类名，处理冲突
cn('px-4 py-2', 'px-6')           // → 'py-2 px-6'
cn('text-red-500', isActive && 'text-blue-500')
```

### 3. 样式文件 (./styles/globals.css)

```css
@import '@c2c-agents/ui/styles/globals.css';
/* 或相对路径 */
@import '../../../../packages/ui/src/styles/globals.css';
```

### 4. Tailwind 预设 (./tailwind.preset)

```typescript
import uiPreset from '@c2c-agents/ui/tailwind.preset';

const config = {
  presets: [uiPreset],
  content: ['./src/**/*', '../../packages/ui/src/**/*'],
};
```

### 5. UI 组件 (./components/ui/*)

```typescript
import { Button } from '@c2c-agents/ui/components/ui/button';
import { Card } from '@c2c-agents/ui/components/ui/card';
```

---

## 设计规范

### 配色方案（CSS 变量）

| 变量 | HSL 值 | 近似色值 | 用途 |
|------|--------|----------|------|
| `--background` | 222 47% 11% | #1a1f2e | 页面背景 |
| `--foreground` | 210 40% 98% | #f8fafc | 主文字 |
| `--card` | 222 47% 14% | #1f2937 | 卡片背景 |
| `--primary` | 204 100% 50% | #0099FF | 主色/CTA按钮 |
| `--secondary` | 222 47% 20% | #2d3748 | 次要按钮 |
| `--muted` | 222 47% 18% | #283141 | 禁用/占位 |
| `--accent` | 270 70% 60% | #a855f7 | 强调/紫色 |
| `--destructive` | 0 72% 51% | #ef4444 | 错误/删除 |
| `--success` | 142 71% 45% | #22c55e | 成功状态 |
| `--warning` | 45 93% 47% | #eab308 | 警告状态 |
| `--border` | 222 47% 20% | #2d3748 | 边框 |
| `--ring` | 204 100% 50% | #0099FF | 聚焦环 |

### Tailwind 类名映射

```css
/* 背景色 */
bg-background  bg-card  bg-primary  bg-secondary  bg-muted  bg-accent
bg-destructive  bg-success  bg-warning

/* 文字色 */
text-foreground  text-primary  text-muted-foreground

/* 边框 */
border-border  border-input

/* 圆角（基于 --radius: 0.5rem） */
rounded-lg (0.5rem)  rounded-md (0.375rem)  rounded-sm (0.25rem)
```

### Sidebar 专用变量

```
--sidebar, --sidebar-foreground, --sidebar-primary, --sidebar-accent, --sidebar-border
```

### 图表色

```
chart-1 (蓝)  chart-2 (绿)  chart-3 (紫)  chart-4 (黄)  chart-5 (红)
```

---

## 添加新组件

### 方法 1：在 packages/ui 目录执行

```bash
cd packages/ui
npx shadcn@latest add button card dialog input select
```

### 方法 2：指定多个组件

```bash
npx shadcn@latest add button card dialog dropdown-menu input label select textarea toast
```

### 组件安装后

1. 组件文件生成在 `src/components/ui/`
2. 需要在 `src/components/index.ts` 中添加导出
3. 运行 `pnpm build` 重新编译

---

## 在 apps/web 中集成

### 1. tailwind.config.ts

```typescript
import type { Config } from 'tailwindcss';
import uiPreset from '@c2c-agents/ui/tailwind.preset';

const config: Config = {
  presets: [uiPreset as Config],
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
};

export default config;
```

### 2. src/app/globals.css

```css
@import '../../../../packages/ui/src/styles/globals.css';
```

### 3. src/app/layout.tsx

```tsx
<html lang="zh-CN" className="dark">
  <body>{children}</body>
</html>
```

### 4. 使用组件

```tsx
import { Button } from '@c2c-agents/ui/components/ui/button';
import { cn } from '@c2c-agents/ui';

export default function Page() {
  return (
    <div className={cn('p-4', 'bg-card rounded-lg')}>
      <Button variant="default">主要按钮</Button>
      <Button variant="secondary">次要按钮</Button>
      <Button variant="destructive">危险按钮</Button>
    </div>
  );
}
```

---

## 依赖说明

### 生产依赖

| 包 | 版本 | 用途 |
|---|------|------|
| class-variance-authority | ^0.7.1 | 组件变体管理（CVA） |
| clsx | ^2.1.1 | 条件类名处理 |
| tailwind-merge | ^2.6.0 | Tailwind 类名冲突解决 |
| lucide-react | ^0.460.0 | 图标库 |
| tailwindcss-animate | ^1.0.7 | 动画插件 |

### Peer 依赖

```
react: ^18.0.0 || ^19.0.0
react-dom: ^18.0.0 || ^19.0.0
```

---

## shadcn/ui 配置 (components.json)

```json
{
  "style": "new-york",        // 组件风格
  "rsc": true,                // 支持 React Server Components
  "tsx": true,                // TypeScript
  "tailwind": {
    "cssVariables": true,     // 使用 CSS 变量
    "baseColor": "neutral"    // 基础灰色
  },
  "iconLibrary": "lucide",    // 图标库
  "aliases": {
    "components": "@c2c-agents/ui/components",
    "utils": "@c2c-agents/ui/lib/utils",
    "ui": "@c2c-agents/ui/components/ui"
  }
}
```

---

## 内置动画

```css
/* Tailwind 类名 */
animate-accordion-down
animate-accordion-up
animate-collapsible-down
animate-collapsible-up

/* 用于 Radix UI 的 Accordion、Collapsible 组件 */
```

---

## 常见问题

### Q: 如何修改主题色？
A: 编辑 `src/styles/globals.css` 中的 CSS 变量值

### Q: 组件样式如何自定义？
A: shadcn/ui 组件是复制到本地的源码，直接修改 `src/components/ui/*.tsx`

### Q: 为什么用 CSS 变量而不是直接写颜色？
A: 便于主题切换和统一管理，所有颜色从变量读取

### Q: apps/web 需要安装额外依赖吗？
A: 不需要，所有 UI 依赖都在 packages/ui 中，通过 Tailwind preset 共享配置
