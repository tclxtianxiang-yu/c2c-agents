import type { Order, OrderStatus, Task, TaskStatus, TaskType } from '@c2c-agents/shared';
import { Inject, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import type { TaskListQueryDto } from './dtos/task-list-query.dto';

const TASK_TABLE = 'tasks';
const TASK_ATTACHMENTS_TABLE = 'task_attachments';
const ORDER_TABLE = 'orders';
const WALLET_BINDINGS_TABLE = 'wallet_bindings';

const TASK_SELECT_FIELDS = `
  id,
  creator_id,
  title,
  description,
  type,
  tags,
  expected_reward,
  status,
  current_order_id,
  current_status,
  last_pay_tx_hash,
  pay_fail_reason,
  created_at,
  updated_at
`;

const ORDER_SELECT_FIELDS = `
  id,
  task_id,
  creator_id,
  provider_id,
  agent_id,
  status,
  reward_amount,
  platform_fee_rate,
  platform_fee_amount,
  pay_tx_hash,
  escrow_amount,
  payout_tx_hash,
  refund_tx_hash,
  delivered_at,
  accepted_at,
  auto_accepted_at,
  refunded_at,
  paid_at,
  completed_at,
  refund_request_reason,
  cancel_request_reason,
  dispute_id,
  pairing_created_at,
  created_at,
  updated_at
`;

type TaskRow = {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  type: TaskType;
  tags: string[];
  expected_reward: string | number;
  status: TaskStatus;
  current_order_id: string | null;
  current_status: OrderStatus | null;
  last_pay_tx_hash: string | null;
  pay_fail_reason: string | null;
  created_at: string;
  updated_at: string;
};

type OrderRow = {
  id: string;
  task_id: string;
  creator_id: string;
  provider_id: string | null;
  agent_id: string | null;
  status: OrderStatus;
  reward_amount: string | number;
  platform_fee_rate: string | number;
  platform_fee_amount: string | number | null;
  pay_tx_hash: string | null;
  escrow_amount: string | number | null;
  payout_tx_hash: string | null;
  refund_tx_hash: string | null;
  delivered_at: string | null;
  accepted_at: string | null;
  auto_accepted_at: string | null;
  refunded_at: string | null;
  paid_at: string | null;
  completed_at: string | null;
  refund_request_reason: string | null;
  cancel_request_reason: string | null;
  dispute_id: string | null;
  pairing_created_at: string | null;
  created_at: string;
  updated_at: string;
};

type WalletBindingRow = {
  address: string;
};

type WalletBindingUserRow = {
  user_id: string;
};

export type CreateTaskInput = {
  creatorId: string;
  title: string;
  description: string;
  type: TaskType;
  tags: string[];
  expectedReward: string;
};

export type UpdateTaskInput = {
  status?: TaskStatus;
  currentOrderId?: string | null;
  currentStatus?: OrderStatus | null;
  lastPayTxHash?: string | null;
  payFailReason?: string | null;
};

export type CreateOrderInput = {
  taskId: string;
  creatorId: string;
  status: OrderStatus;
  rewardAmount: string;
  platformFeeRate: string;
  payTxHash: string;
  escrowAmount: string;
};

export type TaskListFilters = TaskListQueryDto & { creatorId?: string };

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    creatorId: row.creator_id,
    title: row.title,
    description: row.description,
    type: row.type,
    tags: row.tags ?? [],
    expectedReward: String(row.expected_reward),
    status: row.status,
    currentOrderId: row.current_order_id,
    currentStatus: row.current_status,
    lastPayTxHash: row.last_pay_tx_hash,
    payFailReason: row.pay_fail_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    taskId: row.task_id,
    creatorId: row.creator_id,
    providerId: row.provider_id,
    agentId: row.agent_id,
    status: row.status,
    rewardAmount: String(row.reward_amount),
    platformFeeRate: String(row.platform_fee_rate),
    platformFeeAmount: row.platform_fee_amount !== null ? String(row.platform_fee_amount) : null,
    payTxHash: row.pay_tx_hash,
    escrowAmount: row.escrow_amount !== null ? String(row.escrow_amount) : null,
    payoutTxHash: row.payout_tx_hash,
    refundTxHash: row.refund_tx_hash,
    deliveredAt: row.delivered_at,
    acceptedAt: row.accepted_at,
    autoAcceptedAt: row.auto_accepted_at,
    refundedAt: row.refunded_at,
    paidAt: row.paid_at,
    completedAt: row.completed_at,
    refundRequestReason: row.refund_request_reason,
    cancelRequestReason: row.cancel_request_reason,
    pairingCreatedAt: row.pairing_created_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function ensureNoError(error: unknown, context: string): void {
  if (!error) return;
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(`${context}: ${message}`);
}

@Injectable()
export class TaskRepository {
  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  async createTask(input: CreateTaskInput): Promise<Task> {
    const { data, error } = await this.supabase
      .query<TaskRow>(TASK_TABLE)
      .insert({
        creator_id: input.creatorId,
        title: input.title,
        description: input.description,
        type: input.type,
        tags: input.tags,
        expected_reward: input.expectedReward,
      })
      .select(TASK_SELECT_FIELDS)
      .single();

    ensureNoError(error, 'Failed to create task');
    if (!data) throw new Error('Failed to create task: empty response');

    return toTask(data);
  }

  async addTaskAttachments(taskId: string, attachments: string[]): Promise<void> {
    if (!attachments.length) return;

    const payload = attachments.map((fileId) => ({
      task_id: taskId,
      file_id: fileId,
    }));

    const { error } = await this.supabase.query(TASK_ATTACHMENTS_TABLE).insert(payload);
    ensureNoError(error, 'Failed to attach files to task');
  }

  async findTaskById(taskId: string): Promise<Task | null> {
    const { data, error } = await this.supabase
      .query<TaskRow>(TASK_TABLE)
      .select(TASK_SELECT_FIELDS)
      .eq('id', taskId)
      .maybeSingle();

    ensureNoError(error, 'Failed to fetch task');
    if (!data) return null;

    return toTask(data);
  }

  async updateTask(taskId: string, input: UpdateTaskInput): Promise<Task> {
    const updates: Record<string, unknown> = {};
    if (input.status !== undefined) updates.status = input.status;
    if (input.currentOrderId !== undefined) updates.current_order_id = input.currentOrderId;
    if (input.currentStatus !== undefined) updates.current_status = input.currentStatus;
    if (input.lastPayTxHash !== undefined) updates.last_pay_tx_hash = input.lastPayTxHash;
    if (input.payFailReason !== undefined) updates.pay_fail_reason = input.payFailReason;

    const { data, error } = await this.supabase
      .query<TaskRow>(TASK_TABLE)
      .update(updates)
      .eq('id', taskId)
      .select(TASK_SELECT_FIELDS)
      .single();

    ensureNoError(error, 'Failed to update task');
    if (!data) throw new Error('Failed to update task: empty response');

    return toTask(data);
  }

  async listTasks(filters: TaskListFilters): Promise<Task[]> {
    let query = this.supabase.query<TaskRow>(TASK_TABLE).select(TASK_SELECT_FIELDS);

    if (filters.creatorId) query = query.eq('creator_id', filters.creatorId);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.currentStatus) query = query.eq('current_status', filters.currentStatus);
    if (filters.type) query = query.eq('type', filters.type);
    if (filters.tags?.length) query = query.contains('tags', filters.tags);
    if (filters.minReward) query = query.gte('expected_reward', filters.minReward);
    if (filters.maxReward) query = query.lte('expected_reward', filters.maxReward);

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    console.log('listTasks data', data);
    console.log('listTasks error', error);
    ensureNoError(error, 'Failed to list tasks');

    return (data ?? []).map(toTask);
  }

  async findOrderByPayTxHash(payTxHash: string): Promise<Order | null> {
    const { data, error } = await this.supabase
      .query<OrderRow>(ORDER_TABLE)
      .select(ORDER_SELECT_FIELDS)
      .eq('pay_tx_hash', payTxHash)
      .maybeSingle();

    ensureNoError(error, 'Failed to fetch order by payTxHash');
    if (!data) return null;

    return toOrder(data);
  }

  async createOrder(input: CreateOrderInput): Promise<Order> {
    const { data, error } = await this.supabase
      .query<OrderRow>(ORDER_TABLE)
      .insert({
        task_id: input.taskId,
        creator_id: input.creatorId,
        status: input.status,
        reward_amount: input.rewardAmount,
        platform_fee_rate: input.platformFeeRate,
        pay_tx_hash: input.payTxHash,
        escrow_amount: input.escrowAmount,
      })
      .select(ORDER_SELECT_FIELDS)
      .single();

    ensureNoError(error, 'Failed to create order');
    if (!data) throw new Error('Failed to create order: empty response');

    return toOrder(data);
  }

  async deleteOrder(orderId: string): Promise<void> {
    const { error } = await this.supabase.query(ORDER_TABLE).delete().eq('id', orderId);
    ensureNoError(error, 'Failed to delete order');
  }

  async getActiveWalletAddress(userId: string, role: 'A' | 'B'): Promise<string | null> {
    const { data, error } = await this.supabase
      .query<WalletBindingRow>(WALLET_BINDINGS_TABLE)
      .select('address')
      .eq('user_id', userId)
      .eq('role', role)
      .eq('is_active', true)
      .maybeSingle();

    ensureNoError(error, 'Failed to fetch wallet binding');
    return data?.address ?? null;
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
}
