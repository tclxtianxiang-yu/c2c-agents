# 并行 Agent 执行修复 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将三个 Agent 的 Mastra 执行从串行改为并行，提升任务执行效率。

**Architecture:** 将 `for...of await` 循环改为 `Promise.allSettled()` 并行执行，每个 Agent 独立执行并更新状态，所有执行完成后再统一转换订单状态。

**Tech Stack:** TypeScript, NestJS, Promise.allSettled

---

## 问题分析

当前代码 (`apps/api/src/modules/matching/matching.service.ts:420-466`):

```typescript
for (const execution of executions) {
  await this.mastraService.executeTask(...);  // 串行等待
}
```

修复后:

```typescript
await Promise.allSettled(
  executions.map(execution => this.executeOneAgent(execution, task))
);
```

---

### Task 1: 重构 triggerMastraExecutions 为并行执行

**Files:**
- Modify: `apps/api/src/modules/matching/matching.service.ts:413-478`

**Step 1: 提取单个 Agent 执行逻辑为独立方法**

在 `MatchingService` 类中添加新方法:

```typescript
/**
 * Execute a single agent and update execution status
 * Returns void - errors are caught and logged internally
 */
private async executeOneAgent(
  execution: Execution,
  task: { id: string; title?: string; type: string; description?: string }
): Promise<void> {
  try {
    // Update execution status to running
    await this.executionRepository.updateExecution(execution.id, {
      status: 'running',
      startedAt: new Date().toISOString(),
    });

    // Call Mastra to execute task
    const result = await this.mastraService.executeTask({
      agentId: execution.agentId,
      taskTitle: task.title,
      taskDescription: task.description ?? '',
      taskType: task.type,
    });

    // Update with Mastra runId and status
    await this.executionRepository.updateExecution(execution.id, {
      mastraRunId: result.runId,
      mastraStatus: result.status,
    });

    if (result.status === 'completed') {
      await this.executionRepository.updateExecution(execution.id, {
        status: 'completed',
        resultContent: result.content,
        resultPreview: result.preview,
        resultUrl: result.url,
        completedAt: new Date().toISOString(),
      });
    } else if (result.status === 'failed') {
      await this.executionRepository.updateExecution(execution.id, {
        status: 'failed',
        errorMessage: result.error,
        completedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    this.logger.error(`Failed to trigger Mastra execution for ${execution.id}:`, error);
    await this.executionRepository.updateExecution(execution.id, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      completedAt: new Date().toISOString(),
    });
  }
}
```

**Step 2: 修改 triggerMastraExecutions 使用 Promise.allSettled 并行执行**

替换整个 `triggerMastraExecutions` 方法:

```typescript
/**
 * Asynchronously trigger Mastra executions for selected agents IN PARALLEL
 * This method does not block the autoMatch return
 */
private triggerMastraExecutions(
  task: { id: string; title?: string; type: string; description?: string },
  order: { id: string },
  executions: Execution[],
  _agents: Array<{ id: string }>
): void {
  // Fire and forget - execute in background
  (async () => {
    // Execute all agents IN PARALLEL
    this.logger.log(`Starting parallel execution for ${executions.length} agents on order ${order.id}`);

    await Promise.allSettled(
      executions.map((execution) => this.executeOneAgent(execution, task))
    );

    // All executions finished - transition to selecting phase
    this.logger.log(
      `All executions completed for order ${order.id}, transitioning to selecting phase`
    );
    await this.repository.updateOrderStatus(order.id, OrderStatus.Selecting);
    await this.repository.updateOrderExecutionPhase(order.id, 'selecting');
    await this.repository.updateTaskCurrentStatus(task.id, OrderStatus.Selecting);
  })().catch((err) => {
    this.logger.error('Error in triggerMastraExecutions:', err);
  });
}
```

**Step 3: 验证代码编译通过**

Run: `pnpm --filter @c2c-agents/api typecheck`
Expected: 无错误

**Step 4: 格式化代码**

Run: `pnpm format`
Expected: 代码格式化完成

**Step 5: Commit**

```bash
git add apps/api/src/modules/matching/matching.service.ts
git commit -m "perf(matching): 将 Agent 执行从串行改为并行"
```

---

### Task 2: 端到端验证

**Step 1: 启动 API 服务**

Run: `pnpm --filter @c2c-agents/api dev`

**Step 2: 发布新任务并自动匹配**

1. 访问前端创建新任务
2. 点击自动匹配
3. 观察 API 日志，确认看到 "Starting parallel execution for 3 agents"
4. 观察三个 Agent 几乎同时开始执行（而非依次执行）

**Step 3: 验证执行结果**

确认所有三个 Agent 执行完成后：
- 订单状态转为 Selecting
- 前端显示选择界面

---

## 技术说明

### 为什么使用 Promise.allSettled 而非 Promise.all?

- `Promise.all`: 任一失败则整体失败，其他并行任务会被忽略
- `Promise.allSettled`: 所有 Promise 完成后返回，无论成功失败，适合独立任务

### 并行执行的好处

假设每个 Agent 执行需要 10 秒：
- 串行: 3 × 10s = 30s
- 并行: max(10s, 10s, 10s) = 10s

提升约 3 倍效率。
