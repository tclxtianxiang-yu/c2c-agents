import {
  AgentStatus,
  OrderStatus,
  QueueItemStatus,
  type TaskStatus,
  type TaskType,
} from '@c2c-agents/shared';
import { Inject, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';

const TASK_TABLE = 'tasks';
const ORDER_TABLE = 'orders';
const AGENT_TABLE = 'agents';
const QUEUE_TABLE = 'queue_items';
const WALLET_BINDINGS_TABLE = 'wallet_bindings';

const TASK_SELECT_FIELDS = `
  id,
  creator_id,
  type,
  description,
  expected_reward,
  status,
  current_order_id,
  current_status
`;

const ORDER_SELECT_FIELDS = `
  id,
  task_id,
  creator_id,
  provider_id,
  agent_id,
  status,
  pairing_created_at
`;

const AGENT_SELECT_FIELDS = `
  id,
  owner_id,
  name,
  description,
  tags,
  supported_task_types,
  min_price,
  max_price,
  status,
  avg_rating,
  completed_order_count,
  queue_size,
  is_listed,
  created_at
`;

const QUEUE_SELECT_FIELDS = `
  id,
  agent_id,
  task_id,
  order_id,
  status,
  created_at,
  consumed_at,
  canceled_at
`;

type TaskRow = {
  id: string;
  creator_id: string;
  type: TaskType;
  description: string;
  expected_reward: string | number;
  status: TaskStatus;
  current_order_id: string | null;
  current_status: OrderStatus | null;
};

type OrderRow = {
  id: string;
  task_id: string;
  creator_id: string;
  provider_id: string | null;
  agent_id: string | null;
  status: OrderStatus;
  pairing_created_at: string | null;
};

type AgentRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  tags: string[];
  supported_task_types: TaskType[];
  min_price: string | number;
  max_price: string | number;
  status: AgentStatus;
  avg_rating: number;
  completed_order_count: number;
  queue_size: number;
  is_listed: boolean;
  created_at: string;
};

type QueueItemRow = {
  id: string;
  agent_id: string;
  task_id: string;
  order_id: string;
  status: QueueItemStatus;
  created_at: string;
  consumed_at?: string;
  canceled_at?: string;
};

type WalletBindingUserRow = {
  user_id: string;
};

function ensureNoError(error: unknown, context: string): void {
  if (!error) return;
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(`${context}: ${message}`);
}

@Injectable()
export class MatchingRepository {
  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  async findTaskById(taskId: string): Promise<TaskRow | null> {
    const { data, error } = await this.supabase
      .query<TaskRow>(TASK_TABLE)
      .select(TASK_SELECT_FIELDS)
      .eq('id', taskId)
      .maybeSingle();

    ensureNoError(error, 'Failed to fetch task');
    return data ?? null;
  }

  async findOrderById(orderId: string): Promise<OrderRow | null> {
    const { data, error } = await this.supabase
      .query<OrderRow>(ORDER_TABLE)
      .select(ORDER_SELECT_FIELDS)
      .eq('id', orderId)
      .maybeSingle();

    ensureNoError(error, 'Failed to fetch order');
    return data ?? null;
  }

  async findAgentById(agentId: string): Promise<AgentRow | null> {
    const { data, error } = await this.supabase
      .query<AgentRow>(AGENT_TABLE)
      .select(AGENT_SELECT_FIELDS)
      .eq('id', agentId)
      .maybeSingle();

    ensureNoError(error, 'Failed to fetch agent');
    return data ?? null;
  }

  async listCandidateAgents(taskType: TaskType, reward: string): Promise<AgentRow[]> {
    const { data, error } = await this.supabase
      .query<AgentRow>(AGENT_TABLE)
      .select(AGENT_SELECT_FIELDS)
      .eq('is_listed', true)
      .in('status', [AgentStatus.Idle, AgentStatus.Busy, AgentStatus.Queueing])
      .contains('supported_task_types', [taskType])
      .lte('min_price', reward)
      .gte('max_price', reward)
      .order('avg_rating', { ascending: false })
      .order('completed_order_count', { ascending: false })
      .order('created_at', { ascending: true });

    ensureNoError(error, 'Failed to list agents');
    return data ?? [];
  }

  async getQueueCount(agentId: string): Promise<number> {
    const { count, error } = await this.supabase
      .query<QueueItemRow>(QUEUE_TABLE)
      .select('id', { head: true, count: 'exact' })
      .eq('agent_id', agentId)
      .eq('status', QueueItemStatus.Queued);

    ensureNoError(error, 'Failed to fetch queue count');
    return count ?? 0;
  }

  async getInProgressOrderCount(agentId: string): Promise<number> {
    const { count, error } = await this.supabase
      .query<OrderRow>(ORDER_TABLE)
      .select('id', { head: true, count: 'exact' })
      .eq('agent_id', agentId)
      .eq('status', OrderStatus.InProgress);

    ensureNoError(error, 'Failed to fetch InProgress order count');
    return count ?? 0;
  }

  async listQueuedItems(agentId: string): Promise<QueueItemRow[]> {
    const { data, error } = await this.supabase
      .query<QueueItemRow>(QUEUE_TABLE)
      .select(QUEUE_SELECT_FIELDS)
      .eq('agent_id', agentId)
      .eq('status', QueueItemStatus.Queued)
      .order('created_at', { ascending: true });

    ensureNoError(error, 'Failed to list queue items');
    return data ?? [];
  }

  async findQueuedItem(agentId: string, orderId: string): Promise<QueueItemRow | null> {
    const { data, error } = await this.supabase
      .query<QueueItemRow>(QUEUE_TABLE)
      .select(QUEUE_SELECT_FIELDS)
      .eq('agent_id', agentId)
      .eq('order_id', orderId)
      .eq('status', QueueItemStatus.Queued)
      .maybeSingle();

    ensureNoError(error, 'Failed to fetch queue item');
    return data ?? null;
  }

  async enqueueQueueItem(
    agentId: string,
    taskId: string,
    orderId: string
  ): Promise<QueueItemRow | null> {
    const { data, error } = await this.supabase
      .query<QueueItemRow>(QUEUE_TABLE)
      .insert({
        agent_id: agentId,
        task_id: taskId,
        order_id: orderId,
        status: QueueItemStatus.Queued,
      })
      .select(QUEUE_SELECT_FIELDS)
      .maybeSingle();

    if (error) {
      if ('code' in error && (error as { code?: string }).code === '23505') {
        return this.findQueuedItem(agentId, orderId);
      }
      ensureNoError(error, 'Failed to enqueue queue item');
    }

    return data ?? null;
  }

  async updateOrderPairing(
    orderId: string,
    agentId: string,
    providerId: string,
    pairingCreatedAt: string
  ): Promise<OrderRow> {
    const { data, error } = await this.supabase
      .query<OrderRow>(ORDER_TABLE)
      .update({
        status: OrderStatus.Pairing,
        agent_id: agentId,
        provider_id: providerId,
        pairing_created_at: pairingCreatedAt,
      })
      .eq('id', orderId)
      .select(ORDER_SELECT_FIELDS)
      .single();

    ensureNoError(error, 'Failed to update order pairing');
    if (!data) throw new Error('Failed to update order pairing: empty response');
    return data;
  }

  async updateTaskCurrentStatus(taskId: string, status: OrderStatus): Promise<void> {
    const { error } = await this.supabase
      .query(TASK_TABLE)
      .update({ current_status: status })
      .eq('id', taskId);

    ensureNoError(error, 'Failed to update task current status');
  }

  async findActiveUserIdByAddress(address: string): Promise<string | null> {
    const normalized = address.trim();
    if (!normalized) return null;

    const { data, error } = await this.supabase
      .query<WalletBindingUserRow>(WALLET_BINDINGS_TABLE)
      .select('user_id')
      .ilike('address', normalized)
      .eq('is_active', true);

    ensureNoError(error, 'Failed to fetch user id by wallet address');
    if (!data?.length) return null;
    return data[0].user_id ?? null;
  }

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
    const { error } = await this.supabase.query(ORDER_TABLE).update({ status }).eq('id', orderId);

    ensureNoError(error, 'Failed to update order status');
  }

  async clearOrderPairing(orderId: string): Promise<void> {
    const { error } = await this.supabase
      .query(ORDER_TABLE)
      .update({
        status: OrderStatus.Standby,
        agent_id: null,
        provider_id: null,
        pairing_created_at: null,
      })
      .eq('id', orderId);

    ensureNoError(error, 'Failed to clear order pairing');
  }

  async updateAgentStatus(
    agentId: string,
    status: AgentStatus,
    currentOrderId: string | null
  ): Promise<void> {
    const { error } = await this.supabase
      .query(AGENT_TABLE)
      .update({
        status,
        current_order_id: currentOrderId,
      })
      .eq('id', agentId);

    ensureNoError(error, 'Failed to update agent status');
  }

  async cancelQueueItem(agentId: string, orderId: string): Promise<void> {
    const { error } = await this.supabase
      .query(QUEUE_TABLE)
      .update({
        status: QueueItemStatus.Canceled,
        canceled_at: new Date().toISOString(),
      })
      .eq('agent_id', agentId)
      .eq('order_id', orderId)
      .eq('status', QueueItemStatus.Queued);

    ensureNoError(error, 'Failed to cancel queue item');
  }

  async findExpiredPairings(expirationThreshold: string): Promise<OrderRow[]> {
    const { data, error } = await this.supabase
      .query<OrderRow>(ORDER_TABLE)
      .select(ORDER_SELECT_FIELDS)
      .eq('status', OrderStatus.Pairing)
      .lt('pairing_created_at', expirationThreshold);

    ensureNoError(error, 'Failed to find expired pairings');
    return data ?? [];
  }

  /**
   * 原子抢占队列中的下一个 Order（使用 FOR UPDATE SKIP LOCKED）
   * @param agentId Agent ID
   * @returns 消费的 QueueItem，若队列为空则返回 null
   */
  async atomicConsumeQueueItem(agentId: string): Promise<QueueItemRow | null> {
    const { data, error } = await this.supabase.rpc('consume_next_queue_item', {
      p_agent_id: agentId,
    });

    if (error) {
      console.warn(`Failed to consume queue item for agent ${agentId}:`, error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    const row = data[0];
    return {
      id: row.id,
      agent_id: row.agent_id,
      task_id: row.task_id,
      order_id: row.order_id,
      status: row.status as QueueItemStatus,
      created_at: row.created_at,
      consumed_at: row.consumed_at,
    };
  }

  async updateAgentQueueSize(agentId: string, delta: number): Promise<void> {
    const { error } = await this.supabase
      .query(AGENT_TABLE)
      .update({
        queue_size: delta,
      })
      .eq('id', agentId);

    ensureNoError(error, 'Failed to update agent queue size');
  }

  async updateOrderExecutionPhase(
    orderId: string,
    phase: 'executing' | 'selecting' | 'completed' | null
  ): Promise<void> {
    const { error } = await this.supabase
      .query(ORDER_TABLE)
      .update({ execution_phase: phase })
      .eq('id', orderId);

    ensureNoError(error, 'Failed to update order execution phase');
  }
}
