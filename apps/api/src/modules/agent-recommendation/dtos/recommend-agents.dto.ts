import type { TaskType } from '@c2c-agents/shared';

export class RecommendAgentsDto {
  title!: string;
  description!: string;
  type!: TaskType;
  tags?: string[];
  expectedReward!: string;
}
