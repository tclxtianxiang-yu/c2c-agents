import type { AgentStatus } from '@c2c-agents/shared';
import { AgentStatus as AgentStatusEnum } from '@c2c-agents/shared';

export const AGENT_STATUS_LABELS: Record<AgentStatus, string> = {
  [AgentStatusEnum.Idle]: '空闲',
  [AgentStatusEnum.Busy]: '忙碌',
  [AgentStatusEnum.Queueing]: '排队中',
};
