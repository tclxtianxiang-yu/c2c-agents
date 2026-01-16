import type { QueueItem, QueueItemStatus } from '@c2c-agents/shared';
import { Inject, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';

const QUEUE_ITEMS_TABLE = 'queue_items';

type QueueItemRow = {
  id: string;
  agent_id: string;
  task_id: string;
  order_id: string;
  status: QueueItemStatus;
  created_at: string;
  consumed_at: string | null;
  canceled_at: string | null;
};

const QUEUE_ITEM_SELECT_FIELDS = `
  id,
  agent_id,
  task_id,
  order_id,
  status,
  created_at,
  consumed_at,
  canceled_at
`;

function toQueueItem(row: QueueItemRow): QueueItem {
  return {
    id: row.id,
    agentId: row.agent_id,
    taskId: row.task_id,
    orderId: row.order_id,
    status: row.status,
    createdAt: row.created_at,
    consumedAt: row.consumed_at,
    canceledAt: row.canceled_at,
  };
}

function ensureNoError(error: unknown, context: string): void {
  if (!error) return;

  // 处理 Supabase 错误对象
  if (error && typeof error === 'object' && 'message' in error) {
    const errorObj = error as { message?: string; details?: string; hint?: string; code?: string };
    const details = [errorObj.message, errorObj.details, errorObj.hint, errorObj.code]
      .filter(Boolean)
      .join(' | ');
    throw new Error(`${context}: ${details || JSON.stringify(error)}`);
  }

  const message = error instanceof Error ? error.message : String(error);
  throw new Error(`${context}: ${message}`);
}

@Injectable()
export class QueueRepository {
  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  async getQueuedCount(agentId: string): Promise<number> {
    const { count, error } = await this.supabase
      .query(QUEUE_ITEMS_TABLE)
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('status', 'queued');

    ensureNoError(error, 'Failed to count queued items');
    return count ?? 0;
  }

  async enqueue(params: {
    agentId: string;
    taskId: string;
    orderId: string;
  }): Promise<QueueItem | null> {
    const { data, error } = await this.supabase
      .query<QueueItemRow>(QUEUE_ITEMS_TABLE)
      .insert({
        agent_id: params.agentId,
        task_id: params.taskId,
        order_id: params.orderId,
        status: 'queued',
      })
      .select(QUEUE_ITEM_SELECT_FIELDS)
      .single();

    // 如果是唯一约束冲突（已存在 queued），返回 null
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      return null;
    }

    ensureNoError(error, 'Failed to enqueue');
    if (!data) return null;

    return toQueueItem(data);
  }

  async consumeNext(agentId: string): Promise<QueueItem | null> {
    // 使用原子操作：FOR UPDATE SKIP LOCKED
    const { data, error } = await this.supabase.rpc('consume_next_queue_item', {
      p_agent_id: agentId,
    });

    if (error) {
      // 如果函数不存在，fallback 到手动实现
      if (error.code === '42883') {
        return this.consumeNextFallback(agentId);
      }
      ensureNoError(error, 'Failed to consume next queue item');
    }

    if (!data || data.length === 0) return null;
    return toQueueItem(data[0]);
  }

  private async consumeNextFallback(agentId: string): Promise<QueueItem | null> {
    // Fallback: 手动查询+更新（非原子，但能工作）
    const { data: items, error: selectError } = await this.supabase
      .query<QueueItemRow>(QUEUE_ITEMS_TABLE)
      .select(QUEUE_ITEM_SELECT_FIELDS)
      .eq('agent_id', agentId)
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1);

    ensureNoError(selectError, 'Failed to find next queue item');

    if (!items || items.length === 0) return null;

    const item = items[0];

    const { data: updated, error: updateError } = await this.supabase
      .query<QueueItemRow>(QUEUE_ITEMS_TABLE)
      .update({
        status: 'consumed',
        consumed_at: new Date().toISOString(),
      })
      .eq('id', item.id)
      .eq('status', 'queued')
      .select(QUEUE_ITEM_SELECT_FIELDS)
      .single();

    ensureNoError(updateError, 'Failed to update queue item to consumed');

    if (!updated) return null;
    return toQueueItem(updated);
  }

  async cancel(agentId: string, orderId: string): Promise<void> {
    const { error } = await this.supabase
      .query(QUEUE_ITEMS_TABLE)
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
      })
      .eq('agent_id', agentId)
      .eq('order_id', orderId)
      .eq('status', 'queued');

    ensureNoError(error, 'Failed to cancel queue item');
  }

  async getQueuedItems(agentId: string): Promise<QueueItem[]> {
    const { data, error } = await this.supabase
      .query<QueueItemRow>(QUEUE_ITEMS_TABLE)
      .select(QUEUE_ITEM_SELECT_FIELDS)
      .eq('agent_id', agentId)
      .eq('status', 'queued')
      .order('created_at', { ascending: true });

    ensureNoError(error, 'Failed to get queued items');

    return (data ?? []).map(toQueueItem);
  }

  async getQueuePosition(agentId: string, orderId: string): Promise<number | null> {
    const items = await this.getQueuedItems(agentId);
    const index = items.findIndex((item) => item.orderId === orderId);
    return index === -1 ? null : index + 1; // 1-based
  }

  async isInQueue(agentId: string, orderId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .query(QUEUE_ITEMS_TABLE)
      .select('id')
      .eq('agent_id', agentId)
      .eq('order_id', orderId)
      .eq('status', 'queued')
      .maybeSingle();

    ensureNoError(error, 'Failed to check if in queue');
    return !!data;
  }
}
