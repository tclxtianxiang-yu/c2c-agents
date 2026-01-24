import type { TaskType } from '@c2c-agents/shared';

export interface UpdateAgentDto {
  name?: string;
  description?: string;
  avatarUrl?: string | null;
  mastraUrl?: string;
  mastraTokenId?: string | null; // 可选，关联的 Mastra Token ID（null 表示移除关联）
  tags?: string[];
  supportedTaskTypes?: TaskType[];
  minPrice?: string;
  maxPrice?: string;
}
