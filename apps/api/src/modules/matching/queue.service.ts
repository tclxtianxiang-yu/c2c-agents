import { AgentStatus, OrderStatus } from '@c2c-agents/shared';
import { Inject, Injectable } from '@nestjs/common';
import { MatchingRepository } from './matching.repository';
import { PairingService } from './pairing.service';

type ConsumeNextResult = {
  consumed: boolean;
  orderId?: string;
  pairingInfo?: {
    orderId: string;
    agentId: string;
    providerId: string;
    expiresAt: string;
    pairingCreatedAt: string;
  };
};

@Injectable()
export class QueueService {
  constructor(
    @Inject(MatchingRepository) private readonly repository: MatchingRepository,
    @Inject(PairingService) private readonly pairingService: PairingService
  ) {}

  /**
   * 消费队列中的下一个 Order
   * @param agentId Agent ID
   * @returns 消费结果
   *
   * 步骤：
   * 1. 原子抢占队列中的第一个 QueueItem（FOR UPDATE SKIP LOCKED）
   * 2. 若成功消费 → 创建 Pairing
   * 3. 更新 Agent.queue_size -= 1
   */
  async consumeNext(agentId: string): Promise<ConsumeNextResult> {
    // 校验 Agent 是否存在
    const agent = await this.repository.findAgentById(agentId);
    if (!agent) {
      return { consumed: false };
    }

    // 校验 Agent 是否有进行中的订单（应该已完成才能消费队列）
    const inProgressCount = await this.repository.getInProgressOrderCount(agentId);
    if (inProgressCount > 0) {
      // Agent 仍有进行中的订单，不应该消费队列
      console.warn(
        `Agent ${agentId} still has ${inProgressCount} in-progress orders, cannot consume queue`
      );
      return { consumed: false };
    }

    // 原子抢占队列中的第一个 QueueItem
    const queueItem = await this.repository.atomicConsumeQueueItem(agentId);
    if (!queueItem) {
      // 队列为空
      return { consumed: false };
    }

    // 校验 Order 是否仍处于 Standby 状态
    const order = await this.repository.findOrderById(queueItem.order_id);
    if (!order) {
      console.warn(`Order ${queueItem.order_id} not found`);
      return { consumed: false };
    }

    if (order.status !== OrderStatus.Standby) {
      console.warn(`Order ${queueItem.order_id} is not in Standby status, cannot create pairing`);
      return { consumed: false };
    }

    // 创建 Pairing
    const pairingInfo = await this.pairingService.createPairing(order.id, agentId);

    // 更新 Agent 状态为 Idle（因为刚完成上一个订单）
    await this.repository.updateAgentStatus(agentId, AgentStatus.Idle, null);

    // 注意：queue_size 字段应该通过数据库触发器自动维护
    // 如果没有触发器，需要手动递减
    // await this.repository.updateAgentQueueSize(agentId, agent.queue_size - 1);

    return {
      consumed: true,
      orderId: order.id,
      pairingInfo,
    };
  }

  /**
   * 批量消费队列（可选优化）
   * @param agentId Agent ID
   * @param maxCount 最多消费数量
   * @returns 消费的订单列表
   */
  async consumeBatch(agentId: string, maxCount: number): Promise<ConsumeNextResult[]> {
    const results: ConsumeNextResult[] = [];

    for (let i = 0; i < maxCount; i++) {
      const result = await this.consumeNext(agentId);
      if (!result.consumed) {
        break;
      }
      results.push(result);
    }

    return results;
  }
}
