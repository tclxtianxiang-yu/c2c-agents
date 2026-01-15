import { OrderStatus } from '@c2c-agents/shared';
import { Inject, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';

const ORDER_TABLE = 'orders';
const TASK_TABLE = 'tasks';
const WALLET_BINDINGS_TABLE = 'wallet_bindings';

const ORDER_SELECT_FIELDS = `
  id,
  task_id,
  creator_id,
  provider_id,
  status,
  reward_amount,
  platform_fee_rate,
  escrow_amount,
  payout_tx_hash,
  delivered_at,
  accepted_at,
  auto_accepted_at,
  paid_at,
  completed_at
`;

type OrderRow = {
  id: string;
  task_id: string;
  creator_id: string;
  provider_id: string | null;
  status: OrderStatus;
  reward_amount: string | number;
  platform_fee_rate: string | number;
  escrow_amount: string | number | null;
  payout_tx_hash: string | null;
  delivered_at: string | null;
  accepted_at: string | null;
  auto_accepted_at: string | null;
  paid_at: string | null;
  completed_at: string | null;
};

type WalletBindingRow = {
  address: string;
};

function ensureNoError(error: unknown, context: string): void {
  if (!error) return;
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(`${context}: ${message}`);
}

@Injectable()
export class SettlementRepository {
  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  async findOrderById(orderId: string): Promise<OrderRow | null> {
    const { data, error } = await this.supabase
      .query<OrderRow>(ORDER_TABLE)
      .select(ORDER_SELECT_FIELDS)
      .eq('id', orderId)
      .maybeSingle();

    ensureNoError(error, 'Failed to fetch order');
    return data ?? null;
  }

  async listAutoAcceptCandidates(cutoffIso: string): Promise<OrderRow[]> {
    const { data, error } = await this.supabase
      .query<OrderRow>(ORDER_TABLE)
      .select(ORDER_SELECT_FIELDS)
      .eq('status', OrderStatus.Delivered)
      .lte('delivered_at', cutoffIso);

    ensureNoError(error, 'Failed to fetch auto-accept orders');
    return data ?? [];
  }

  async updateOrder(orderId: string, updates: Record<string, unknown>): Promise<void> {
    const { error } = await this.supabase.query(ORDER_TABLE).update(updates).eq('id', orderId);
    ensureNoError(error, 'Failed to update order');
  }

  async updateTaskCurrentStatus(taskId: string, status: OrderStatus): Promise<void> {
    const { error } = await this.supabase
      .query(TASK_TABLE)
      .update({ current_status: status })
      .eq('id', taskId);
    ensureNoError(error, 'Failed to update task current status');
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
}
