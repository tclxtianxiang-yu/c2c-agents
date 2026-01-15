import { OrderStatus, ValidationError } from '@c2c-agents/shared';
import { describe, expect, it, jest } from '@jest/globals';
import type { ChainService } from '../../core/chain.service';
import type { SettlementRepository } from '../settlement.repository';
import { SettlementService } from '../settlement.service';

describe('SettlementService', () => {
  it('accepts delivered order and executes payout', async () => {
    const repository = {
      findOrderById: jest.fn(async () => ({
        id: 'order-1',
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
      })),
      getActiveWalletAddress: jest.fn(async () => '0xabc'),
      updateOrder: jest.fn(async () => undefined),
      updateTaskCurrentStatus: jest.fn(async () => undefined),
    } as unknown as SettlementRepository;

    const chainService = {
      executePayout: jest.fn(async () => ({
        success: true,
        orderKey: '0xorder',
        txHash: '0xtx',
        confirmations: 1,
        grossAmount: '1000000',
        netAmount: '850000',
        feeAmount: '150000',
      })),
    } as unknown as ChainService;

    const service = new SettlementService(repository, chainService);
    const result = await service.acceptOrder('user-a', 'order-1');

    expect(result.payoutTxHash).toBe('0xtx');
    expect(repository.updateOrder).toHaveBeenCalled();
  });

  it('rejects accept when order is not delivered', async () => {
    const repository = {
      findOrderById: jest.fn(async () => ({
        id: 'order-1',
        task_id: 'task-1',
        creator_id: 'user-a',
        provider_id: 'user-b',
        status: OrderStatus.InProgress,
        reward_amount: '1000000',
        platform_fee_rate: '0.15',
        escrow_amount: '1000000',
        payout_tx_hash: null,
        delivered_at: null,
        accepted_at: null,
        auto_accepted_at: null,
        paid_at: null,
        completed_at: null,
      })),
    } as unknown as SettlementRepository;

    const chainService = {} as ChainService;
    const service = new SettlementService(repository, chainService);

    await expect(service.acceptOrder('user-a', 'order-1')).rejects.toBeInstanceOf(ValidationError);
  });
});
