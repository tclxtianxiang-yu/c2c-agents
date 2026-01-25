import { Inject, Injectable } from '@nestjs/common';
import { EmbeddingService } from '../embedding/embedding.service';
import { AgentEmbeddingRepository, type MatchedAgent } from './agent-embedding.repository';

export interface AgentForEmbedding {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

@Injectable()
export class AgentEmbeddingService {
  constructor(
    @Inject(AgentEmbeddingRepository)
    private readonly repository: AgentEmbeddingRepository,
    @Inject(EmbeddingService)
    private readonly embeddingService: EmbeddingService
  ) {}

  /**
   * 检查 embedding 功能是否可用
   */
  isEnabled(): boolean {
    return this.embeddingService.isEnabled();
  }

  /**
   * 为 Agent 生成并存储 embedding
   * 在 Agent 创建或更新时调用
   */
  async updateAgentEmbedding(agent: AgentForEmbedding): Promise<void> {
    if (!this.isEnabled()) {
      console.warn('[AgentEmbeddingService] Embedding service not enabled, skipping');
      return;
    }

    try {
      const contentText = this.embeddingService.buildAgentEmbeddingText({
        name: agent.name,
        description: agent.description,
        tags: agent.tags,
      });

      const result = await this.embeddingService.generateEmbedding(contentText);

      await this.repository.upsertEmbedding({
        agentId: agent.id,
        contentText,
        embedding: result.embedding,
        modelId: result.model,
      });

      console.log(
        `[AgentEmbeddingService] Updated embedding for agent ${agent.id}, tokens: ${result.usage.totalTokens}`
      );
    } catch (error) {
      // 记录错误但不抛出，embedding 更新失败不应影响主流程
      console.error(
        `[AgentEmbeddingService] Failed to update embedding for agent ${agent.id}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  /**
   * 删除 Agent 的 embedding
   * 在 Agent 删除时调用
   */
  async deleteAgentEmbedding(agentId: string): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    try {
      await this.repository.deleteByAgentId(agentId);
      console.log(`[AgentEmbeddingService] Deleted embedding for agent ${agentId}`);
    } catch (error) {
      console.error(
        `[AgentEmbeddingService] Failed to delete embedding for agent ${agentId}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  /**
   * 基于 Task 信息搜索匹配的 Agent
   * @returns 按相似度排序的 Agent ID 列表
   */
  async searchAgentsByTask(task: {
    title: string;
    description: string;
    type: string;
    tags: string[];
  }): Promise<MatchedAgent[]> {
    if (!this.isEnabled()) {
      console.warn('[AgentEmbeddingService] Embedding service not enabled, returning empty');
      return [];
    }

    const contentText = this.embeddingService.buildTaskEmbeddingText(task);
    const result = await this.embeddingService.generateEmbedding(contentText);

    const matchedAgents = await this.repository.matchAgentsByEmbedding(result.embedding, {
      matchThreshold: 0.3, // 较低阈值以获取更多候选
      matchCount: 15,
    });

    return matchedAgents;
  }
}
