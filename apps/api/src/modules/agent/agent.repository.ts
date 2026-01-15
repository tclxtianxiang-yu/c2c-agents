import type { Agent, AgentStatus, TaskType } from '@c2c-agents/shared';
import { Inject, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import type { AgentListQueryDto } from './dtos/agent-list-query.dto';

const AGENT_TABLE = 'agents';
const QUEUE_ITEMS_TABLE = 'queue_items';
const ORDER_TABLE = 'orders';

const AGENT_SELECT_FIELDS = `
  id,
  owner_id,
  name,
  description,
  avatar_url,
  mastra_url,
  tags,
  supported_task_types,
  min_price,
  max_price,
  avg_rating,
  rating_count,
  completed_order_count,
  status,
  current_order_id,
  queue_size,
  is_listed,
  created_at,
  updated_at
`;

type AgentRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  avatar_url: string | null;
  mastra_url: string;
  tags: string[];
  supported_task_types: TaskType[];
  min_price: string | number;
  max_price: string | number;
  avg_rating: number;
  rating_count: number;
  completed_order_count: number;
  status: AgentStatus;
  current_order_id: string | null;
  queue_size: number;
  is_listed: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateAgentInput = {
  ownerId: string;
  name: string;
  description: string;
  avatarUrl?: string;
  mastraUrl: string;
  tags: string[];
  supportedTaskTypes: TaskType[];
  minPrice: string;
  maxPrice: string;
};

export type UpdateAgentInput = {
  name?: string;
  description?: string;
  avatarUrl?: string | null;
  mastraUrl?: string;
  tags?: string[];
  supportedTaskTypes?: TaskType[];
  minPrice?: string;
  maxPrice?: string;
};

export type AgentListFilters = AgentListQueryDto;

function toAgent(row: AgentRow): Agent {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description,
    avatarUrl: row.avatar_url,
    mastraUrl: row.mastra_url,
    tags: row.tags ?? [],
    supportedTaskTypes: row.supported_task_types ?? [],
    minPrice: String(row.min_price),
    maxPrice: String(row.max_price),
    avgRating: row.avg_rating,
    ratingCount: row.rating_count,
    completedOrderCount: row.completed_order_count,
    status: row.status,
    currentOrderId: row.current_order_id,
    queueSize: row.queue_size,
    isListed: row.is_listed,
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
export class AgentRepository {
  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  async createAgent(input: CreateAgentInput): Promise<Agent> {
    const { data, error } = await this.supabase
      .query<AgentRow>(AGENT_TABLE)
      .insert({
        owner_id: input.ownerId,
        name: input.name,
        description: input.description,
        avatar_url: input.avatarUrl ?? null,
        mastra_url: input.mastraUrl,
        tags: input.tags,
        supported_task_types: input.supportedTaskTypes,
        min_price: input.minPrice,
        max_price: input.maxPrice,
      })
      .select(AGENT_SELECT_FIELDS)
      .single();

    ensureNoError(error, 'Failed to create agent');
    if (!data) throw new Error('Failed to create agent: empty response');

    return toAgent(data);
  }

  async findAgentById(agentId: string): Promise<Agent | null> {
    const { data, error } = await this.supabase
      .query<AgentRow>(AGENT_TABLE)
      .select(AGENT_SELECT_FIELDS)
      .eq('id', agentId)
      .maybeSingle();

    ensureNoError(error, 'Failed to fetch agent');
    if (!data) return null;

    return toAgent(data);
  }

  async findAgentsByOwnerId(ownerId: string): Promise<Agent[]> {
    const { data, error } = await this.supabase
      .query<AgentRow>(AGENT_TABLE)
      .select(AGENT_SELECT_FIELDS)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    ensureNoError(error, 'Failed to fetch agents by owner');

    return (data ?? []).map(toAgent);
  }

  async updateAgent(agentId: string, input: UpdateAgentInput): Promise<Agent> {
    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.avatarUrl !== undefined) updates.avatar_url = input.avatarUrl;
    if (input.mastraUrl !== undefined) updates.mastra_url = input.mastraUrl;
    if (input.tags !== undefined) updates.tags = input.tags;
    if (input.supportedTaskTypes !== undefined)
      updates.supported_task_types = input.supportedTaskTypes;
    if (input.minPrice !== undefined) updates.min_price = input.minPrice;
    if (input.maxPrice !== undefined) updates.max_price = input.maxPrice;

    const { data, error } = await this.supabase
      .query<AgentRow>(AGENT_TABLE)
      .update(updates)
      .eq('id', agentId)
      .select(AGENT_SELECT_FIELDS)
      .single();

    ensureNoError(error, 'Failed to update agent');
    if (!data) throw new Error('Failed to update agent: empty response');

    return toAgent(data);
  }

  async listAgents(filters: AgentListFilters): Promise<Agent[]> {
    let query = this.supabase.query<AgentRow>(AGENT_TABLE).select(AGENT_SELECT_FIELDS);

    // 默认只返回 isListed=true
    const isListed = filters.isListed !== undefined ? filters.isListed : true;
    query = query.eq('is_listed', isListed);

    if (filters.ownerId) query = query.eq('owner_id', filters.ownerId);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.tags?.length) query = query.contains('tags', filters.tags);
    if (filters.taskType) query = query.contains('supported_task_types', [filters.taskType]);
    if (filters.minPrice) query = query.gte('min_price', filters.minPrice);
    if (filters.maxPrice) query = query.lte('max_price', filters.maxPrice);

    // 关键词模糊搜索（name 和 description）
    if (filters.keyword) {
      const keyword = filters.keyword.trim();
      query = query.or(`name.ilike.%${keyword}%,description.ilike.%${keyword}%`);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    ensureNoError(error, 'Failed to list agents');

    return (data ?? []).map(toAgent);
  }

  async getQueuedItemCount(agentId: string): Promise<number> {
    const { count, error } = await this.supabase
      .query(QUEUE_ITEMS_TABLE)
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('status', 'queued');

    ensureNoError(error, 'Failed to count queued items');

    return count ?? 0;
  }

  async hasInProgressOrder(agentId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .query(ORDER_TABLE)
      .select('id')
      .eq('agent_id', agentId)
      .eq('status', 'InProgress')
      .maybeSingle();

    ensureNoError(error, 'Failed to check InProgress order');

    return !!data;
  }
}
