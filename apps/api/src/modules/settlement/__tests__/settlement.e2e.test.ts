import { randomUUID } from 'node:crypto';
import { OrderStatus } from '@c2c-agents/shared';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DatabaseModule } from '../../../database/database.module';
import { SupabaseService } from '../../../database/supabase.service';
import { ChainService } from '../../core/chain.service';
import { CoreModule } from '../../core/core.module';
import { SettlementModule } from '../settlement.module';
import { SettlementRepository } from '../settlement.repository';

type OrderRecord = {
  id: string;
  task_id: string;
  creator_id: string;
  provider_id: string | null;
  status: OrderStatus;
  reward_amount: string;
  platform_fee_rate: string;
  escrow_amount: string | null;
  payout_tx_hash: string | null;
  delivered_at: string | null;
  accepted_at: string | null;
  auto_accepted_at: string | null;
  paid_at: string | null;
  completed_at: string | null;
};

class InMemorySettlementRepository {
  private orders = new Map<string, OrderRecord>();

  seedOrder(order: OrderRecord) {
    this.orders.set(order.id, order);
  }

  async findOrderById(orderId: string): Promise<OrderRecord | null> {
    return this.orders.get(orderId) ?? null;
  }

  async listAutoAcceptCandidates(cutoffIso: string): Promise<OrderRecord[]> {
    return Array.from(this.orders.values()).filter((order) => {
      return (
        order.status === OrderStatus.Delivered &&
        !!order.delivered_at &&
        order.delivered_at <= cutoffIso
      );
    });
  }

  async updateOrder(orderId: string, updates: Record<string, unknown>): Promise<void> {
    const order = this.orders.get(orderId);
    if (!order) return;
    this.orders.set(orderId, { ...order, ...(updates as Partial<OrderRecord>) });
  }

  async updateTaskCurrentStatus(): Promise<void> {
    // noop: not needed in this test stub
  }

  async getActiveWalletAddress(): Promise<string | null> {
    return '0xabc';
  }
}

describe('SettlementModule (e2e)', () => {
  let app: INestApplication;
  let repository: InMemorySettlementRepository;

  beforeAll(async () => {
    repository = new InMemorySettlementRepository();

    const moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule, CoreModule, SettlementModule],
    })
      .overrideProvider(SupabaseService)
      .useValue({
        checkHealth: jest.fn(async () => ({ ok: true })),
        query: jest.fn(),
      })
      .overrideProvider(SettlementRepository)
      .useValue(repository)
      .overrideProvider(ChainService)
      .useValue({
        executePayout: async () => ({
          success: true,
          orderKey: '0xorder',
          txHash: '0xtx',
          confirmations: 1,
          grossAmount: '1000000',
          netAmount: '850000',
          feeAmount: '150000',
        }),
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts order and completes payout', async () => {
    const orderId = randomUUID();
    repository.seedOrder({
      id: orderId,
      task_id: 'task-1',
      creator_id: 'user-a',
      provider_id: 'user-b',
      status: OrderStatus.Delivered,
      reward_amount: '1000000',
      platform_fee_rate: '0.15',
      escrow_amount: '1000000',
      payout_tx_hash: null,
      delivered_at: new Date().toISOString(),
      accepted_at: null,
      auto_accepted_at: null,
      paid_at: null,
      completed_at: null,
    });

    const response = await request(app.getHttpServer())
      .post(`/orders/${orderId}/accept`)
      .set('x-user-id', 'user-a')
      .expect(201);

    expect(response.body.payoutTxHash).toBe('0xtx');
  });

  it('runs auto-accept batch', async () => {
    const orderId = randomUUID();
    const past = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    repository.seedOrder({
      id: orderId,
      task_id: 'task-2',
      creator_id: 'user-a',
      provider_id: 'user-b',
      status: OrderStatus.Delivered,
      reward_amount: '1000000',
      platform_fee_rate: '0.15',
      escrow_amount: '1000000',
      payout_tx_hash: null,
      delivered_at: past,
      accepted_at: null,
      auto_accepted_at: null,
      paid_at: null,
      completed_at: null,
    });

    const response = await request(app.getHttpServer()).post('/settlement/auto-accept').expect(201);

    expect(response.body.processed).toBeGreaterThan(0);
  });
});
