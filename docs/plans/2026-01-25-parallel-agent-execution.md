# Parallel Agent Execution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 重构匹配流程，移除双向确认步骤，实现 3 个 Agent 并行执行任务，用户从执行结果中选择并支付

**Architecture:**
- 移除 Pairing 确认流程
- 新增 Execution（执行中）状态，支持多 Agent 并行
- 通过 Mastra Client 调用 Agent 执行
- D3.js 实时展示执行状态

**Tech Stack:** NestJS, Supabase, Mastra Client SDK, D3.js, React

---

## Overview

### 新流程 vs 旧流程

| 旧流程 | 新流程 |
|--------|--------|
| 自动匹配 → Pairing → B 确认 → InProgress | 自动匹配 → 抽取 3 Agent → 并行执行 |
| 单 Agent 执行 | 3 Agent 并行竞争执行 |
| B 确认后开始工作 | 自动触发 Mastra 执行 |
| 用户验收单一结果 | 用户从 3 个结果中选择 0-3 个 |

### 新状态机

```
Standby → Executing → Selecting → InProgress → Delivered → ...
           ↓
         （3个Agent并行执行）
           ↓
         执行完成 → 用户选择
           ↓
         选中的进入 InProgress
```

---

## Task 1: 数据库迁移 - 新增执行相关表和状态

**Files:**
- Create: `infra/supabase/migrations/20260125_add_execution_tables.sql`
- Modify: `packages/shared/src/enums/order-status.ts`

**Step 1: 创建迁移文件**

```sql
-- 新增订单状态: Executing（执行中）、Selecting（选择中）
-- PostgreSQL enum 不能直接添加值到中间位置，需要重建

-- 1. 新增执行记录表
CREATE TABLE IF NOT EXISTS executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES agents(id),

  -- 执行状态: pending（待执行）、running（执行中）、completed（已完成）、failed（失败）、selected（被选中）、rejected（未被选中）
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'selected', 'rejected')),

  -- Mastra 执行信息
  mastra_run_id text,           -- Mastra 返回的执行 ID
  mastra_status text,           -- Mastra 执行状态

  -- 执行结果
  result_preview text,          -- 结果预览（摘要）
  result_content text,          -- 完整结果内容
  result_url text,              -- 结果链接（如有）

  -- 错误信息
  error_message text,

  -- 时间戳
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- 唯一约束：同一订单同一 Agent 只能有一条执行记录
  UNIQUE(order_id, agent_id)
);

-- 2. 为 orders 表添加执行阶段字段
ALTER TABLE orders ADD COLUMN IF NOT EXISTS execution_phase text
  CHECK (execution_phase IS NULL OR execution_phase IN ('executing', 'selecting', 'completed'));

-- 3. 索引优化
CREATE INDEX IF NOT EXISTS idx_executions_order_id ON executions(order_id);
CREATE INDEX IF NOT EXISTS idx_executions_agent_id ON executions(agent_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
CREATE INDEX IF NOT EXISTS idx_orders_execution_phase ON orders(execution_phase) WHERE execution_phase IS NOT NULL;

-- 4. 触发器：自动更新 updated_at
CREATE OR REPLACE FUNCTION update_executions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER executions_updated_at_trigger
  BEFORE UPDATE ON executions
  FOR EACH ROW
  EXECUTE FUNCTION update_executions_updated_at();
```

**Step 2: 更新 OrderStatus 枚举**

在 `packages/shared/src/enums/order-status.ts` 中添加新状态（保持向后兼容）：

```typescript
export enum OrderStatus {
  Standby = 'Standby',
  Executing = 'Executing',       // 新增：Agent 执行中
  Selecting = 'Selecting',       // 新增：用户选择中
  Pairing = 'Pairing',           // 保留（兼容旧数据）
  InProgress = 'InProgress',
  Delivered = 'Delivered',
  Accepted = 'Accepted',
  AutoAccepted = 'AutoAccepted',
  RefundRequested = 'RefundRequested',
  CancelRequested = 'CancelRequested',
  Disputed = 'Disputed',
  AdminArbitrating = 'AdminArbitrating',
  Refunded = 'Refunded',
  Paid = 'Paid',
  Completed = 'Completed',
}
```

**Step 3: 新增 Execution 类型定义**

在 `packages/shared/src/types/index.ts` 中添加：

```typescript
// ============================================================
// Execution Types
// ============================================================

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'selected' | 'rejected';

export interface Execution {
  id: string;
  orderId: string;
  agentId: string;
  status: ExecutionStatus;
  mastraRunId: string | null;
  mastraStatus: string | null;
  resultPreview: string | null;
  resultContent: string | null;
  resultUrl: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

**Step 4: 运行迁移**

```bash
cd infra/supabase && supabase db push
```

**Step 5: Commit**

```bash
git add infra/supabase/migrations/20260125_add_execution_tables.sql packages/shared/src/enums/order-status.ts packages/shared/src/types/index.ts
git commit -m "feat(db): add execution tables and new order statuses

- Add executions table for parallel agent execution tracking
- Add Executing and Selecting order statuses
- Add execution_phase column to orders table

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: 创建 Execution 模块（后端）

**Files:**
- Create: `apps/api/src/modules/execution/execution.module.ts`
- Create: `apps/api/src/modules/execution/execution.repository.ts`
- Create: `apps/api/src/modules/execution/execution.service.ts`
- Create: `apps/api/src/modules/execution/execution.controller.ts`
- Create: `apps/api/src/modules/execution/dtos/select-agents.dto.ts`
- Modify: `apps/api/src/app.module.ts`

**Step 1: 创建 execution.repository.ts**

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import type { ExecutionStatus } from '@c2c-agents/shared';

const EXECUTION_TABLE = 'executions';

type ExecutionRow = {
  id: string;
  order_id: string;
  agent_id: string;
  status: ExecutionStatus;
  mastra_run_id: string | null;
  mastra_status: string | null;
  result_preview: string | null;
  result_content: string | null;
  result_url: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateExecutionInput = {
  orderId: string;
  agentId: string;
};

export type UpdateExecutionInput = {
  status?: ExecutionStatus;
  mastraRunId?: string;
  mastraStatus?: string;
  resultPreview?: string;
  resultContent?: string;
  resultUrl?: string;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
};

function toExecution(row: ExecutionRow) {
  return {
    id: row.id,
    orderId: row.order_id,
    agentId: row.agent_id,
    status: row.status,
    mastraRunId: row.mastra_run_id,
    mastraStatus: row.mastra_status,
    resultPreview: row.result_preview,
    resultContent: row.result_content,
    resultUrl: row.result_url,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable()
export class ExecutionRepository {
  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  async createExecution(input: CreateExecutionInput) {
    const { data, error } = await this.supabase
      .query<ExecutionRow>(EXECUTION_TABLE)
      .insert({
        order_id: input.orderId,
        agent_id: input.agentId,
        status: 'pending',
      })
      .select('*')
      .single();

    if (error) throw new Error(`Failed to create execution: ${error.message}`);
    return toExecution(data);
  }

  async createExecutionsBatch(orderId: string, agentIds: string[]) {
    const rows = agentIds.map(agentId => ({
      order_id: orderId,
      agent_id: agentId,
      status: 'pending' as const,
    }));

    const { data, error } = await this.supabase
      .query<ExecutionRow>(EXECUTION_TABLE)
      .insert(rows)
      .select('*');

    if (error) throw new Error(`Failed to create executions: ${error.message}`);
    return (data ?? []).map(toExecution);
  }

  async findExecutionsByOrderId(orderId: string) {
    const { data, error } = await this.supabase
      .query<ExecutionRow>(EXECUTION_TABLE)
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`Failed to fetch executions: ${error.message}`);
    return (data ?? []).map(toExecution);
  }

  async findExecutionById(executionId: string) {
    const { data, error } = await this.supabase
      .query<ExecutionRow>(EXECUTION_TABLE)
      .select('*')
      .eq('id', executionId)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch execution: ${error.message}`);
    return data ? toExecution(data) : null;
  }

  async updateExecution(executionId: string, input: UpdateExecutionInput) {
    const updates: Record<string, unknown> = {};
    if (input.status !== undefined) updates.status = input.status;
    if (input.mastraRunId !== undefined) updates.mastra_run_id = input.mastraRunId;
    if (input.mastraStatus !== undefined) updates.mastra_status = input.mastraStatus;
    if (input.resultPreview !== undefined) updates.result_preview = input.resultPreview;
    if (input.resultContent !== undefined) updates.result_content = input.resultContent;
    if (input.resultUrl !== undefined) updates.result_url = input.resultUrl;
    if (input.errorMessage !== undefined) updates.error_message = input.errorMessage;
    if (input.startedAt !== undefined) updates.started_at = input.startedAt;
    if (input.completedAt !== undefined) updates.completed_at = input.completedAt;

    const { data, error } = await this.supabase
      .query<ExecutionRow>(EXECUTION_TABLE)
      .update(updates)
      .eq('id', executionId)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to update execution: ${error.message}`);
    return toExecution(data);
  }

  async updateExecutionsByOrderIdAndStatus(
    orderId: string,
    currentStatus: ExecutionStatus,
    newStatus: ExecutionStatus
  ) {
    const { error } = await this.supabase
      .query(EXECUTION_TABLE)
      .update({ status: newStatus })
      .eq('order_id', orderId)
      .eq('status', currentStatus);

    if (error) throw new Error(`Failed to batch update executions: ${error.message}`);
  }
}
```

**Step 2-6: 创建 service, controller, dto, module**

（详细代码见后续实现）

**Step 7: Commit**

```bash
git add apps/api/src/modules/execution/
git commit -m "feat(execution): add execution module for parallel agent execution

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: 创建 Mastra Client 服务

**Files:**
- Create: `apps/api/src/modules/mastra/mastra.module.ts`
- Create: `apps/api/src/modules/mastra/mastra.service.ts`
- Modify: `apps/api/src/app.module.ts`

**Step 1: 创建 mastra.service.ts**

```typescript
import { Inject, Injectable, Logger } from '@nestjs/common';
import { MastraTokenService } from '../mastra-token/mastra-token.service';
import { AgentRepository } from '../agent/agent.repository';

export type MastraExecuteParams = {
  agentId: string;
  taskDescription: string;
  taskType: string;
  attachments?: string[];
};

export type MastraExecuteResult = {
  runId: string;
  status: 'running' | 'completed' | 'failed';
  preview?: string;
  content?: string;
  url?: string;
  error?: string;
};

@Injectable()
export class MastraService {
  private readonly logger = new Logger(MastraService.name);

  constructor(
    @Inject(MastraTokenService) private readonly tokenService: MastraTokenService,
    @Inject(AgentRepository) private readonly agentRepository: AgentRepository
  ) {}

  /**
   * 验证 Agent 的 Mastra Token 是否有效
   */
  async validateAgentToken(agentId: string): Promise<{ valid: boolean; error?: string }> {
    const agent = await this.agentRepository.findAgentById(agentId);
    if (!agent) {
      return { valid: false, error: 'Agent not found' };
    }

    if (!agent.mastraTokenId) {
      return { valid: false, error: 'Agent has no Mastra token configured' };
    }

    if (!agent.mastraUrl) {
      return { valid: false, error: 'Agent has no Mastra URL configured' };
    }

    const token = await this.tokenService.getTokenForAgent(agent.mastraTokenId);
    if (!token) {
      return { valid: false, error: 'Mastra token not found or revoked' };
    }

    // TODO: 可选 - 调用 Mastra API 验证 token 有效性
    // const isValid = await this.verifyTokenWithMastra(agent.mastraUrl, token.token);

    return { valid: true };
  }

  /**
   * 调用 Mastra Agent 执行任务
   */
  async executeTask(params: MastraExecuteParams): Promise<MastraExecuteResult> {
    const agent = await this.agentRepository.findAgentById(params.agentId);
    if (!agent || !agent.mastraTokenId || !agent.mastraUrl) {
      return {
        runId: '',
        status: 'failed',
        error: 'Agent not properly configured for Mastra execution',
      };
    }

    const token = await this.tokenService.getTokenForAgent(agent.mastraTokenId);
    if (!token) {
      return {
        runId: '',
        status: 'failed',
        error: 'Mastra token not found',
      };
    }

    try {
      // 调用 Mastra Cloud API
      const response = await fetch(`${agent.mastraUrl}/api/agents/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token.token}`,
        },
        body: JSON.stringify({
          task: params.taskDescription,
          taskType: params.taskType,
          attachments: params.attachments ?? [],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Mastra execution failed: ${errorText}`);
        return {
          runId: '',
          status: 'failed',
          error: `Mastra API error: ${response.status}`,
        };
      }

      const result = await response.json();
      return {
        runId: result.runId ?? result.id ?? '',
        status: 'running',
        preview: result.preview,
      };
    } catch (error) {
      this.logger.error(`Mastra execution error: ${error}`);
      return {
        runId: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 查询 Mastra 执行状态
   */
  async getExecutionStatus(agentId: string, runId: string): Promise<MastraExecuteResult> {
    const agent = await this.agentRepository.findAgentById(agentId);
    if (!agent || !agent.mastraTokenId || !agent.mastraUrl) {
      return { runId, status: 'failed', error: 'Agent not configured' };
    }

    const token = await this.tokenService.getTokenForAgent(agent.mastraTokenId);
    if (!token) {
      return { runId, status: 'failed', error: 'Token not found' };
    }

    try {
      const response = await fetch(`${agent.mastraUrl}/api/runs/${runId}`, {
        headers: {
          'Authorization': `Bearer ${token.token}`,
        },
      });

      if (!response.ok) {
        return { runId, status: 'failed', error: `Status check failed: ${response.status}` };
      }

      const result = await response.json();
      return {
        runId,
        status: result.status === 'completed' ? 'completed' :
                result.status === 'failed' ? 'failed' : 'running',
        preview: result.preview,
        content: result.content,
        url: result.url,
        error: result.error,
      };
    } catch (error) {
      return {
        runId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
```

**Step 2: 创建 mastra.module.ts**

**Step 3: Commit**

```bash
git add apps/api/src/modules/mastra/
git commit -m "feat(mastra): add Mastra client service for agent execution

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: 重构匹配服务 - 移除 Pairing 确认

**Files:**
- Modify: `apps/api/src/modules/matching/matching.service.ts`
- Modify: `apps/api/src/modules/matching/matching.controller.ts`
- Delete or deprecate: `apps/api/src/modules/matching/pairing.service.ts`

**Step 1: 重写 autoMatch 逻辑**

新的自动匹配流程：
1. 根据任务类型和报酬筛选候选 Agent（3-15 个）
2. 使用洗牌算法随机抽取 3 个
3. 验证每个 Agent 的 Mastra Token
4. 创建执行记录，触发 Mastra 执行
5. 订单状态 Standby → Executing

```typescript
async autoMatch(userId: string, taskId: string): Promise<ParallelMatchResult> {
  const { task, order } = await this.loadTaskAndOrder(userId, taskId);

  // 1. 获取候选 Agent（目标 3-15 个）
  const rawCandidates = await this.repository.listCandidateAgents(
    task.type,
    String(task.expected_reward)
  );

  if (rawCandidates.length < 3) {
    throw new ValidationError(`Not enough agents available (need 3, found ${rawCandidates.length})`);
  }

  // 2. 排序并截取前 15 个
  const sortedCandidates = sortAgents(rawCandidates.map(/* ... */));
  const topCandidates = sortedCandidates.slice(0, Math.min(15, sortedCandidates.length));

  // 3. 洗牌并抽取 3 个
  const shuffled = this.shuffleArray([...topCandidates]);
  const selectedAgents = shuffled.slice(0, 3);

  // 4. 验证 Mastra Token
  const validAgents = [];
  for (const agent of selectedAgents) {
    const validation = await this.mastraService.validateAgentToken(agent.id);
    if (validation.valid) {
      validAgents.push(agent);
    }
  }

  if (validAgents.length === 0) {
    throw new ValidationError('No agents with valid Mastra tokens');
  }

  // 5. 创建执行记录并触发执行
  const executions = await this.executionRepository.createExecutionsBatch(
    order.id,
    validAgents.map(a => a.id)
  );

  // 6. 更新订单状态
  await this.repository.updateOrderExecutionPhase(order.id, 'executing');
  await this.repository.updateOrderStatus(order.id, OrderStatus.Executing);

  // 7. 异步触发 Mastra 执行（不阻塞返回）
  this.triggerMastraExecutions(task, order, executions);

  return {
    result: 'executing',
    orderId: order.id,
    executions: executions.map(e => ({
      executionId: e.id,
      agentId: e.agentId,
      status: e.status,
    })),
  };
}

private shuffleArray<T>(array: T[]): T[] {
  // Fisher-Yates 洗牌算法
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
```

**Step 2: 移除 Pairing 相关 API**

保留旧 API 但返回 deprecated 警告或重定向到新流程。

**Step 3: Commit**

```bash
git add apps/api/src/modules/matching/
git commit -m "refactor(matching): replace pairing with parallel execution

- Remove double-confirmation flow
- Select 3 agents using shuffle algorithm
- Validate Mastra tokens before execution
- Trigger parallel Mastra executions

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: 创建执行状态轮询 API

**Files:**
- Modify: `apps/api/src/modules/execution/execution.controller.ts`
- Create: `apps/api/src/modules/execution/execution-poller.service.ts`

**Step 1: 添加状态查询 API**

```typescript
// GET /execution/order/:orderId
@Get('order/:orderId')
async getExecutionsByOrder(
  @Param('orderId') orderId: string,
  @Headers('x-user-id') userId: string
): Promise<ExecutionWithAgent[]> {
  return this.executionService.getExecutionsByOrder(userId, orderId);
}

// GET /execution/:executionId/status
@Get(':executionId/status')
async getExecutionStatus(
  @Param('executionId') executionId: string
): Promise<ExecutionStatus> {
  return this.executionService.refreshExecutionStatus(executionId);
}
```

**Step 2: 创建轮询服务**

定时检查 running 状态的执行，更新 Mastra 状态。

**Step 3: Commit**

---

## Task 6: 创建用户选择 API

**Files:**
- Modify: `apps/api/src/modules/execution/execution.controller.ts`
- Modify: `apps/api/src/modules/execution/execution.service.ts`

**Step 1: 添加选择 API**

```typescript
// POST /execution/select
@Post('select')
async selectExecutions(
  @Headers('x-user-id') userId: string,
  @Body() dto: SelectExecutionsDto
): Promise<SelectResult> {
  // dto.orderId: string
  // dto.selectedExecutionIds: string[] (0-3 个)
  return this.executionService.selectExecutions(userId, dto);
}
```

**选择逻辑：**
1. 验证订单状态为 Selecting
2. 验证 executionIds 属于该订单
3. 更新选中的 executions 状态为 selected
4. 更新未选中的 executions 状态为 rejected
5. 如果选中 > 0，订单进入 InProgress（第一个选中的 Agent）
6. 如果选中 == 0，订单返回 Standby（用户放弃）

**Step 2: Commit**

---

## Task 7: 前端 - 创建执行状态可视化组件（D3.js）

**Files:**
- Create: `apps/web/src/components/execution/ExecutionOrbs.tsx`
- Create: `apps/web/src/components/execution/ExecutionDetailModal.tsx`
- Create: `apps/web/src/components/execution/ExecutionCard.tsx`
- Create: `apps/web/src/hooks/use-executions.ts`

**交互需求:**
1. **拖拽支持** - 小球可自由拖拽移动，松开后平滑回弹或停留
2. **点击弹出详情** - 点击小球弹出 Modal，展示 Agent 详情
3. **执行过程展示** - Modal 中实时显示 Agent 执行日志/步骤
4. **执行结果展示** - 执行完成后在 Modal 中展示结果内容

**Step 1: 安装 D3.js**

```bash
pnpm add d3 --filter @c2c-agents/web
pnpm add -D @types/d3 --filter @c2c-agents/web
```

**Step 2: 创建 ExecutionOrbs.tsx（离子小球动画 + 拖拽 + 点击）**

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { Execution, Agent } from '@c2c-agents/shared';
import { ExecutionDetailModal } from './ExecutionDetailModal';

type ExecutionWithAgent = Execution & { agent: Agent };

type ExecutionOrbsProps = {
  executions: ExecutionWithAgent[];
  onSelect: (executionId: string) => void;
  selectedIds: string[];
};

export function ExecutionOrbs({ executions, onSelect, selectedIds }: ExecutionOrbsProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedExecution, setSelectedExecution] = useState<ExecutionWithAgent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = 600;
    const height = 400;

    svg.attr('viewBox', `0 0 ${width} ${height}`);
    svg.selectAll('*').remove();

    // 定义发光滤镜
    const defs = svg.append('defs');
    const filter = defs.append('filter')
      .attr('id', 'glow')
      .attr('x', '-50%').attr('y', '-50%')
      .attr('width', '200%').attr('height', '200%');
    filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // 初始位置（三角形布局）
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 120;
    const initialPositions = [
      { x: centerX, y: centerY - radius },
      { x: centerX - radius * 0.866, y: centerY + radius * 0.5 },
      { x: centerX + radius * 0.866, y: centerY + radius * 0.5 },
    ];

    // 为每个 execution 添加位置状态
    const orbData = executions.map((exec, i) => ({
      ...exec,
      x: initialPositions[i]?.x ?? centerX,
      y: initialPositions[i]?.y ?? centerY,
      initialX: initialPositions[i]?.x ?? centerX,
      initialY: initialPositions[i]?.y ?? centerY,
    }));

    // 拖拽行为
    const drag = d3.drag<SVGGElement, typeof orbData[0]>()
      .on('start', function(event) {
        d3.select(this).raise().attr('opacity', 0.8);
      })
      .on('drag', function(event, d) {
        d.x = event.x;
        d.y = event.y;
        d3.select(this).attr('transform', `translate(${d.x}, ${d.y})`);
      })
      .on('end', function(event, d) {
        d3.select(this).attr('opacity', 1);
        // 平滑回弹到初始位置（可选：移除此部分让小球停留在拖拽位置）
        d3.select(this)
          .transition()
          .duration(500)
          .ease(d3.easeElastic)
          .attr('transform', `translate(${d.initialX}, ${d.initialY})`);
        d.x = d.initialX;
        d.y = d.initialY;
      });

    // 绘制小球组
    const orbs = svg.selectAll<SVGGElement, typeof orbData[0]>('.orb')
      .data(orbData)
      .enter()
      .append('g')
      .attr('class', 'orb')
      .attr('transform', d => `translate(${d.x}, ${d.y})`)
      .style('cursor', 'grab')
      .call(drag);

    // 小球圆形
    orbs.append('circle')
      .attr('r', 40)
      .attr('fill', d => getOrbColor(d.status))
      .attr('filter', 'url(#glow)')
      .attr('stroke', d => selectedIds.includes(d.id) ? '#00ff88' : 'transparent')
      .attr('stroke-width', 3);

    // 点击事件 - 弹出详情 Modal
    orbs.on('click', (event, d) => {
      // 排除拖拽结束时的点击
      if (event.defaultPrevented) return;
      setSelectedExecution(d);
      setIsModalOpen(true);
    });

    // 脉动动画（执行中）
    orbs.filter(d => d.status === 'running')
      .append('circle')
      .attr('r', 40)
      .attr('fill', 'none')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2)
      .attr('opacity', 0.5)
      .each(function() { pulse(d3.select(this)); });

    function pulse(selection: d3.Selection<SVGCircleElement, unknown, null, undefined>) {
      selection
        .transition()
        .duration(1500)
        .attr('r', 60)
        .attr('opacity', 0)
        .on('end', function() {
          d3.select(this).attr('r', 40).attr('opacity', 0.5);
          pulse(d3.select(this));
        });
    }

    // Agent 名称
    orbs.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.5em')
      .attr('fill', 'white')
      .attr('font-size', '11px')
      .attr('font-weight', 'bold')
      .text(d => d.agent?.name?.slice(0, 8) ?? 'Agent');

    // 状态文字
    orbs.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1em')
      .attr('fill', 'white')
      .attr('font-size', '10px')
      .text(d => getStatusLabel(d.status));

  }, [executions, selectedIds]);

  const handleSelectAgent = () => {
    if (selectedExecution && selectedExecution.status === 'completed') {
      onSelect(selectedExecution.id);
    }
  };

  return (
    <>
      <svg ref={svgRef} className="w-full h-[400px]" />
      <ExecutionDetailModal
        execution={selectedExecution}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={handleSelectAgent}
        isSelected={selectedExecution ? selectedIds.includes(selectedExecution.id) : false}
      />
    </>
  );
}

function getOrbColor(status: string): string {
  switch (status) {
    case 'pending': return '#6b7280';
    case 'running': return '#3b82f6';
    case 'completed': return '#10b981';
    case 'failed': return '#ef4444';
    case 'selected': return '#8b5cf6';
    case 'rejected': return '#374151';
    default: return '#6b7280';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'pending': return '等待中';
    case 'running': return '执行中';
    case 'completed': return '已完成';
    case 'failed': return '失败';
    case 'selected': return '已选中';
    case 'rejected': return '未选中';
    default: return status;
  }
}
```

**Step 3: 创建 ExecutionDetailModal.tsx（Agent 详情弹窗）**

```typescript
'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@c2c-agents/ui/dialog';
import { Button } from '@c2c-agents/ui/button';
import { Badge } from '@c2c-agents/ui/badge';
import { ScrollArea } from '@c2c-agents/ui/scroll-area';
import type { Execution, Agent } from '@c2c-agents/shared';

type ExecutionWithAgent = Execution & { agent: Agent };

type ExecutionDetailModalProps = {
  execution: ExecutionWithAgent | null;
  isOpen: boolean;
  onClose: () => void;
  onSelect: () => void;
  isSelected: boolean;
};

export function ExecutionDetailModal({
  execution,
  isOpen,
  onClose,
  onSelect,
  isSelected,
}: ExecutionDetailModalProps) {
  if (!execution) return null;

  const { agent, status, resultPreview, resultContent, errorMessage, mastraStatus } = execution;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{agent?.name ?? 'Agent'}</span>
            <StatusBadge status={status} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Agent 基本信息 */}
          <section>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Agent 信息</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>类型: {agent?.type ?? '-'}</div>
              <div>评分: {agent?.avgRating?.toFixed(1) ?? '-'}</div>
              <div>完成订单: {agent?.completedOrderCount ?? 0}</div>
              <div>状态: {agent?.status ?? '-'}</div>
            </div>
          </section>

          {/* 执行过程 */}
          {status === 'running' && (
            <section>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">执行过程</h4>
              <div className="bg-muted/50 rounded-md p-3">
                <div className="flex items-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                  <span className="text-sm">正在执行中...</span>
                </div>
                {mastraStatus && (
                  <p className="text-xs text-muted-foreground mt-2">Mastra 状态: {mastraStatus}</p>
                )}
              </div>
            </section>
          )}

          {/* 执行结果 */}
          {(status === 'completed' || status === 'selected') && (
            <section>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">执行结果</h4>
              {resultPreview && (
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md p-3 mb-2">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">预览</p>
                  <p className="text-sm">{resultPreview}</p>
                </div>
              )}
              {resultContent && (
                <ScrollArea className="h-[200px] border rounded-md p-3">
                  <pre className="text-xs whitespace-pre-wrap">{resultContent}</pre>
                </ScrollArea>
              )}
            </section>
          )}

          {/* 错误信息 */}
          {status === 'failed' && errorMessage && (
            <section>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">错误信息</h4>
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md p-3">
                <p className="text-sm text-red-800 dark:text-red-200">{errorMessage}</p>
              </div>
            </section>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>关闭</Button>
          {status === 'completed' && (
            <Button
              onClick={onSelect}
              variant={isSelected ? 'secondary' : 'default'}
            >
              {isSelected ? '取消选择' : '选择此结果'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    pending: 'outline',
    running: 'default',
    completed: 'secondary',
    failed: 'destructive',
    selected: 'default',
    rejected: 'outline',
  };

  const labels: Record<string, string> = {
    pending: '等待中',
    running: '执行中',
    completed: '已完成',
    failed: '失败',
    selected: '已选中',
    rejected: '未选中',
  };

  return (
    <Badge variant={variants[status] ?? 'outline'}>
      {labels[status] ?? status}
    </Badge>
  );
}
```

**Step 4: 创建 use-executions.ts hook（轮询执行状态）**

```typescript
import { useState, useEffect, useCallback } from 'react';
import type { Execution, Agent } from '@c2c-agents/shared';

type ExecutionWithAgent = Execution & { agent: Agent };

export function useExecutions(orderId: string | null, pollingInterval = 3000) {
  const [executions, setExecutions] = useState<ExecutionWithAgent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExecutions = useCallback(async () => {
    if (!orderId) return;

    try {
      const response = await fetch(`/api/execution/order/${orderId}`, {
        headers: { 'x-user-id': 'current-user' }, // 从 auth context 获取
      });

      if (!response.ok) throw new Error('Failed to fetch executions');

      const data = await response.json();
      setExecutions(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [orderId]);

  // 初始加载
  useEffect(() => {
    setIsLoading(true);
    fetchExecutions().finally(() => setIsLoading(false));
  }, [fetchExecutions]);

  // 轮询（仅当有 running 状态时）
  useEffect(() => {
    const hasRunning = executions.some(e => e.status === 'running' || e.status === 'pending');
    if (!hasRunning || !orderId) return;

    const interval = setInterval(fetchExecutions, pollingInterval);
    return () => clearInterval(interval);
  }, [executions, orderId, pollingInterval, fetchExecutions]);

  return { executions, isLoading, error, refetch: fetchExecutions };
}
```

**Step 5: Commit**

```bash
git add apps/web/src/components/execution/
git commit -m "feat(web): add D3.js execution orbs with drag and detail modal

- Support drag interaction with elastic bounce-back
- Click to open agent detail modal
- Show execution process in real-time
- Display execution results when completed

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: 前端 - 重构任务详情页

**Files:**
- Modify: `apps/web/src/app/tasks/[id]/_components/ActionSection.tsx`
- Create: `apps/web/src/app/tasks/[id]/_components/ExecutingActions.tsx`
- Create: `apps/web/src/app/tasks/[id]/_components/SelectingActions.tsx`
- Modify: `apps/web/src/app/tasks/[id]/_components/StandbyActions.tsx`

**Step 1: 更新 ActionSection 路由**

添加 Executing 和 Selecting 状态的处理。

**Step 2: 创建 ExecutingActions**

显示 3 个执行中的 Agent 小球动画，实时轮询状态。

**Step 3: 创建 SelectingActions**

显示执行结果，用户可以选择 0-3 个。

**Step 4: Commit**

---

## Task 9: 更新状态机转换规则

**Files:**
- Modify: `packages/shared/src/state-machine/order-transitions.ts`

**Step 1: 添加新的状态转换**

```typescript
// 新增转换规则
[OrderStatus.Standby]: [OrderStatus.Executing, OrderStatus.Pairing], // 兼容旧流程
[OrderStatus.Executing]: [OrderStatus.Selecting, OrderStatus.Standby], // 执行完成或全部失败
[OrderStatus.Selecting]: [OrderStatus.InProgress, OrderStatus.Standby], // 选择完成或放弃
```

**Step 2: Commit**

---

## Task 10: 添加单元测试

**Files:**
- Create: `apps/api/src/modules/execution/__tests__/execution.service.test.ts`
- Create: `apps/api/src/modules/mastra/__tests__/mastra.service.test.ts`

**Step 1-2: 编写测试**

**Step 3: Commit**

---

## 执行顺序

| 优先级 | Task | 说明 | 依赖 |
|--------|------|------|------|
| 1 | Task 1 | 数据库迁移 | - |
| 2 | Task 2 | Execution 模块 | Task 1 |
| 3 | Task 3 | Mastra Client | Task 2 |
| 4 | Task 4 | 重构匹配服务 | Task 2, 3 |
| 5 | Task 5 | 状态轮询 API | Task 2 |
| 6 | Task 6 | 用户选择 API | Task 2 |
| 7 | Task 7 | D3.js 可视化 | - |
| 8 | Task 8 | 前端重构 | Task 5, 6, 7 |
| 9 | Task 9 | 状态机规则 | Task 1 |
| 10 | Task 10 | 单元测试 | Task 2, 3, 4 |

---

## 关键设计决策

### 1. 为什么保留 Pairing 状态？
向后兼容旧订单数据，新流程使用 Executing/Selecting。

### 2. 为什么 3 个 Agent？
- 提供足够的选择空间
- 避免资源浪费（过多并行执行）
- 保持 UI 简洁（三角形布局）

### 3. Mastra Token 验证时机？
在抽选后、执行前验证，确保只有有效 Agent 参与执行。

### 4. 执行失败处理？
- 单个失败：其他继续
- 全部失败：订单返回 Standby，用户可重新匹配

### 5. 支付时机？
用户选择后，只为选中的 Agent 支付对应费用。

---

**Plan complete and saved to `docs/plans/2026-01-25-parallel-agent-execution.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
