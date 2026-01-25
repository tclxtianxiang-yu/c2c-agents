import type { Execution, ExecutionStatus } from '@c2c-agents/shared';
import { Inject, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';

const EXECUTION_TABLE = 'executions';

const EXECUTION_SELECT_FIELDS = `
  id,
  order_id,
  agent_id,
  status,
  mastra_run_id,
  mastra_status,
  result_preview,
  result_content,
  result_url,
  error_message,
  started_at,
  completed_at,
  created_at,
  updated_at
`;

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

type AgentInfo = {
  id: string;
  name: string;
  avatar_url: string | null;
};

type ExecutionWithAgentRow = ExecutionRow & {
  agent: AgentInfo | null;
};

type OrderRow = {
  id: string;
  creator_id: string;
  provider_id: string | null;
  status: string;
  execution_phase: 'executing' | 'selecting' | 'completed' | null;
};

export type OrderInfo = {
  id: string;
  creatorId: string;
  providerId: string | null;
  status: string;
  executionPhase: 'executing' | 'selecting' | 'completed' | null;
};

export type CreateExecutionInput = {
  orderId: string;
  agentId: string;
  status?: ExecutionStatus;
};

export type UpdateExecutionInput = {
  status?: ExecutionStatus;
  mastraRunId?: string | null;
  mastraStatus?: string | null;
  resultPreview?: string | null;
  resultContent?: string | null;
  resultUrl?: string | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
};

export type ExecutionWithAgent = Execution & {
  agent: {
    id: string;
    name: string;
    avatarUrl: string | null;
  } | null;
};

function toExecution(row: ExecutionRow): Execution {
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

function toExecutionWithAgent(row: ExecutionWithAgentRow): ExecutionWithAgent {
  return {
    ...toExecution(row),
    agent: row.agent
      ? {
          id: row.agent.id,
          name: row.agent.name,
          avatarUrl: row.agent.avatar_url,
        }
      : null,
  };
}

function ensureNoError(error: unknown, context: string): void {
  if (!error) return;
  let message: string;
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'object' && error !== null && 'message' in error) {
    message = String((error as { message: unknown }).message);
  } else {
    message = JSON.stringify(error);
  }
  throw new Error(`${context}: ${message}`);
}

@Injectable()
export class ExecutionRepository {
  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  async createExecution(input: CreateExecutionInput): Promise<Execution> {
    const { data, error } = await this.supabase
      .query<ExecutionRow>(EXECUTION_TABLE)
      .insert({
        order_id: input.orderId,
        agent_id: input.agentId,
        status: input.status ?? 'pending',
      })
      .select(EXECUTION_SELECT_FIELDS)
      .single();

    ensureNoError(error, 'Failed to create execution');
    if (!data) throw new Error('Failed to create execution: empty response');

    return toExecution(data);
  }

  async createExecutionsBatch(orderId: string, agentIds: string[]): Promise<Execution[]> {
    if (agentIds.length === 0) return [];

    const insertData = agentIds.map((agentId) => ({
      order_id: orderId,
      agent_id: agentId,
      status: 'pending' as ExecutionStatus,
    }));

    const { data, error } = await this.supabase
      .query<ExecutionRow>(EXECUTION_TABLE)
      .insert(insertData)
      .select(EXECUTION_SELECT_FIELDS);

    ensureNoError(error, 'Failed to create executions batch');

    return (data ?? []).map(toExecution);
  }

  async findExecutionsByOrderId(orderId: string): Promise<Execution[]> {
    const { data, error } = await this.supabase
      .query<ExecutionRow>(EXECUTION_TABLE)
      .select(EXECUTION_SELECT_FIELDS)
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    ensureNoError(error, 'Failed to fetch executions by order');

    return (data ?? []).map(toExecution);
  }

  async findExecutionById(executionId: string): Promise<Execution | null> {
    const { data, error } = await this.supabase
      .query<ExecutionRow>(EXECUTION_TABLE)
      .select(EXECUTION_SELECT_FIELDS)
      .eq('id', executionId)
      .maybeSingle();

    ensureNoError(error, 'Failed to fetch execution');
    if (!data) return null;

    return toExecution(data);
  }

  async updateExecution(executionId: string, input: UpdateExecutionInput): Promise<Execution> {
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
      .select(EXECUTION_SELECT_FIELDS)
      .single();

    ensureNoError(error, 'Failed to update execution');
    if (!data) throw new Error('Failed to update execution: empty response');

    return toExecution(data);
  }

  async findExecutionsByOrderIdWithAgent(orderId: string): Promise<ExecutionWithAgent[]> {
    const { data, error } = await this.supabase
      .query(EXECUTION_TABLE)
      .select(
        `
        id, order_id, agent_id, status,
        mastra_run_id, mastra_status,
        result_preview, result_content, result_url, error_message,
        started_at, completed_at, created_at, updated_at,
        agent:agents!executions_agent_id_fkey(id, name, avatar_url)
      `
      )
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    ensureNoError(error, 'Failed to fetch executions with agent');

    // biome-ignore lint/suspicious/noExplicitAny: Supabase's return type is complex with nested relations
    return ((data ?? []) as any[]).map((row) => toExecutionWithAgent(row as ExecutionWithAgentRow));
  }

  async updateExecutionsBatch(
    executionIds: string[],
    input: UpdateExecutionInput
  ): Promise<Execution[]> {
    if (executionIds.length === 0) return [];

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
      .in('id', executionIds)
      .select(EXECUTION_SELECT_FIELDS);

    ensureNoError(error, 'Failed to batch update executions');

    return (data ?? []).map(toExecution);
  }

  async findOrderById(orderId: string): Promise<OrderInfo | null> {
    const { data, error } = await this.supabase
      .query<OrderRow>('orders')
      .select('id, creator_id, provider_id, status, execution_phase')
      .eq('id', orderId)
      .maybeSingle();

    ensureNoError(error, 'Failed to fetch order');
    if (!data) return null;

    return {
      id: data.id,
      creatorId: data.creator_id,
      providerId: data.provider_id,
      status: data.status,
      executionPhase: data.execution_phase,
    };
  }

  async updateOrderAfterSelection(
    orderId: string,
    status: string,
    executionPhase: 'executing' | 'selecting' | 'completed' | null
  ): Promise<void> {
    const { error } = await this.supabase
      .query('orders')
      .update({ status, execution_phase: executionPhase })
      .eq('id', orderId);

    ensureNoError(error, 'Failed to update order after selection');
  }

  async updateTaskCurrentStatus(taskId: string, status: string): Promise<void> {
    const { error } = await this.supabase
      .query('tasks')
      .update({ current_status: status })
      .eq('id', taskId);

    ensureNoError(error, 'Failed to update task current status');
  }

  async findTaskIdByOrderId(orderId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .query<{ task_id: string }>('orders')
      .select('task_id')
      .eq('id', orderId)
      .maybeSingle();

    ensureNoError(error, 'Failed to fetch task ID');
    return data?.task_id ?? null;
  }

  async createDeliveryFromExecution(
    orderId: string,
    providerId: string,
    contentText: string
  ): Promise<void> {
    const { error } = await this.supabase.query('deliveries').insert({
      order_id: orderId,
      provider_id: providerId,
      content_text: contentText,
      external_url: null,
    });

    ensureNoError(error, 'Failed to create delivery');
  }

  async updateOrderDeliveredAt(orderId: string): Promise<void> {
    const { error } = await this.supabase
      .query('orders')
      .update({ delivered_at: new Date().toISOString() })
      .eq('id', orderId);

    ensureNoError(error, 'Failed to update order delivered_at');
  }

  async findAgentOwnerId(agentId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .query<{ owner_id: string }>('agents')
      .select('owner_id')
      .eq('id', agentId)
      .maybeSingle();

    ensureNoError(error, 'Failed to fetch agent owner');
    return data?.owner_id ?? null;
  }

  async updateOrderProvider(orderId: string, agentId: string, providerId: string): Promise<void> {
    const { error } = await this.supabase
      .query('orders')
      .update({ agent_id: agentId, provider_id: providerId })
      .eq('id', orderId);

    ensureNoError(error, 'Failed to update order provider');
  }
}
