import { Inject, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';

const AGENT_EMBEDDINGS_TABLE = 'agent_embeddings';

export interface AgentEmbeddingRow {
  id: string;
  agent_id: string;
  content_text: string;
  embedding: string; // pgvector 返回为字符串
  model_id: string;
  created_at: string;
  updated_at: string;
}

export interface AgentEmbedding {
  id: string;
  agentId: string;
  contentText: string;
  embedding: number[];
  modelId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MatchedAgent {
  agentId: string;
  similarity: number;
}

function parseEmbeddingVector(vectorStr: string): number[] {
  // pgvector 返回格式: "[0.1,0.2,...]"
  return JSON.parse(vectorStr);
}

function toAgentEmbedding(row: AgentEmbeddingRow): AgentEmbedding {
  return {
    id: row.id,
    agentId: row.agent_id,
    contentText: row.content_text,
    embedding: parseEmbeddingVector(row.embedding),
    modelId: row.model_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function ensureNoError(error: unknown, context: string): void {
  if (!error) return;
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(`${context}: ${message}`);
}

@Injectable()
export class AgentEmbeddingRepository {
  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  /**
   * 创建或更新 Agent embedding
   * 使用 upsert 确保每个 agent 只有一条记录
   */
  async upsertEmbedding(input: {
    agentId: string;
    contentText: string;
    embedding: number[];
    modelId: string;
  }): Promise<AgentEmbedding> {
    // 格式化向量为 pgvector 格式
    const vectorStr = `[${input.embedding.join(',')}]`;

    const { data, error } = await this.supabase
      .query<AgentEmbeddingRow>(AGENT_EMBEDDINGS_TABLE)
      .upsert(
        {
          agent_id: input.agentId,
          content_text: input.contentText,
          embedding: vectorStr,
          model_id: input.modelId,
        },
        { onConflict: 'agent_id' }
      )
      .select('*')
      .single();

    ensureNoError(error, 'Failed to upsert agent embedding');
    if (!data) throw new Error('Failed to upsert agent embedding: empty response');

    return toAgentEmbedding(data);
  }

  /**
   * 根据 agentId 获取 embedding
   */
  async findByAgentId(agentId: string): Promise<AgentEmbedding | null> {
    const { data, error } = await this.supabase
      .query<AgentEmbeddingRow>(AGENT_EMBEDDINGS_TABLE)
      .select('*')
      .eq('agent_id', agentId)
      .maybeSingle();

    ensureNoError(error, 'Failed to find agent embedding');
    if (!data) return null;

    return toAgentEmbedding(data);
  }

  /**
   * 删除 Agent embedding
   */
  async deleteByAgentId(agentId: string): Promise<void> {
    const { error } = await this.supabase
      .query(AGENT_EMBEDDINGS_TABLE)
      .delete()
      .eq('agent_id', agentId);

    ensureNoError(error, 'Failed to delete agent embedding');
  }

  /**
   * 基于向量相似度搜索匹配的 Agent
   * 调用数据库函数 match_agents_by_embedding
   */
  async matchAgentsByEmbedding(
    queryEmbedding: number[],
    options: {
      matchThreshold?: number;
      matchCount?: number;
    } = {}
  ): Promise<MatchedAgent[]> {
    const { matchThreshold = 0.5, matchCount = 15 } = options;
    const vectorStr = `[${queryEmbedding.join(',')}]`;

    const { data, error } = await this.supabase.rpc('match_agents_by_embedding', {
      query_embedding: vectorStr,
      match_threshold: matchThreshold,
      match_count: matchCount,
    });

    ensureNoError(error, 'Failed to match agents by embedding');

    return (data ?? []).map((row: { agent_id: string; similarity: number }) => ({
      agentId: row.agent_id,
      similarity: row.similarity,
    }));
  }
}
