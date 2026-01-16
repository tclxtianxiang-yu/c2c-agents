import { QUEUE_MAX_N } from '@c2c-agents/config/constants';
import { ErrorCode, type QueueItem } from '@c2c-agents/shared';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { AgentRepository } from '../agent/agent.repository';
import type { QueueStatusDto } from './dtos/queue-status.dto';
import { QueueRepository } from './queue.repository';

@Injectable()
export class QueueService {
  constructor(
    @Inject(QueueRepository) private readonly repository: QueueRepository,
    @Inject(AgentRepository) private readonly agentRepository: AgentRepository
  ) {}

  /**
   * 将订单加入 Agent 队列
   * @throws BadRequestException 如果队列已满
   * @throws ConflictException 如果已在队列中
   */
  async enqueue(params: { agentId: string; taskId: string; orderId: string }): Promise<QueueItem> {
    const { agentId, taskId, orderId } = params;

    // 1. 检查队列容量
    const queuedCount = await this.repository.getQueuedCount(agentId);
    if (queuedCount >= QUEUE_MAX_N) {
      throw new BadRequestException({
        code: ErrorCode.BUSINESS_QUEUE_FULL,
        message: `Queue is full (max ${QUEUE_MAX_N})`,
      });
    }

    // 2. 入队（幂等：ON CONFLICT DO NOTHING）
    const queueItem = await this.repository.enqueue({ agentId, taskId, orderId });

    if (!queueItem) {
      throw new ConflictException({
        code: ErrorCode.BUSINESS_IDEMPOTENCY_VIOLATION,
        message: 'Order already in queue',
      });
    }

    // 3. 更新 Agent 的 queue_size
    await this.updateAgentQueueSize(agentId);

    return queueItem;
  }

  /**
   * 消费队列中最早的订单（原子操作）
   * @returns QueueItem 或 null（队列为空）
   */
  async consumeNext(agentId: string): Promise<QueueItem | null> {
    const item = await this.repository.consumeNext(agentId);

    if (item) {
      // 更新 Agent 的 queue_size
      await this.updateAgentQueueSize(agentId);
    }

    return item;
  }

  /**
   * 取消队列中的特定订单
   */
  async cancel(agentId: string, orderId: string): Promise<void> {
    await this.repository.cancel(agentId, orderId);

    // 更新 Agent 的 queue_size
    await this.updateAgentQueueSize(agentId);
  }

  /**
   * 查询 Agent 队列状态
   */
  async getQueueStatus(agentId: string): Promise<QueueStatusDto> {
    const items = await this.repository.getQueuedItems(agentId);
    const queuedCount = items.length;
    const capacity = QUEUE_MAX_N;
    const available = Math.max(0, capacity - queuedCount);

    return {
      agentId,
      queuedCount,
      capacity,
      available,
      items,
    };
  }

  /**
   * 检查订单是否在队列中
   */
  async isInQueue(agentId: string, orderId: string): Promise<boolean> {
    return this.repository.isInQueue(agentId, orderId);
  }

  /**
   * 获取订单在队列中的位置（1-based）
   */
  async getQueuePosition(agentId: string, orderId: string): Promise<number | null> {
    return this.repository.getQueuePosition(agentId, orderId);
  }

  /**
   * 更新 Agent 的 queue_size 字段（冗余字段）
   */
  private async updateAgentQueueSize(agentId: string): Promise<void> {
    try {
      const queuedCount = await this.repository.getQueuedCount(agentId);
      await this.agentRepository.updateAgent(agentId, { queueSize: queuedCount });
    } catch (error) {
      // 如果 Agent 不存在或更新失败，记录警告但不抛错
      console.warn(
        `[QueueService] Failed to update queue_size for agent ${agentId}:`,
        error instanceof Error ? error.message : error
      );
    }
  }
}
