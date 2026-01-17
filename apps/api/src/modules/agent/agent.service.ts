import { AgentStatus, ErrorCode, ValidationError } from '@c2c-agents/shared';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { AgentRepository } from './agent.repository';
import type { AgentListQueryDto } from './dtos/agent-list-query.dto';
import type { CreateAgentDto } from './dtos/create-agent.dto';
import type { UpdateAgentDto } from './dtos/update-agent.dto';

const MAX_TAGS = 10;

function isNonEmptyText(value: string | undefined | null): boolean {
  return Boolean(value && value.trim().length > 0);
}

function isValidMinUnit(value: string): boolean {
  if (!/^[0-9]+$/.test(value)) return false;
  return true;
}

@Injectable()
export class AgentService {
  constructor(@Inject(AgentRepository) private readonly repository: AgentRepository) {}

  async createAgent(userId: string, input: CreateAgentDto) {
    if (!userId) {
      throw new ValidationError('userId is required');
    }

    this.validateCreateAgent(input);

    const agent = await this.repository.createAgent({
      ownerId: userId,
      name: input.name.trim(),
      description: input.description.trim(),
      avatarUrl: input.avatarUrl?.trim(),
      mastraUrl: input.mastraUrl.trim(),
      tags: input.tags ?? [],
      supportedTaskTypes: input.supportedTaskTypes,
      minPrice: input.minPrice,
      maxPrice: input.maxPrice,
    });

    return agent;
  }

  async findById(agentId: string) {
    const agent = await this.repository.findAgentById(agentId);
    if (!agent) {
      throw new HttpException(
        { code: ErrorCode.BUSINESS_RESOURCE_NOT_FOUND, message: 'Agent not found' },
        404
      );
    }

    // 动态计算状态
    agent.status = await this.computeAgentStatus(agentId);

    return agent;
  }

  async findByOwnerId(userId: string) {
    if (!userId) {
      throw new ValidationError('userId is required');
    }

    const agents = await this.repository.findAgentsByOwnerId(userId);

    // 批量计算状态
    for (const agent of agents) {
      agent.status = await this.computeAgentStatus(agent.id);
    }

    return agents;
  }

  async updateAgent(userId: string, agentId: string, input: UpdateAgentDto) {
    if (!userId) {
      throw new ValidationError('userId is required');
    }

    const agent = await this.repository.findAgentById(agentId);
    if (!agent) {
      throw new HttpException(
        { code: ErrorCode.BUSINESS_RESOURCE_NOT_FOUND, message: 'Agent not found' },
        404
      );
    }

    if (agent.ownerId !== userId) {
      throw new HttpException(
        { code: ErrorCode.AUTH_FORBIDDEN, message: 'Agent does not belong to current user' },
        403
      );
    }

    this.validateUpdateAgent(input);

    const updated = await this.repository.updateAgent(agentId, input);

    // 重新计算状态
    updated.status = await this.computeAgentStatus(agentId);

    return updated;
  }

  async listAgents(query: AgentListQueryDto) {
    const agents = await this.repository.listAgents(query);

    // 批量计算状态
    for (const agent of agents) {
      agent.status = await this.computeAgentStatus(agent.id);
    }

    return agents;
  }

  /**
   * Task 1.3: Agent 状态计算逻辑
   * Agent 状态不存储在数据库（数据库 status 字段为冗余/缓存），需要动态计算
   */
  async computeAgentStatus(agentId: string): Promise<AgentStatus> {
    try {
      // 1. 检查是否有 InProgress 订单（agent_id = agentId AND status = 'InProgress'）
      const hasInProgress = await this.repository.hasInProgressOrder(agentId);

      // 2. 如果没有 InProgress 订单，状态为 Idle
      if (!hasInProgress) {
        return AgentStatus.Idle;
      }

      // 3. 有 InProgress 订单，检查队列是否非空
      const queuedCount = await this.repository.getQueuedItemCount(agentId);

      // 4. 队列非空 → Queueing，否则 → Busy
      return queuedCount > 0 ? AgentStatus.Queueing : AgentStatus.Busy;
    } catch (error) {
      // 如果 orders 或 queue_items 表还不存在，默认返回 Idle
      // 这是为了在开发阶段允许 Agent 模块独立工作
      console.warn(
        `[AgentService.computeAgentStatus] Failed to compute status for agent ${agentId}, defaulting to Idle:`,
        error instanceof Error ? error.message : error
      );
      return AgentStatus.Idle;
    }
  }

  private validateCreateAgent(input: CreateAgentDto): void {
    if (!isNonEmptyText(input.name)) {
      throw new ValidationError('name is required');
    }
    if (!isNonEmptyText(input.description)) {
      throw new ValidationError('description is required');
    }
    if (!isNonEmptyText(input.mastraUrl)) {
      throw new ValidationError('mastraUrl is required');
    }
    if (!input.supportedTaskTypes || input.supportedTaskTypes.length === 0) {
      throw new ValidationError('supportedTaskTypes is required and must not be empty');
    }
    if (!isNonEmptyText(input.minPrice)) {
      throw new ValidationError('minPrice is required');
    }
    if (!isNonEmptyText(input.maxPrice)) {
      throw new ValidationError('maxPrice is required');
    }

    const tags = input.tags ?? [];
    if (tags.length > MAX_TAGS) {
      throw new ValidationError(`tags exceeds limit (${MAX_TAGS})`);
    }

    if (!isValidMinUnit(input.minPrice)) {
      throw new ValidationError('minPrice must be a non-negative integer string');
    }
    if (!isValidMinUnit(input.maxPrice)) {
      throw new ValidationError('maxPrice must be a non-negative integer string');
    }

    const minPriceValue = BigInt(input.minPrice);
    const maxPriceValue = BigInt(input.maxPrice);
    if (minPriceValue > maxPriceValue) {
      throw new ValidationError('minPrice must be <= maxPrice');
    }
  }

  private validateUpdateAgent(input: UpdateAgentDto): void {
    if (input.name !== undefined && !isNonEmptyText(input.name)) {
      throw new ValidationError('name cannot be empty');
    }
    if (input.description !== undefined && !isNonEmptyText(input.description)) {
      throw new ValidationError('description cannot be empty');
    }
    if (input.mastraUrl !== undefined && !isNonEmptyText(input.mastraUrl)) {
      throw new ValidationError('mastraUrl cannot be empty');
    }
    if (input.supportedTaskTypes !== undefined && input.supportedTaskTypes.length === 0) {
      throw new ValidationError('supportedTaskTypes must not be empty');
    }

    if (input.tags !== undefined && input.tags.length > MAX_TAGS) {
      throw new ValidationError(`tags exceeds limit (${MAX_TAGS})`);
    }

    if (input.minPrice !== undefined && !isValidMinUnit(input.minPrice)) {
      throw new ValidationError('minPrice must be a non-negative integer string');
    }
    if (input.maxPrice !== undefined && !isValidMinUnit(input.maxPrice)) {
      throw new ValidationError('maxPrice must be a non-negative integer string');
    }

    // 如果同时更新 minPrice 和 maxPrice，校验范围
    if (input.minPrice !== undefined && input.maxPrice !== undefined) {
      const minPriceValue = BigInt(input.minPrice);
      const maxPriceValue = BigInt(input.maxPrice);
      if (minPriceValue > maxPriceValue) {
        throw new ValidationError('minPrice must be <= maxPrice');
      }
    }
  }
}
