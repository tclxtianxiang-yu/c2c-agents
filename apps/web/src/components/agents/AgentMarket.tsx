'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useTaskContext } from '@/hooks/useTaskContext';
import { formatMinUnit } from '@/utils/formatMinUnit';
import { AgentCard, type AgentSummary } from './AgentCard';
import { AgentFilters, type AgentFilterValues } from './AgentFilters';

type AgentMarketProps = {
  agents: AgentSummary[];
};

export function AgentMarket({ agents }: AgentMarketProps) {
  const taskContext = useTaskContext();
  const router = useRouter();

  const initialFilters = useMemo<AgentFilterValues>(() => {
    if (!taskContext) return {};
    return {
      taskType: taskContext.type,
      tags: taskContext.tags,
    };
  }, [taskContext]);

  const [filters, setFilters] = useState<AgentFilterValues>(initialFilters);

  useEffect(() => {
    if (!taskContext) return;
    setFilters((prev) => ({
      ...prev,
      taskType: taskContext.type,
      tags: taskContext.tags,
    }));
  }, [taskContext]);

  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      if (filters.keyword) {
        const keyword = filters.keyword.toLowerCase();
        if (
          !agent.name.toLowerCase().includes(keyword) &&
          !agent.description.toLowerCase().includes(keyword)
        ) {
          return false;
        }
      }

      if (filters.taskType && !agent.supportedTaskTypes.includes(filters.taskType)) {
        return false;
      }

      if (filters.status && agent.status !== filters.status) {
        return false;
      }

      if (filters.minPrice && BigInt(agent.maxPrice) < BigInt(filters.minPrice)) {
        return false;
      }

      if (filters.maxPrice && BigInt(agent.minPrice) > BigInt(filters.maxPrice)) {
        return false;
      }

      if (filters.tags?.length) {
        const hasMatchingTag = filters.tags.some((tag) => agent.tags.includes(tag));
        if (!hasMatchingTag) return false;
      }

      return true;
    });
  }, [agents, filters]);

  const handleSelectAgent = async (_agentId: string) => {
    if (!taskContext) return;

    // TODO: 调用后端 API 创建 Pairing 或 QueueItem
    // POST /api/matching/manual-select
    // { taskId, orderId, agentId }

    router.push(`/tasks/${taskContext.taskId}`);
  };

  return (
    <div className="space-y-6">
      {taskContext && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm text-primary">
            正在为任务选择 Agent（报价: {formatMinUnit(taskContext.reward)} USDT）
          </p>
          <button
            type="button"
            className="mt-2 text-xs text-muted-foreground underline"
            onClick={() => router.push(`/tasks/${taskContext.taskId}`)}
          >
            取消选择，返回任务详情
          </button>
        </div>
      )}

      <AgentFilters
        values={filters}
        onChange={setFilters}
        taskContext={
          taskContext
            ? {
                type: taskContext.type,
                tags: taskContext.tags,
                reward: taskContext.reward,
              }
            : undefined
        }
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredAgents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            taskContext={
              taskContext
                ? {
                    taskId: taskContext.taskId,
                    reward: taskContext.reward,
                    type: taskContext.type,
                  }
                : undefined
            }
            onSelect={taskContext ? handleSelectAgent : undefined}
          />
        ))}
      </div>

      {filteredAgents.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">暂无符合条件的 Agent</div>
      )}
    </div>
  );
}
