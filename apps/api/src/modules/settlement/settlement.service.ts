import { AUTO_ACCEPT_HOURS, PLATFORM_FEE_RATE } from '@c2c-agents/config/constants';
import { ErrorCode, OrderStatus, ValidationError } from '@c2c-agents/shared';
import { assertTransition } from '@c2c-agents/shared/state-machine';
import { calculateFee, shouldAutoAccept } from '@c2c-agents/shared/utils';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { ChainService } from '../core/chain.service';
import { SettlementRepository } from './settlement.repository';

type AutoAcceptSummary = {
  processed: number;
  succeeded: number;
  failed: Array<{ orderId: string; reason: string }>;
};

function toStringAmount(value: string | number | null): string {
  if (value === null || value === undefined) return '0';
  return typeof value === 'number' ? value.toString() : value;
}

@Injectable()
export class SettlementService {
  constructor(
    @Inject(SettlementRepository) private readonly repository: SettlementRepository,
    @Inject(ChainService) private readonly chainService: ChainService
  ) {}

  async acceptOrder(userId: string, orderId: string) {
    const order = await this.repository.findOrderById(orderId);
    if (!order) {
      throw new HttpException(
        { code: ErrorCode.BUSINESS_RESOURCE_NOT_FOUND, message: 'Order not found' },
        404
      );
    }

    if (order.creator_id !== userId) {
      throw new HttpException(
        { code: ErrorCode.AUTH_FORBIDDEN, message: 'Order does not belong to current user' },
        403
      );
    }

    if (order.payout_tx_hash) {
      return {
        paidAt: order.paid_at,
        completedAt: order.completed_at,
        payoutTxHash: order.payout_tx_hash,
      };
    }

    if (order.status !== OrderStatus.Delivered && order.status !== OrderStatus.Accepted) {
      throw new ValidationError('Order is not in delivered status');
    }

    if (!order.provider_id) {
      throw new ValidationError('Order provider is not ready');
    }

    const creatorAddress = await this.repository.getActiveWalletAddress(order.creator_id, 'A');
    const providerAddress = await this.repository.getActiveWalletAddress(order.provider_id, 'B');
    if (!creatorAddress || !providerAddress) {
      throw new ValidationError('Active wallet address not found');
    }

    const grossAmount = order.escrow_amount ?? order.reward_amount;
    if (!grossAmount) {
      throw new ValidationError('Escrow amount not recorded');
    }

    if (order.status === OrderStatus.Delivered) {
      assertTransition(order.status, OrderStatus.Accepted);
      const acceptedAt = new Date().toISOString();
      await this.repository.updateOrder(order.id, {
        status: OrderStatus.Accepted,
        accepted_at: acceptedAt,
      });
    }

    const feeRate = Number(order.platform_fee_rate);
    const finalFeeRate = Number.isFinite(feeRate) ? feeRate : PLATFORM_FEE_RATE;

    const payoutResult = await this.chainService.executePayout({
      orderId: order.id,
      creatorAddress,
      providerAddress,
      grossAmount: toStringAmount(grossAmount),
      feeRate: finalFeeRate,
    });

    if (!payoutResult.success) {
      console.error('[Settlement] Payout failed for order:', order.id, {
        creatorAddress,
        providerAddress,
        grossAmount: toStringAmount(grossAmount),
        feeRate: finalFeeRate,
        errorCode: payoutResult.error.code,
        errorMessage: payoutResult.error.message,
        errorDetails: payoutResult.error.details,
      });
      throw payoutResult.error;
    }

    const { feeAmount } = calculateFee(toStringAmount(grossAmount), finalFeeRate);
    const paidAt = new Date().toISOString();

    assertTransition(OrderStatus.Accepted, OrderStatus.Paid);
    await this.repository.updateOrder(order.id, {
      status: OrderStatus.Paid,
      paid_at: paidAt,
      payout_tx_hash: payoutResult.txHash,
      platform_fee_amount: feeAmount,
    });
    await this.repository.updateTaskCurrentStatus(order.task_id, OrderStatus.Paid);

    const completedAt = new Date().toISOString();
    assertTransition(OrderStatus.Paid, OrderStatus.Completed);
    await this.repository.updateOrder(order.id, {
      status: OrderStatus.Completed,
      completed_at: completedAt,
    });
    await this.repository.updateTaskCurrentStatus(order.task_id, OrderStatus.Completed);

    return {
      paidAt,
      completedAt,
      payoutTxHash: payoutResult.txHash,
    };
  }

  async runAutoAccept(): Promise<AutoAcceptSummary> {
    const cutoff = new Date(Date.now() - AUTO_ACCEPT_HOURS * 60 * 60 * 1000).toISOString();
    const candidates = await this.repository.listAutoAcceptCandidates(cutoff);

    const summary: AutoAcceptSummary = {
      processed: candidates.length,
      succeeded: 0,
      failed: [],
    };

    for (const order of candidates) {
      try {
        if (!order.delivered_at || !shouldAutoAccept(order.delivered_at, AUTO_ACCEPT_HOURS)) {
          continue;
        }
        await this.processAutoAccept(order);
        summary.succeeded += 1;
      } catch (error) {
        summary.failed.push({
          orderId: order.id,
          reason: error instanceof Error ? error.message : 'Auto-accept failed',
        });
      }
    }

    return summary;
  }

  private async processAutoAccept(order: {
    id: string;
    task_id: string;
    creator_id: string;
    provider_id: string | null;
    status: OrderStatus;
    reward_amount: string | number;
    platform_fee_rate: string | number;
    escrow_amount: string | number | null;
    delivered_at: string | null;
  }) {
    if (order.status !== OrderStatus.Delivered) {
      return;
    }
    if (!order.provider_id) {
      throw new ValidationError('Order provider is not ready');
    }

    const creatorAddress = await this.repository.getActiveWalletAddress(order.creator_id, 'A');
    const providerAddress = await this.repository.getActiveWalletAddress(order.provider_id, 'B');
    if (!creatorAddress || !providerAddress) {
      throw new ValidationError('Active wallet address not found');
    }

    const grossAmount = order.escrow_amount ?? order.reward_amount;
    if (!grossAmount) {
      throw new ValidationError('Escrow amount not recorded');
    }

    assertTransition(order.status, OrderStatus.AutoAccepted);
    const autoAcceptedAt = new Date().toISOString();
    await this.repository.updateOrder(order.id, {
      status: OrderStatus.AutoAccepted,
      auto_accepted_at: autoAcceptedAt,
    });
    await this.repository.updateTaskCurrentStatus(order.task_id, OrderStatus.AutoAccepted);

    const feeRate = Number(order.platform_fee_rate);
    const finalFeeRate = Number.isFinite(feeRate) ? feeRate : PLATFORM_FEE_RATE;

    const payoutResult = await this.chainService.executePayout({
      orderId: order.id,
      creatorAddress,
      providerAddress,
      grossAmount: toStringAmount(grossAmount),
      feeRate: finalFeeRate,
    });

    if (!payoutResult.success) {
      console.error('[Settlement] Auto-accept payout failed for order:', order.id, {
        creatorAddress,
        providerAddress,
        grossAmount: toStringAmount(grossAmount),
        feeRate: finalFeeRate,
        errorCode: payoutResult.error.code,
        errorMessage: payoutResult.error.message,
        errorDetails: payoutResult.error.details,
      });
      throw payoutResult.error;
    }

    const { feeAmount } = calculateFee(toStringAmount(grossAmount), finalFeeRate);
    const paidAt = new Date().toISOString();

    assertTransition(OrderStatus.AutoAccepted, OrderStatus.Paid);
    await this.repository.updateOrder(order.id, {
      status: OrderStatus.Paid,
      paid_at: paidAt,
      payout_tx_hash: payoutResult.txHash,
      platform_fee_amount: feeAmount,
    });
    await this.repository.updateTaskCurrentStatus(order.task_id, OrderStatus.Paid);

    const completedAt = new Date().toISOString();
    assertTransition(OrderStatus.Paid, OrderStatus.Completed);
    await this.repository.updateOrder(order.id, {
      status: OrderStatus.Completed,
      completed_at: completedAt,
    });
    await this.repository.updateTaskCurrentStatus(order.task_id, OrderStatus.Completed);
  }
}
