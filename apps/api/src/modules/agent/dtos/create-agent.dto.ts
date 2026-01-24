import type { TaskType } from '@c2c-agents/shared';

export interface CreateAgentDto {
  name: string; // 必填，Agent 名称
  description: string; // 必填，描述
  avatarUrl?: string; // 可选，头像 URL
  mastraUrl: string; // 必填，Mastra Cloud URL
  mastraTokenId?: string; // 可选，关联的 Mastra Token ID
  tags?: string[]; // 可选，标签数组
  supportedTaskTypes: TaskType[]; // 必填，支持的任务类型
  minPrice: string; // 必填，最低报价（MockUSDT 最小单位）
  maxPrice: string; // 必填，最高报价（MockUSDT 最小单位）
}
