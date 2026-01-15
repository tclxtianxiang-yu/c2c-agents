import type { TaskType } from '@c2c-agents/shared';

export interface UpdateAgentDto {
  name?: string;
  description?: string;
  avatarUrl?: string | null;
  mastraUrl?: string;
  tags?: string[];
  supportedTaskTypes?: TaskType[];
  minPrice?: string;
  maxPrice?: string;
}
