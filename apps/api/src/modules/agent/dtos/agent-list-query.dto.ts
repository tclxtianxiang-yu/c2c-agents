import type { AgentStatus, TaskType } from '@c2c-agents/shared';

export interface AgentListQueryDto {
  keyword?: string; // 按名称/描述模糊搜索
  tags?: string[]; // 按标签过滤
  taskType?: TaskType; // 按支持的任务类型过滤
  status?: AgentStatus; // 按状态过滤
  minPrice?: string; // 最低报价下限
  maxPrice?: string; // 最高报价上限
  isListed?: boolean; // 是否上架（默认 true）
  ownerId?: string; // 按 owner 过滤（B 用户查看自己的 Agent）
}
