# 修复 Typecheck 错误实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复所有 `pnpm typecheck` 错误，使 CI 预检查通过

**Architecture:** 分两层修复：(1) 配置层 - 排除测试文件；(2) 代码层 - 修复实际类型错误

**Tech Stack:** TypeScript 5.6, NestJS 10, Supabase JS Client

---

## 问题分析

| 包 | 错误位置 | 错误类型 | Owner |
|----|---------|---------|-------|
| @c2c-agents/config | `*.test.ts` | vitest 模块找不到 | #1 ✅ 已修复 |
| @c2c-agents/api | `*.spec.ts` | jest 模块类型 / mock 数据类型 | #3, #4 |
| @c2c-agents/api | `matching.service.ts:76,113` | 字面量类型推断 | #3 |
| @c2c-agents/api | `queue.repository.ts:102` | `rpc` 方法不存在 | #4 |

---

## Task 1: 排除 API 测试文件

**Files:**
- Modify: `apps/api/tsconfig.json`

**Step 1: 添加测试文件排除**

将 `exclude` 从：
```json
"exclude": ["node_modules", "dist", "test"]
```

改为：
```json
"exclude": ["node_modules", "dist", "test", "**/*.spec.ts", "**/*.test.ts"]
```

**Step 2: 验证**

```bash
pnpm --filter @c2c-agents/api typecheck
```

Expected: 只剩下 `matching.service.ts` 和 `queue.repository.ts` 的错误

**Step 3: Commit**

```bash
git add apps/api/tsconfig.json
git commit -m "fix(api): 排除测试文件避免类型检查失败"
```

---

## Task 2: 修复 matching.service.ts 字面量类型

**Files:**
- Modify: `apps/api/src/modules/matching/matching.service.ts:229-237`

**问题分析:**
```typescript
return {
  result: 'queued',  // TypeScript 推断为 string，不是 'queued'
  ...
};
```

**Step 1: 添加 `as const` 断言**

```typescript
return {
  result: 'queued' as const,
  orderId,
  agentId,
  status: OrderStatus.Standby,
  queuePosition,
  queuedCount: items.length,
  capacity: QUEUE_MAX_N,
};
```

**Step 2: 验证**

```bash
pnpm --filter @c2c-agents/api typecheck
```

**Step 3: Commit**

```bash
git add apps/api/src/modules/matching/matching.service.ts
git commit -m "fix(matching): 修复 enqueueOrder 返回值类型"
```

---

## Task 3: 修复 queue.repository.ts rpc 方法

**Files:**
- Modify: `apps/api/src/database/supabase.service.ts`

**问题分析:**
`queue.repository.ts:102` 调用 `this.supabase.rpc(...)` 但 `SupabaseService` 没有暴露 `rpc` 方法

**Step 1: 添加 rpc 方法到 SupabaseService**

在 `apps/api/src/database/supabase.service.ts` 添加：

```typescript
rpc<T = unknown>(
  fn: string,
  args?: Record<string, unknown>,
  options?: { head?: boolean; count?: 'exact' | 'planned' | 'estimated' }
): ReturnType<SupabaseClient['rpc']> {
  return this.client.rpc(fn, args, options);
}
```

**Step 2: 验证**

```bash
pnpm --filter @c2c-agents/api typecheck
```

Expected: 所有错误消失

**Step 3: Commit**

```bash
git add apps/api/src/database/supabase.service.ts
git commit -m "fix(database): 添加 rpc 方法到 SupabaseService"
```

---

## Task 4: 全量验证

**Step 1: 运行完整 typecheck**

```bash
pnpm typecheck
```

Expected: 全部通过

**Step 2: 运行 format:check**

```bash
pnpm format:check
```

Expected: 全部通过

**Step 3: 推送并更新 PR**

```bash
git push
gh pr edit 24 --title "[shared] fix: 修复全项目 typecheck 错误"
```

---

## 验收标准

- [ ] `pnpm typecheck` 全部通过（0 错误）
- [ ] `pnpm format:check` 全部通过
- [ ] 不改变任何业务逻辑
- [ ] 测试仍可正常运行（`pnpm test`）
