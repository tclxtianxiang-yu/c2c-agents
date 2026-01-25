import type { Agent } from '@c2c-agents/shared';
import { Inject, Injectable } from '@nestjs/common';
import { AgentRepository } from '../agent/agent.repository';
import { AgentEmbeddingService } from '../agent-embedding/agent-embedding.service';

export interface RecommendedAgent {
  agent: Agent;
  similarity: number;
  score: number;
}

export interface RecommendationResult {
  candidates: RecommendedAgent[];
  recommended: RecommendedAgent[];
}

@Injectable()
export class AgentRecommendationService {
  constructor(
    @Inject(AgentEmbeddingService)
    private readonly agentEmbeddingService: AgentEmbeddingService,
    @Inject(AgentRepository)
    private readonly agentRepository: AgentRepository
  ) {}

  /**
   * 基于 Task 信息推荐最优 Agent
   * 1. 通过向量搜索召回最多 15 个候选 Agent
   * 2. 应用洗牌算法，综合考虑相似度、评分、完成订单数
   * 3. 返回最优的 3 个 Agent
   */
  async recommendAgentsForTask(task: {
    title: string;
    description: string;
    type: string;
    tags: string[];
    expectedReward: string;
  }): Promise<RecommendationResult> {
    // 1. 通过向量搜索召回候选 Agent
    const matchedAgents = await this.agentEmbeddingService.searchAgentsByTask({
      title: task.title,
      description: task.description,
      type: task.type,
      tags: task.tags,
    });

    if (matchedAgents.length === 0) {
      return { candidates: [], recommended: [] };
    }

    // 2. 批量获取 Agent 详情
    const agentIds = matchedAgents.map((m) => m.agentId);
    const agents = await this.fetchAgentsByIds(agentIds);

    // 3. 过滤：只保留价格范围匹配的 Agent
    const reward = BigInt(task.expectedReward);
    const filteredAgents = agents.filter((agent) => {
      const minPrice = BigInt(agent.minPrice);
      const maxPrice = BigInt(agent.maxPrice);
      const matches = reward >= minPrice && reward <= maxPrice;
      return matches;
    });

    // 4. 构建候选列表（包含相似度信息）
    const candidates: RecommendedAgent[] = filteredAgents.map((agent) => {
      const match = matchedAgents.find((m) => m.agentId === agent.id);
      const similarity = match?.similarity ?? 0;
      return {
        agent,
        similarity,
        score: this.calculateScore(agent, similarity),
      };
    });

    // 5. 洗牌算法：按综合得分排序，取前 3 个
    const recommended = this.shuffle(candidates, 3);

    return { candidates, recommended };
  }

  /**
   * 计算综合得分
   * 权重分配：
   * - 语义相似度：40%
   * - 平均评分（归一化到 0-1）：30%
   * - 完成订单数（归一化，上限 100）：20%
   * - 随机因子：10%（引入多样性）
   */
  private calculateScore(agent: Agent, similarity: number): number {
    // 相似度权重 40%
    const similarityScore = similarity * 0.4;

    // 评分权重 30%（5 分制归一化到 0-1）
    const ratingScore = (agent.avgRating / 5) * 0.3;

    // 完成订单数权重 20%（上限 100 单归一化）
    const completionScore = (Math.min(agent.completedOrderCount, 100) / 100) * 0.2;

    // 随机因子 10%（引入多样性）
    const randomFactor = Math.random() * 0.1;

    return similarityScore + ratingScore + completionScore + randomFactor;
  }

  /**
   * 洗牌算法：按综合得分排序，取前 N 个
   * 使用加权随机选择以增加多样性
   */
  private shuffle(candidates: RecommendedAgent[], count: number): RecommendedAgent[] {
    if (candidates.length <= count) {
      return [...candidates].sort((a, b) => b.score - a.score);
    }

    // 按得分排序
    const sorted = [...candidates].sort((a, b) => b.score - a.score);

    // 从前 2N 个中随机选择 N 个（如果足够）
    const pool = sorted.slice(0, Math.min(count * 2, sorted.length));
    const selected: RecommendedAgent[] = [];

    while (selected.length < count && pool.length > 0) {
      // 使用加权随机选择
      const totalScore = pool.reduce((sum, c) => sum + c.score, 0);
      let random = Math.random() * totalScore;

      for (let i = 0; i < pool.length; i++) {
        random -= pool[i].score;
        if (random <= 0) {
          selected.push(pool.splice(i, 1)[0]);
          break;
        }
      }

      // 兜底：如果没有选中（浮点误差），选第一个
      if (selected.length < count && random > 0 && pool.length > 0) {
        const first = pool.shift();
        if (first) {
          selected.push(first);
        }
      }
    }

    return selected.sort((a, b) => b.score - a.score);
  }

  /**
   * 批量获取 Agent 详情
   */
  private async fetchAgentsByIds(agentIds: string[]): Promise<Agent[]> {
    const agents: Agent[] = [];
    for (const id of agentIds) {
      const agent = await this.agentRepository.findAgentById(id);
      if (agent?.isListed) {
        agents.push(agent);
      }
    }
    return agents;
  }
}
