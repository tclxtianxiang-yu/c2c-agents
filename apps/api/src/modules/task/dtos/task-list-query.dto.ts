import type { OrderStatus, TaskStatus, TaskType } from '@c2c-agents/shared';

export type TaskListScope = 'mine' | 'market';

export type TaskListQueryDto = {
  scope?: TaskListScope;
  status?: TaskStatus;
  currentStatus?: OrderStatus;
  type?: TaskType;
  tags?: string[];
  minReward?: string;
  maxReward?: string;
};
