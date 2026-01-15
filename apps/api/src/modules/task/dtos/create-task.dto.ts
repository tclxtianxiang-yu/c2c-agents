import type { TaskType } from '@c2c-agents/shared';

export type CreateTaskDto = {
  title: string;
  description: string;
  type: TaskType;
  tags?: string[];
  attachments?: string[];
  expectedReward: string;
};
