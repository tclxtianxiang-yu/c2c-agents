import { PAIRING_TTL_HOURS } from '@c2c-agents/config/constants';
import {
  AgentStatus,
  assertTransition,
  ErrorCode,
  OrderStatus,
  ValidationError,
} from '@c2c-agents/shared';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { MatchingRepository } from './matching.repository';

type PairingInfo = {
  orderId: string;
  agentId: string;
  providerId: string;
  expiresAt: string;
  pairingCreatedAt: string;
};

type PairingAcceptResult = {
  orderId: string;
  status: OrderStatus;
  message: string;
};

@Injectable()
export class PairingService {
  constructor(@Inject(MatchingRepository) private readonly repository: MatchingRepository) {}

  /**
   * 创建 Pairing
   * @param orderId 订单 ID
   * @param agentId Agent ID
   * @returns Pairing 信息
   */
  async createPairing(orderId: string, agentId: string): Promise<PairingInfo> {
    // 校验 Order 状态
    const order = await this.repository.findOrderById(orderId);
    if (!order) {
      throw new HttpException(
        { code: ErrorCode.BUSINESS_RESOURCE_NOT_FOUND, message: 'Order not found' },
        404
      );
    }

    if (order.status !== OrderStatus.Standby) {
      throw new ValidationError('Order is not in Standby status');
    }

    // 校验 Agent 是否存在且可用
    const agent = await this.repository.findAgentById(agentId);
    if (!agent || !agent.is_listed) {
      throw new HttpException(
        { code: ErrorCode.BUSINESS_RESOURCE_NOT_FOUND, message: 'Agent not found or not listed' },
        404
      );
    }

    // 校验状态机转移
    assertTransition(OrderStatus.Standby, OrderStatus.Pairing);

    // 创建 Pairing
    const pairingCreatedAt = new Date().toISOString();
    await this.repository.updateOrderPairing(orderId, agentId, agent.owner_id, pairingCreatedAt);

    // 更新 Task 的 current_status
    const task = await this.repository.findTaskById(order.task_id);
    if (task) {
      await this.repository.updateTaskCurrentStatus(task.id, OrderStatus.Pairing);
    }

    // 计算过期时间
    const expiresAt = new Date(
      new Date(pairingCreatedAt).getTime() + PAIRING_TTL_HOURS * 60 * 60 * 1000
    ).toISOString();

    return {
      orderId,
      agentId,
      providerId: agent.owner_id,
      expiresAt,
      pairingCreatedAt,
    };
  }

  /**
   * 同意 Pairing
   * @param orderId 订单 ID
   * @param userId 用户 ID（A 或 B）
   * @param role 角色（'A' 或 'B'）
   * @returns 操作结果
   *
   * 注意：当前实现简化为"任一方同意则立即进入 InProgress"
   * 如需双方同意逻辑，需要 Owner #1 添加 a_agreed/b_agreed 字段
   */
  async acceptPairing(
    orderId: string,
    userId: string,
    role: 'A' | 'B'
  ): Promise<PairingAcceptResult> {
    // 校验 Order 状态
    const order = await this.repository.findOrderById(orderId);
    if (!order) {
      throw new HttpException(
        { code: ErrorCode.BUSINESS_RESOURCE_NOT_FOUND, message: 'Order not found' },
        404
      );
    }

    if (order.status !== OrderStatus.Pairing) {
      throw new ValidationError('Order is not in Pairing status');
    }

    // 校验权限
    if (role === 'A' && order.creator_id !== userId) {
      throw new HttpException(
        { code: ErrorCode.AUTH_FORBIDDEN, message: 'User is not the creator of this order' },
        403
      );
    }

    if (role === 'B' && order.provider_id !== userId) {
      throw new HttpException(
        { code: ErrorCode.AUTH_FORBIDDEN, message: 'User is not the provider of this order' },
        403
      );
    }

    // 检查是否超时
    if (order.pairing_created_at) {
      const expiresAt = new Date(
        new Date(order.pairing_created_at).getTime() + PAIRING_TTL_HOURS * 60 * 60 * 1000
      );
      if (new Date() > expiresAt) {
        throw new ValidationError('Pairing has expired');
      }
    }

    // 简化实现：任一方同意则直接进入 InProgress
    // TODO: 如需双方同意逻辑，需要添加 a_agreed/b_agreed 字段
    assertTransition(OrderStatus.Pairing, OrderStatus.InProgress);

    // 更新 Order 状态
    await this.repository.updateOrderStatus(orderId, OrderStatus.InProgress);

    // 更新 Agent 状态
    if (order.agent_id) {
      await this.repository.updateAgentStatus(order.agent_id, AgentStatus.Busy, orderId);
    }

    // 更新 Task 的 current_status
    const task = await this.repository.findTaskById(order.task_id);
    if (task) {
      await this.repository.updateTaskCurrentStatus(task.id, OrderStatus.InProgress);
    }

    return {
      orderId,
      status: OrderStatus.InProgress,
      message: 'Pairing accepted, order is now in progress',
    };
  }

  /**
   * 拒绝 Pairing
   * @param orderId 订单 ID
   * @param userId 用户 ID（A 或 B）
   * @param role 角色（'A' 或 'B'）
   * @returns 操作结果
   */
  async rejectPairing(
    orderId: string,
    userId: string,
    role: 'A' | 'B'
  ): Promise<PairingAcceptResult> {
    // 校验 Order 状态
    const order = await this.repository.findOrderById(orderId);
    if (!order) {
      throw new HttpException(
        { code: ErrorCode.BUSINESS_RESOURCE_NOT_FOUND, message: 'Order not found' },
        404
      );
    }

    if (order.status !== OrderStatus.Pairing) {
      throw new ValidationError('Order is not in Pairing status');
    }

    // 校验权限
    if (role === 'A' && order.creator_id !== userId) {
      throw new HttpException(
        { code: ErrorCode.AUTH_FORBIDDEN, message: 'User is not the creator of this order' },
        403
      );
    }

    if (role === 'B' && order.provider_id !== userId) {
      throw new HttpException(
        { code: ErrorCode.AUTH_FORBIDDEN, message: 'User is not the provider of this order' },
        403
      );
    }

    // 校验状态机转移
    assertTransition(OrderStatus.Pairing, OrderStatus.Standby);

    // 更新 Order 状态：回到 Standby
    await this.repository.clearOrderPairing(orderId);

    // 如果来源为 QueueItem，则标记为 canceled
    if (order.agent_id) {
      await this.repository.cancelQueueItem(order.agent_id, orderId);
    }

    // 更新 Task 的 current_status
    const task = await this.repository.findTaskById(order.task_id);
    if (task) {
      await this.repository.updateTaskCurrentStatus(task.id, OrderStatus.Standby);
    }

    return {
      orderId,
      status: OrderStatus.Standby,
      message: 'Pairing rejected, order returned to Standby',
    };
  }

  /**
   * 检查并处理 Pairing 超时
   * @returns 处理的超时 Pairing 数量
   *
   * 注意：这个方法应该由定时任务（cron）调用
   */
  async checkPairingExpiration(): Promise<{ processedCount: number; expiredOrderIds: string[] }> {
    // 计算超时阈值
    const expirationThreshold = new Date(
      Date.now() - PAIRING_TTL_HOURS * 60 * 60 * 1000
    ).toISOString();

    // 查询所有 Pairing 状态且已超时的订单
    const expiredOrders = await this.repository.findExpiredPairings(expirationThreshold);

    const expiredOrderIds: string[] = [];

    for (const order of expiredOrders) {
      try {
        // 更新 Order 状态：回到 Standby
        await this.repository.clearOrderPairing(order.id);

        // 如果来源为 QueueItem，则标记为 canceled
        if (order.agent_id) {
          await this.repository.cancelQueueItem(order.agent_id, order.id);
        }

        // 更新 Task 的 current_status
        const task = await this.repository.findTaskById(order.task_id);
        if (task) {
          await this.repository.updateTaskCurrentStatus(task.id, OrderStatus.Standby);
        }

        expiredOrderIds.push(order.id);
      } catch (error) {
        // 记录错误但继续处理其他订单
        console.error(`Failed to expire pairing for order ${order.id}:`, error);
      }
    }

    return {
      processedCount: expiredOrderIds.length,
      expiredOrderIds,
    };
  }
}
