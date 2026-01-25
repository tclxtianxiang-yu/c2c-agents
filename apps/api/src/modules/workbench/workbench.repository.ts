import { type OrderStatus, QueueItemStatus } from '@c2c-agents/shared';
import { Inject, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';

// Type definitions for database row structures
// Note: Supabase returns single relations as objects, not arrays (when using proper foreign keys)
type TaskInfo = {
  id: string;
  title: string;
  type: string;
  description: string;
};

type AgentInfo = {
  id: string;
  name: string;
};

type TaskShortInfo = {
  id: string;
  title: string;
  type: string;
};

type OrderInfo = {
  id: string;
  task_id: string;
  task: TaskShortInfo | null;
};

// Export types for API responses
export type WorkbenchOrder = {
  id: string;
  taskId: string;
  status: OrderStatus;
  rewardAmount: string;
  providerId: string;
  agentId: string;
  deliveredAt: string | null;
  pairingCreatedAt: string | null;
  createdAt: string;
  task: TaskInfo | null;
  agent: AgentInfo | null;
};

export type WorkbenchQueueItem = {
  id: string;
  agentId: string;
  orderId: string;
  status: QueueItemStatus;
  createdAt: string;
  order: {
    id: string;
    taskId: string;
    task: TaskShortInfo | null;
  } | null;
  agent: AgentInfo | null;
};

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
export class WorkbenchRepository {
  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  async findOrdersByProviderAndStatus(
    providerId: string,
    statuses: OrderStatus[]
  ): Promise<WorkbenchOrder[]> {
    const { data, error } = await this.supabase
      .query('orders')
      .select(
        `
        id, task_id, status, reward_amount, provider_id, agent_id,
        delivered_at, pairing_created_at, created_at,
        task:tasks!orders_task_id_fkey(id, title, type, description),
        agent:agents!orders_agent_id_fkey(id, name)
      `
      )
      .eq('provider_id', providerId)
      .in('status', statuses)
      .order('created_at', { ascending: false });

    ensureNoError(error, 'Failed to fetch orders');

    // Transform data to camelCase response format
    // biome-ignore lint/suspicious/noExplicitAny: Supabase's return type is complex with nested relations
    return ((data ?? []) as any[]).map((row) => ({
      id: row.id as string,
      taskId: row.task_id as string,
      status: row.status as OrderStatus,
      rewardAmount: row.reward_amount as string,
      providerId: row.provider_id as string,
      agentId: row.agent_id as string,
      deliveredAt: row.delivered_at as string | null,
      pairingCreatedAt: row.pairing_created_at as string | null,
      createdAt: row.created_at as string,
      task: row.task as TaskInfo | null,
      agent: row.agent as AgentInfo | null,
    }));
  }

  async findQueueItemsByAgentOwner(ownerId: string): Promise<WorkbenchQueueItem[]> {
    // First get agents owned by user
    const { data: agents, error: agentError } = await this.supabase
      .query('agents')
      .select('id, name')
      .eq('owner_id', ownerId);

    ensureNoError(agentError, 'Failed to fetch agents');
    if (!agents?.length) return [];

    // biome-ignore lint/suspicious/noExplicitAny: Supabase's return type is complex
    const agentList = agents as any[] as AgentInfo[];
    const agentIds = agentList.map((a) => a.id);

    const { data, error } = await this.supabase
      .query('queue_items')
      .select(
        `
        id, agent_id, order_id, status, created_at,
        order:orders!queue_items_order_id_fkey(id, task_id, task:tasks!orders_task_id_fkey(id, title, type))
      `
      )
      .in('agent_id', agentIds)
      .eq('status', QueueItemStatus.Queued)
      .order('created_at', { ascending: true });

    ensureNoError(error, 'Failed to fetch queue');

    // Transform to camelCase response format and attach agent info
    // biome-ignore lint/suspicious/noExplicitAny: Supabase's return type is complex with nested relations
    return ((data ?? []) as any[]).map((item) => {
      const orderData = item.order as OrderInfo | null;
      return {
        id: item.id as string,
        agentId: item.agent_id as string,
        orderId: item.order_id as string,
        status: item.status as QueueItemStatus,
        createdAt: item.created_at as string,
        order: orderData
          ? {
              id: orderData.id,
              taskId: orderData.task_id,
              task: orderData.task,
            }
          : null,
        agent: agentList.find((a) => a.id === item.agent_id) ?? null,
      };
    });
  }
}
