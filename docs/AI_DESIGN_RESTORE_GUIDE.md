# AI 设计稿还原指南

> 本文档指导开发者如何使用 AI（Claude Code / GPT-4）基于 Stitch 设计稿完美还原页面

---

## 📁 设计资源位置

所有设计稿位于 `assets/stitch_homepage_dashboard/`，每个页面包含：
- `code.html` - 完整的 HTML + Tailwind CSS 实现
- `screen.png` - 设计稿截图

---

## 🚀 快速开始

### 标准 Prompt 模板

```markdown
@assets/stitch_homepage_dashboard/[页面名称]/code.html
@assets/stitch_homepage_dashboard/[页面名称]/screen.png
@docs/AI_DESIGN_RESTORE_GUIDE.md

请帮我基于这个 Stitch 设计稿，使用 Next.js 15 + shadcn/ui 实现 [页面名称]，要求：

1. **完全复刻设计**：
   - 使用 Stitch HTML 中的 Tailwind 配置（颜色、字体、阴影已在 tailwind.config.ts 中）
   - 保持像素级的布局一致性
   - 复用所有 class 名称和结构

2. **技术栈适配**：
   - 转换为 Next.js 15 App Router 组件（TypeScript）
   - 使用 @c2c-agents/ui 中的 shadcn/ui 组件（Button、Card、Input 等）
   - 图标使用 lucide-react 替代 Material Symbols
   - 响应式适配（mobile-first，断点：sm/md/lg/xl）

3. **组件拆分**：
   - Header → 独立可复用组件
   - 列表项 → Card 组件
   - 筛选器 → Filter 组件
   - 按职责拆分，单文件不超过 300 行

4. **状态管理**：
   - 使用 React Hook（useState/useEffect）
   - 表单使用 react-hook-form + zod 校验
   - 异步数据使用 SWR 或 React Query

5. **类型安全**：
   - Props 接口必须定义
   - Mock 数据结构对齐 @c2c-agents/shared 的 DTO
   - 不使用 `any` 类型

6. **代码规范**：
   - 遵守 Biome 格式化规则（2 spaces，单引号，总是分号）
   - 遵守 Code Ownership 规则（不修改 packages/shared、packages/config）
   - 使用 `@c2c-agents/shared` 导入枚举和状态类型

**输出要求**：
- 提供完整的文件路径和代码
- 标注需要新增的 shadcn/ui 组件（如需安装）
- 说明与设计稿的差异点（如有）
- 列出需要对接的 API 接口
```

---

## 📋 页面清单

| 页面名称 | HTML 路径 | 截图路径 | 负责人 | 状态 |
|---------|-----------|---------|--------|------|
| 首页/任务广场 | `首页_/_任务广场/code.html` | `首页_/_任务广场/screen.png` | Owner #2 | 🔲 待开发 |
| 任务详情页 | `任务详情页/code.html` | `任务详情页/screen.png` | Owner #3 | 🔲 待开发 |
| Agent 市场 | `agents_市场/code.html` | `agents_市场/screen.png` | Owner #4 | 🔲 待开发 |
| Agent 详情页 | `agent_详情页/code.html` | `agent_详情页/screen.png` | Owner #4 | 🔲 待开发 |
| B 工作台 | `b_的工作台/code.html` | `b_的工作台/screen.png` | Owner #5 | 🔲 待开发 |
| 验收与评价 | `验收与评价/code.html` | `验收与评价/screen.png` | Owner #5 | 🔲 待开发 |
| 发布任务页 | `发布任务页/code.html` | `发布任务页/screen.png` | Owner #2 | 🔲 待开发 |
| 管理员仲裁 | `管理员仲裁/code.html` | `管理员仲裁/screen.png` | Owner #6 | 🔲 待开发 |
| 钱包/账户中心 | `钱包/账户中心/code.html` | `钱包/账户中心/screen.png` | Owner #2 | 🔲 待开发 |

---

## 🎨 设计 Token 配置

所有设计 Token 已提取到 `apps/web/tailwind.config.ts`：

### 颜色系统
```typescript
colors: {
  primary: '#13a4ec',           // 主题蓝色
  'primary-hover': '#0e8bc9',   // 主题蓝色悬停
  'background-light': '#f6f7f8', // 浅色背景
  'background-dark': '#111618',  // 深色背景
  'card-dark': '#1c2327',        // 卡片深色背景
  'border-dark': '#283339',      // 深色边框
  'text-secondary': '#9db0b9',   // 次要文本颜色
}
```

### 字体系统
```typescript
fontFamily: {
  display: ['Public Sans', 'Noto Sans', 'sans-serif'],
  body: ['Public Sans', 'Noto Sans', 'sans-serif'],
}
```

### 阴影系统
```typescript
boxShadow: {
  glow: '0 0 15px rgba(19,164,236,0.3)',       // 发光效果
  'glow-hover': '0 0 25px rgba(19,164,236,0.5)', // 悬停发光
}
```

### 圆角系统
```typescript
borderRadius: {
  DEFAULT: '0.25rem',  // 4px
  lg: '0.5rem',        // 8px
  xl: '0.75rem',       // 12px
  '2xl': '1rem',       // 16px
  full: '9999px',      // 完全圆角
}
```

---

## 🛠️ 技术栈映射表

| Stitch 设计 | Next.js 实现 | 说明 |
|------------|--------------|------|
| `<button class="...">` | `<Button variant="..." />` | 使用 shadcn/ui Button |
| `<input type="text">` | `<Input />` | 使用 shadcn/ui Input |
| `<div class="card">` | `<Card><CardContent /></Card>` | 使用 shadcn/ui Card |
| Material Symbols 图标 | `<Icon />` from lucide-react | 映射表见下方 |
| Tailwind CDN | `tailwind.config.ts` | 配置已提取 |
| 内联样式 | CSS Modules / Tailwind | 避免内联样式 |

---

## 🎯 图标映射表（Material Symbols → Lucide React）

| Material Symbol | Lucide React | 导入 |
|----------------|--------------|------|
| `hub` | `Network` | `import { Network } from 'lucide-react'` |
| `publish` | `Send` | `import { Send } from 'lucide-react'` |
| `smart_toy` | `Bot` | `import { Bot } from 'lucide-react'` |
| `search` | `Search` | `import { Search } from 'lucide-react'` |
| `tune` | `SlidersHorizontal` | `import { SlidersHorizontal } from 'lucide-react'` |
| `notifications` | `Bell` | `import { Bell } from 'lucide-react'` |
| `account_balance_wallet` | `Wallet` | `import { Wallet } from 'lucide-react'` |
| `filter_list` | `Filter` | `import { Filter } from 'lucide-react'` |
| `star` | `Star` | `import { Star } from 'lucide-react'` |
| `check_circle` | `CheckCircle2` | `import { CheckCircle2 } from 'lucide-react'` |

完整映射：https://lucide.dev/icons/

---

## 📦 常用 shadcn/ui 组件安装

```bash
# 进入 UI 包目录
cd packages/ui

# 安装常用组件
npx shadcn@latest add button card input badge avatar dropdown-menu dialog
npx shadcn@latest add select tabs separator skeleton toast
```

---

## 🔄 开发工作流

### 步骤 1：AI 生成静态布局

```markdown
@assets/stitch_homepage_dashboard/首页_/_任务广场/code.html
@assets/stitch_homepage_dashboard/首页_/_任务广场/screen.png

请先生成静态布局，包括：
1. 页面容器（apps/web/src/app/page.tsx）
2. Header 组件
3. TaskCard 组件（使用 shadcn/ui Card）
4. FilterBar 组件

暂不实现交互逻辑，使用 Mock 数据。
```

### 步骤 2：添加交互逻辑

```markdown
基于上一步的静态布局，添加以下交互：
1. 搜索框实时筛选
2. 筛选器多选
3. 任务卡片点击跳转
4. Connect Wallet 按钮（集成 RainbowKit）

使用 React Hook 管理状态。
```

### 步骤 3：对接后端 API

```markdown
@docs/PRD.md（引用对应章节）

请对接以下 API：
1. GET /api/tasks - 获取任务列表
2. POST /api/tasks/search - 搜索任务

使用 SWR 处理数据加载和缓存。
```

---

## ⚠️ 常见问题

### Q1: AI 生成的代码不符合项目规范怎么办？

**A**: 在生成后运行：
```bash
pnpm check        # 自动格式化 + lint 修复
pnpm typecheck    # 类型检查
```

如果有错误，让 AI 修复：
```markdown
运行 pnpm check 报错：[错误信息]
请修复这些问题。
```

### Q2: 设计稿中的交互逻辑 AI 无法推断？

**A**: 补充业务上下文：
```markdown
@docs/PRD.md（引用对应章节）

这个按钮点击后应该触发 [具体业务逻辑]，
涉及订单状态从 [A] 转换到 [B]，
需要调用 @c2c-agents/shared 的状态机校验。
```

### Q3: 需要跨页面复用的组件怎么处理？

**A**:
1. 第一次出现时，放在 `apps/web/src/components/[页面名]/`
2. 第二次复用时，提取到 `apps/web/src/components/shared/`
3. 如果是通用 UI 组件，考虑放入 `packages/ui`

### Q4: Stitch 设计稿与实际需求有差异？

**A**:
1. 先按设计稿 100% 还原
2. 单独提 PR 说明调整原因
3. 让设计师更新 Stitch 源文件并重新导出

### Q5: 响应式适配如何处理？

**A**: Stitch HTML 已包含响应式 class：
```html
<!-- 示例：隐藏移动端，显示桌面端 -->
<div class="hidden md:block">Desktop Only</div>

<!-- 示例：移动端文字小，桌面端文字大 -->
<h1 class="text-lg md:text-2xl">Title</h1>
```

参考 Tailwind 断点：
- `sm:` - 640px
- `md:` - 768px
- `lg:` - 1024px
- `xl:` - 1280px

---

## 🎯 最佳实践

### 1. 组件拆分粒度

```
apps/web/src/
├── app/
│   └── page.tsx                    # 页面容器（150 行以内）
├── components/
│   ├── shared/                     # 跨页面共享组件
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   └── task-square/                # 任务广场专属组件
│       ├── TaskCard.tsx
│       ├── FilterBar.tsx
│       └── SearchInput.tsx
```

### 2. 类型定义规范

```typescript
// ✅ 正确：使用 @c2c-agents/shared 的类型
import { TaskStatus, TaskDTO } from '@c2c-agents/shared';

interface TaskCardProps {
  task: TaskDTO;
  onSelect: (taskId: string) => void;
}

// ❌ 禁止：重复定义类型
interface Task {
  status: string; // 应该用 TaskStatus 枚举
}
```

### 3. 状态管理规范

```typescript
// ✅ 正确：使用 Hook 管理状态
const [selectedTags, setSelectedTags] = useState<string[]>([]);
const [searchQuery, setSearchQuery] = useState('');

// ✅ 正确：使用 SWR 管理服务端状态
const { data: tasks, error } = useSWR('/api/tasks', fetcher);

// ❌ 禁止：直接操作 DOM
document.getElementById('search').value = 'xxx';
```

### 4. 性能优化

```typescript
// ✅ 正确：使用 Next.js Image
import Image from 'next/image';
<Image src="/avatar.png" alt="Avatar" width={40} height={40} />

// ✅ 正确：列表使用 key
{tasks.map(task => (
  <TaskCard key={task.id} task={task} />
))}

// ✅ 正确：防抖搜索
const debouncedSearch = useMemo(
  () => debounce((query: string) => setSearchQuery(query), 300),
  []
);
```

---

## 📝 示例对话

### 示例 1：生成任务广场首页

**用户**：
```markdown
@assets/stitch_homepage_dashboard/首页_/_任务广场/code.html
@assets/stitch_homepage_dashboard/首页_/_任务广场/screen.png
@docs/AI_DESIGN_RESTORE_GUIDE.md

请帮我实现任务广场首页
```

**AI 输出**：
```typescript
// apps/web/src/app/page.tsx
// apps/web/src/components/shared/Header.tsx
// apps/web/src/components/task-square/TaskCard.tsx
// apps/web/src/components/task-square/FilterBar.tsx
// ... (完整代码)
```

### 示例 2：修复格式化问题

**用户**：
```markdown
运行 pnpm check 报错：
[lint] apps/web/src/app/page.tsx:15:3 ━ Missing semicolon

请修复
```

**AI**：自动添加分号并重新格式化

---

## 🔗 相关文档

- [项目总览](../CLAUDE.md)
- [全局约束](./CONTEXT.md)
- [产品需求文档](./PRD.md)
- [代码风格指南](./CODE_STYLE.md)
- [shadcn/ui 文档](https://ui.shadcn.com)
- [Tailwind CSS 文档](https://tailwindcss.com)
- [Lucide Icons](https://lucide.dev)

---

**最后更新**: 2026-01-06
**维护者**: Owner #1
