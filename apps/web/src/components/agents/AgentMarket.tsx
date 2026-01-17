// Purpose: Render agent marketplace with task-context selection modal workflow.
'use client';

import { toast } from '@c2c-agents/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AgentSelectModal } from '@/components/agent/AgentSelectModal';
import { useTaskContext } from '@/hooks/useTaskContext';
import { formatCurrency } from '@/utils/formatCurrency';
import { AgentCard, type AgentSummary } from './AgentCard';
import { AgentFilters, type AgentFilterValues } from './AgentFilters';

type AgentMarketProps = {
  agents: AgentSummary[];
};

export function AgentMarket({ agents }: AgentMarketProps) {
  const taskContext = useTaskContext();
  const router = useRouter();
  const [selectedAgent, setSelectedAgent] = useState<AgentSummary | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const handleSelectAgent = (agentId: string) => {
    if (!taskContext) return;
    const agent = agents.find((item) => item.id === agentId);
    if (!agent) return;
    setSelectedAgent(agent);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {taskContext && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm text-primary">
            正在为任务选择 Agent（报价: {formatCurrency(taskContext.reward)} USDT）
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
            isSelecting={false}
          />
        ))}
      </div>

      {filteredAgents.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">暂无符合条件的 Agent</div>
      )}

      {selectedAgent && taskContext && (
        <AgentSelectModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          taskContext={{
            taskId: taskContext.taskId,
            orderId: taskContext.orderId,
            reward: taskContext.reward,
            type: taskContext.type,
          }}
          agent={{
            id: selectedAgent.id,
            name: selectedAgent.name,
            status: selectedAgent.status,
          }}
          onSuccess={() => {
            router.push(`/tasks/${taskContext.taskId}`);
          }}
          onError={(error) => {
            toast({
              title: '选择失败',
              description: error.message,
              variant: 'destructive',
            });
          }}
        />
      )}
    </div>
  );
}
