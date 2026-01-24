import { QUEUE_MAX_N } from '@c2c-agents/config/constants';
import {
  AgentStatus,
  assertTransition,
  ErrorCode,
  IdempotencyViolationError,
  OrderStatus,
  TaskStatus,
  ValidationError,
} from '@c2c-agents/shared';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { MatchingRepository } from './matching.repository';
import { sortAgents } from './sorting';

type MatchResult =
  | {
      result: 'pairing';
      orderId: string;
      agentId: string;
      providerId: string;
      status: OrderStatus;
    }
  | {
      result: 'queued';
      orderId: string;
      agentId: string;
      status: OrderStatus;
      queuePosition: number;
      queuedCount: number;
      capacity: number;
    };

type CandidateAgent = {
  agentId: string;
  ownerId: string;
  name: string;
  description: string;
  tags: string[];
  supportedTaskTypes: string[];
  minPrice: string;
  maxPrice: string;
  status: AgentStatus;
  queue: {
    queuedCount: number;
    capacity: number;
    available: number;
  };
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class MatchingService {
  constructor(@Inject(MatchingRepository) private readonly repository: MatchingRepository) {}

  async autoMatch(userId: string, taskId: string): Promise<MatchResult> {
    const { task, order } = await this.loadTaskAndOrder(userId, taskId);

    const rawCandidates = await this.repository.listCandidateAgents(
      task.type,
      String(task.expected_reward)
    );
    if (!rawCandidates.length) {
      throw new ValidationError('No eligible agents found');
    }

    // 使用 queue_size 字段进行排序（数据库已包含此冗余字段）
    // 排序规则：Idle > Busy, avgRating DESC, completedOrderCount DESC, queueSize ASC, createdAt ASC
    const sortedCandidates = sortAgents(
      rawCandidates.map((agent) => ({
        id: agent.id,
        name: agent.name,
        status: agent.status,
        avgRating: agent.avg_rating,
        completedOrderCount: agent.completed_order_count,
        queueSize: agent.queue_size,
        createdAt: agent.created_at,
      }))
    );

    // 遍历排序后的候选者
    for (const sorted of sortedCandidates) {
      // 双重校验队列容量（防止 queue_size 字段过期）
      const queueCount = await this.repository.getQueueCount(sorted.id);
      if (queueCount >= QUEUE_MAX_N) {
        continue;
      }

      // 查找原始 agent 数据（需要 owner_id）
      const agent = rawCandidates.find((a) => a.id === sorted.id);
      if (!agent) continue;

      // Idle Agent → 直接创建 Pairing
      if (sorted.status === AgentStatus.Idle) {
        return this.createPairing(task.id, order.id, agent.id, agent.owner_id);
      }

      // Busy Agent → 加入队列
      return this.enqueueOrder(task.id, order.id, agent.id);
    }

    throw new ValidationError('No available agents with queue capacity');
  }

  async manualSelect(userId: string, taskId: string, agentId: string): Promise<MatchResult> {
    const { task, order } = await this.loadTaskAndOrder(userId, taskId);

    const agent = await this.repository.findAgentById(agentId);
    if (!agent || !agent.is_listed) {
      throw new HttpException(
        { code: ErrorCode.BUSINESS_RESOURCE_NOT_FOUND, message: 'Agent not found' },
        404
      );
    }

    const reward = BigInt(task.expected_reward);
    const min = BigInt(agent.min_price);
    const max = BigInt(agent.max_price);
    if (reward < min || reward > max) {
      throw new ValidationError('Reward amount does not match agent pricing range');
    }

    if (!agent.supported_task_types.includes(task.type)) {
      throw new ValidationError('Agent does not support task type');
    }

    const queueCount = await this.repository.getQueueCount(agent.id);
    if (queueCount >= QUEUE_MAX_N) {
      throw new ValidationError('Agent queue is full');
    }

    if (agent.status === AgentStatus.Idle) {
      return this.createPairing(task.id, order.id, agent.id, agent.owner_id);
    }

    return this.enqueueOrder(task.id, order.id, agent.id);
  }

  async listCandidates(userId: string, taskId: string): Promise<CandidateAgent[]> {
    const { task } = await this.loadTaskAndOrder(userId, taskId);
    const candidates = await this.repository.listCandidateAgents(
      task.type,
      String(task.expected_reward)
    );

    const result: CandidateAgent[] = [];
    for (const agent of candidates) {
      const queuedCount = await this.repository.getQueueCount(agent.id);
      result.push({
        agentId: agent.id,
        ownerId: agent.owner_id,
        name: agent.name,
        description: agent.description,
        tags: agent.tags ?? [],
        supportedTaskTypes: agent.supported_task_types ?? [],
        minPrice: String(agent.min_price),
        maxPrice: String(agent.max_price),
        status: agent.status,
        queue: {
          queuedCount,
          capacity: QUEUE_MAX_N,
          available: Math.max(QUEUE_MAX_N - queuedCount, 0),
        },
      });
    }

    return result;
  }

  /**
   * 计算 Agent 状态
   * @param agentId Agent ID
   * @returns Agent 状态：Idle | Busy | Queueing
   *
   * 逻辑：
   * - 查询 InProgress 订单数
   * - 查询队列长度
   * - InProgress > 0 && queue_size > 0 → Queueing
   * - InProgress > 0 → Busy
   * - 否则 → Idle
   */
  async getAgentStatus(agentId: string): Promise<AgentStatus> {
    const inProgressCount = await this.repository.getInProgressOrderCount(agentId);
    const queueCount = await this.repository.getQueueCount(agentId);

    if (inProgressCount > 0) {
      return queueCount > 0 ? AgentStatus.Queueing : AgentStatus.Busy;
    }

    return AgentStatus.Idle;
  }

  private async loadTaskAndOrder(userId: string, taskId: string) {
    const resolvedUserId = await this.resolveUserId(userId);
    if (!resolvedUserId) {
      throw new ValidationError('x-user-id header is required');
    }

    const task = await this.repository.findTaskById(taskId);
    if (!task) {
      throw new HttpException(
        { code: ErrorCode.BUSINESS_RESOURCE_NOT_FOUND, message: 'Task not found' },
        404
      );
    }

    if (task.creator_id !== resolvedUserId) {
      throw new HttpException(
        { code: ErrorCode.AUTH_FORBIDDEN, message: 'Task does not belong to current user' },
        403
      );
    }

    if (task.status !== TaskStatus.Published) {
      throw new ValidationError('Task is not published');
    }

    if (!task.current_order_id || task.current_status !== OrderStatus.Standby) {
      throw new ValidationError('Task is not ready for matching');
    }

    const order = await this.repository.findOrderById(task.current_order_id);
    if (!order) {
      throw new HttpException(
        { code: ErrorCode.BUSINESS_RESOURCE_NOT_FOUND, message: 'Order not found' },
        404
      );
    }

    if (order.status !== OrderStatus.Standby) {
      throw new ValidationError('Order is not in standby status');
    }

    return { task, order };
  }

  private async createPairing(
    taskId: string,
    orderId: string,
    agentId: string,
    providerId: string
  ): Promise<MatchResult> {
    assertTransition(OrderStatus.Standby, OrderStatus.Pairing);
    const pairingCreatedAt = new Date().toISOString();
    const updated = await this.repository.updateOrderPairing(
      orderId,
      agentId,
      providerId,
      pairingCreatedAt
    );
    await this.repository.updateTaskCurrentStatus(taskId, OrderStatus.Pairing);

    return {
      result: 'pairing',
      orderId: updated.id,
      agentId,
      providerId,
      status: updated.status,
    };
  }

  private async enqueueOrder(taskId: string, orderId: string, agentId: string) {
    const existing = await this.repository.findQueuedItem(agentId, orderId);
    if (!existing) {
      const inserted = await this.repository.enqueueQueueItem(agentId, taskId, orderId);
      if (!inserted) {
        throw new IdempotencyViolationError('Order already queued for agent');
      }
    }

    const items = await this.repository.listQueuedItems(agentId);
    const position = items.findIndex((item) => item.order_id === orderId);
    const queuePosition = position >= 0 ? position + 1 : items.length;

    return {
      result: 'queued' as const,
      orderId,
      agentId,
      status: OrderStatus.Standby,
      queuePosition,
      queuedCount: items.length,
      capacity: QUEUE_MAX_N,
    };
  }

  private async resolveUserId(userId: string | null): Promise<string | null> {
    if (!userId) return null;
    if (UUID_RE.test(userId)) return userId;
    return this.repository.findActiveUserIdByAddress(userId);
  }
}
