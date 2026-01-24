import { type Agent, AgentStatus } from '@c2c-agents/shared';

/**
 * Agent 候选者（包含队列信息）
 */
export type AgentCandidate = Pick<
  Agent,
  'id' | 'name' | 'status' | 'avgRating' | 'completedOrderCount' | 'queueSize' | 'createdAt'
>;

/**
 * Agent 排序算法
 *
 * 排序优先级（参考 PRD 第 8 节）：
 * 1. 状态优先：Idle > Busy（队列未满）
 * 2. 评分优先：avgRating DESC
 * 3. 经验优先：completedOrderCount DESC
 * 4. 队列长度：queueSize ASC（Busy 时）
 * 5. 创建时间：createdAt ASC（先注册优先）
 *
 * @param agents 候选 Agent 列表
 * @returns 排序后的 Agent 列表
 *
 * @example
 * ```typescript
 * const candidates = [
 *   { id: '1', status: 'Busy', avgRating: 4.5, completedOrderCount: 10, queueSize: 2, createdAt: '2026-01-01' },
 *   { id: '2', status: 'Idle', avgRating: 4.0, completedOrderCount: 5, queueSize: 0, createdAt: '2026-01-02' },
 * ];
 * const sorted = sortAgents(candidates);
 * // sorted[0].id === '2' (Idle 优先)
 * ```
 */
export function sortAgents<T extends AgentCandidate>(agents: T[]): T[] {
  return [...agents].sort((a, b) => {
    // 1. 状态优先：Idle > Busy > Queueing
    const statusPriority = getStatusPriority(a.status) - getStatusPriority(b.status);
    if (statusPriority !== 0) return statusPriority;

    // 2. 评分优先：avgRating DESC（高评分优先）
    const ratingDiff = b.avgRating - a.avgRating;
    if (ratingDiff !== 0) return ratingDiff;

    // 3. 经验优先：completedOrderCount DESC（完成订单多的优先）
    const experienceDiff = b.completedOrderCount - a.completedOrderCount;
    if (experienceDiff !== 0) return experienceDiff;

    // 4. 队列长度：queueSize ASC（队列短的优先）
    const queueDiff = a.queueSize - b.queueSize;
    if (queueDiff !== 0) return queueDiff;

    // 5. 创建时间：createdAt ASC（先注册优先）
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    return timeA - timeB;
  });
}

/**
 * 获取状态优先级（数字越小优先级越高）
 */
function getStatusPriority(status: AgentStatus): number {
  switch (status) {
    case AgentStatus.Idle:
      return 0; // 最高优先级
    case AgentStatus.Busy:
      return 1;
    case AgentStatus.Queueing:
      return 2;
    default:
      return 999; // 未知状态放最后
  }
}
