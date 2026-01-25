# 选择结果 UI 优化 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 优化执行结果选择的用户体验，包括弹窗自动关闭和 TaskCard 自动匹配按钮改为直接跳转。

**Architecture:** 纯前端 UI 改动，无需修改后端逻辑。当前系统已完整支持多选（0-3 个 Agent 结果），后端会合并多个选中结果到单个 delivery。

**Tech Stack:** React, Next.js, shadcn/ui Dialog

---

## 背景分析

### 当前系统能力

**后端** (`apps/api/src/modules/execution/execution.service.ts`):
- DTO 接受 `selectedExecutionIds: string[]` 数组
- `@ArrayMaxSize(3)` 限制最多选择 3 个
- 选择 0 个 = 放弃任务，返回 Standby
- 选择 1-3 个 = 合并结果创建 delivery

**前端** (`SelectingActions.tsx`):
- 使用 `useState<string[]>([])` 跟踪多选
- 显示 "已选择: X / 3"
- 按钮文案根据选择数量变化

**结论**: 系统已完整支持多选，无需改为单选。

---

## Task 1: 小球弹窗选择后自动关闭

**问题**: 用户点击 "选择此结果" 或 "取消选择" 后，弹窗保持打开，需要手动点关闭。

**目标**: 点击选择/取消按钮后自动关闭弹窗。

**Files:**
- Modify: `apps/web/src/components/execution/ExecutionDetailModal.tsx:103-107`

**Step 1: 修改 onSelect 调用逻辑**

在 `ExecutionDetailModal.tsx` 中，修改选择按钮的 onClick 处理：

```tsx
// Before:
<Button onClick={onSelect} variant={isSelected ? 'secondary' : 'default'}>
  {isSelected ? '取消选择' : '选择此结果'}
</Button>

// After:
<Button
  onClick={() => {
    onSelect();
    onClose();
  }}
  variant={isSelected ? 'secondary' : 'default'}
>
  {isSelected ? '取消选择' : '选择此结果'}
</Button>
```

**Step 2: 验证类型检查**

Run: `pnpm --filter @c2c-agents/web typecheck`
Expected: 无错误

**Step 3: 格式化代码**

Run: `pnpm format`
Expected: 代码格式化完成

**Step 4: Commit**

```bash
git add apps/web/src/components/execution/ExecutionDetailModal.tsx
git commit -m "feat(web): 选择执行结果后自动关闭弹窗"
```

---

## Task 2: TaskCard 自动匹配按钮改为直接跳转

**问题**: 当前点击 TaskCard 的 "自动匹配" 按钮会打开一个弹窗（TaskDetailModal），再在弹窗内触发自动匹配。

**目标**: 点击 "自动匹配" 按钮直接跳转到 `/tasks/[id]` 详情页，并在页面加载后立即触发自动匹配。

**Files:**
- Modify: `apps/web/src/components/pages/TaskDashboard.tsx:585-588`
- Modify: `apps/web/src/components/tasks/TaskCard.tsx:53-57,96-103`
- Modify: `apps/web/src/app/tasks/[id]/page.tsx` (添加 URL 参数支持)
- Modify: `apps/web/src/app/tasks/[id]/_components/StandbyActions.tsx` (添加自动触发逻辑)

### Step 1: 修改 TaskCard 组件

**删除 onAutoMatch 和 onManualSelect props**，改用 Link 直接跳转：

```tsx
// TaskCard.tsx - 删除以下代码:
const handleAutoMatch = (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  onAutoMatch?.(task.id);
};
const handleManualSelect = (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  onManualSelect?.(task.id);
};

// 修改按钮区域:
{isStandby ? (
  <div className="grid gap-2">
    <Link
      href={`/tasks/${task.id}?action=auto`}
      onClick={(e) => e.stopPropagation()}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_10px_30px_rgba(14,116,219,0.35)] transition hover:opacity-90"
    >
      <span aria-hidden="true">⚡</span>
      自动匹配 (Auto Match)
    </Link>
    <Link
      href={`/tasks/${task.id}?action=manual`}
      onClick={(e) => e.stopPropagation()}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background/60 px-4 py-2.5 text-sm font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-primary"
    >
      <span aria-hidden="true">🖐️</span>
      手动选择 (Select)
    </Link>
  </div>
) : ...
```

### Step 2: 修改 TaskCard Props 类型

```tsx
// TaskCard.tsx
type TaskCardProps = {
  task: TaskSummary;
  onViewStatus?: (taskId: string) => void;
  // 删除以下两行:
  // onAutoMatch?: (taskId: string) => void;
  // onManualSelect?: (taskId: string) => void;
};

export function TaskCard({ task, onViewStatus }: TaskCardProps) {
  // ...
}
```

### Step 3: 修改 TaskDashboard 组件

删除 `handleAutoMatch` 和 `handleManualSelect` 函数，以及传递给 TaskCard 的 props：

```tsx
// TaskDashboard.tsx - 删除:
const handleAutoMatch = (taskId: string) => {
  setSelectedTaskId(taskId);
  setModalAction('auto');
};

const handleManualSelect = (taskId: string) => {
  setSelectedTaskId(taskId);
  setModalAction('manual');
};

// 修改 TaskCard 调用:
<TaskCard
  key={task.id}
  task={task}
  onViewStatus={handleViewDetail}
  // 删除: onAutoMatch={handleAutoMatch}
  // 删除: onManualSelect={handleManualSelect}
/>
```

### Step 4: 修改 Task 详情页支持 URL action 参数

修改 `apps/web/src/app/tasks/[id]/page.tsx`，读取 `searchParams.action` 并传递给 StandbyActions：

```tsx
// page.tsx - 在 TaskDetailPage 组件中:
type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ action?: 'auto' | 'manual' }>;
};

export default async function TaskDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { action } = await searchParams;

  // ... 获取 task 和 order ...

  // 传递 action 给 StandbyActions
  {order.status === OrderStatus.Standby && (
    <StandbyActions task={task} order={order} initialAction={action} />
  )}
}
```

### Step 5: 修改 StandbyActions 支持自动触发

```tsx
// StandbyActions.tsx
type StandbyActionsProps = {
  task: Task;
  order: Order;
  initialAction?: 'auto' | 'manual';
};

export function StandbyActions({ task, order, initialAction }: StandbyActionsProps) {
  // ... existing state ...
  const [actionTriggered, setActionTriggered] = useState(false);

  // 自动触发逻辑
  useEffect(() => {
    if (actionTriggered || isQueued) return;

    if (initialAction === 'auto') {
      setActionTriggered(true);
      void handleAutoMatch();
    } else if (initialAction === 'manual') {
      setActionTriggered(true);
      router.push(`/agents?taskId=${task.id}`);
    }
  }, [initialAction, actionTriggered, isQueued, handleAutoMatch, router, task.id]);

  // ... rest of component ...
}
```

### Step 6: 验证类型检查

Run: `pnpm --filter @c2c-agents/web typecheck`
Expected: 无错误

### Step 7: 格式化代码

Run: `pnpm format`

### Step 8: Commit

```bash
git add apps/web/src/components/tasks/TaskCard.tsx
git add apps/web/src/components/pages/TaskDashboard.tsx
git add apps/web/src/app/tasks/[id]/page.tsx
git add apps/web/src/app/tasks/[id]/_components/StandbyActions.tsx
git commit -m "feat(web): TaskCard 自动匹配按钮改为直接跳转到详情页"
```

---

## Task 3: 端到端验证

### Step 1: 启动开发服务器

Run: `pnpm dev`

### Step 2: 验证弹窗自动关闭

1. 创建任务并触发自动匹配
2. 等待 Agent 执行完成，进入 Selecting 状态
3. 点击任一小球打开弹窗
4. 点击 "选择此结果" 按钮
5. 确认弹窗自动关闭

### Step 3: 验证 TaskCard 直接跳转

1. 在任务列表页找到状态为 Standby 的任务
2. 点击 "自动匹配" 按钮
3. 确认直接跳转到 `/tasks/[id]?action=auto`
4. 确认页面加载后自动开始匹配流程

---

## 技术说明

### 为什么保留多选功能？

1. **后端已完整支持**: 合并多个结果到单个 delivery
2. **用户价值**: 可以综合多个 Agent 的优质输出
3. **向后兼容**: 不破坏现有功能

### 弹窗关闭时机

- 点击 "选择此结果" → 关闭弹窗 + 更新选择状态
- 点击 "取消选择" → 关闭弹窗 + 更新选择状态
- 点击 "关闭" 按钮 → 仅关闭弹窗

### URL 参数设计

- `?action=auto` → 自动触发匹配
- `?action=manual` → 跳转到 Agent 选择页
- 无参数 → 正常显示详情页

---

## Task 4: 小球视觉效果优化

**目标**:
1. 小球之间用线段连接（类似分子结构图）
2. 拖拽后有物理弹性动画效果
3. 拖拽后不要自动回弹到原位置

**Files:**
- Modify: `apps/web/src/components/execution/ExecutionOrbs.tsx`

### 实现方案

使用 D3.js 的 force simulation 实现物理效果：
- `d3.forceLink()` - 小球之间的连线和弹力
- `d3.forceManyBody()` - 小球之间的斥力
- `d3.forceCenter()` - 居中力
- 拖拽时暂停 simulation，松开后继续

### Step 1: 添加连线和物理模拟

详见代码实现。

### Step 2: Commit

```bash
git add apps/web/src/components/execution/ExecutionOrbs.tsx
git commit -m "feat(web): 小球添加连线和物理拖拽效果"
```
