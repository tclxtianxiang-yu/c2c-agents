'use client';

import { toast } from '@c2c-agents/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AgentSelectModal } from '@/components/agent/AgentSelectModal';
import { useTaskContext } from '@/hooks/useTaskContext';
import { useUserId } from '@/lib/useUserId';
import { AgentCard, type AgentSummary } from './AgentCard';
import { AgentFilters, type AgentFilterValues } from './AgentFilters';
import { CreateAgentForm } from './CreateAgentForm';

type AgentMarketProps = {
  agents: AgentSummary[];
};

type SortOption = 'relevance' | 'rating' | 'price' | 'completion';

const SORT_LABELS: Record<SortOption, string> = {
  relevance: '相关性',
  rating: '评分',
  price: '价格',
  completion: '完成数',
};

export function AgentMarket({ agents }: AgentMarketProps) {
  const taskContext = useTaskContext();
  const router = useRouter();
  const { userId } = useUserId('B');
  const [selectedAgent, setSelectedAgent] = useState<AgentSummary | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('relevance');

  const initialFilters = useMemo<AgentFilterValues>(() => {
    if (!taskContext) return {};
    return {
      taskType: taskContext.type,
      tags: taskContext.tags,
    };
  }, [taskContext]);

  const [filters, setFilters] = useState<AgentFilterValues>(initialFilters);

  // 处理创建弹窗的键盘事件和滚动锁定
  useEffect(() => {
    if (!isCreateOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsCreateOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCreateOpen]);

  const filteredAndSortedAgents = useMemo(() => {
    let filtered = agents.filter((agent) => {
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

      if (filters.mine) {
        if (!userId) return false;
        if (agent.ownerId !== userId) return false;
      }

      return true;
    });

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return b.avgRating - a.avgRating;
        case 'price':
          return Number(BigInt(a.minPrice) - BigInt(b.minPrice));
        case 'completion':
          return b.completedOrderCount - a.completedOrderCount;
        default:
          return 0;
      }
    });

    return filtered;
  }, [agents, filters, sortBy, userId]);

  const handleSelectAgent = (agentId: string) => {
    if (!taskContext) return;
    const agent = agents.find((item) => item.id === agentId);
    if (!agent) return;
    setSelectedAgent(agent);
    setIsModalOpen(true);
  };

  return (
    <>
      {/* Page Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-primary">
            <span className="uppercase tracking-[0.3em] font-semibold">
              {taskContext ? '任务匹配' : 'Agent 市场'}
            </span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground" />
            <span className="text-muted-foreground">v0.1（测试版）</span>
          </div>
          <h1 className="mt-3 text-3xl font-semibold">
            {taskContext ? '推荐 Agent' : 'Agent 市场'}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {taskContext ? '为您的任务选择最合适的 AI Agent' : '浏览并选择 AI Agent 来执行您的任务'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!taskContext && (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
            >
              创建 Agent
            </button>
          )}
          <span className="text-sm text-muted-foreground hidden sm:inline-block">排序:</span>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="flex items-center gap-2 bg-card border border-border text-foreground text-sm px-4 py-2 rounded-lg hover:border-primary/50 transition-all appearance-none pr-10 cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {Object.entries(SORT_LABELS).map(([value, label]) => (
                <option key={value} value={value} className="bg-card">
                  {label}
                </option>
              ))}
            </select>
            <svg
              aria-hidden="true"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-4">
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
      </div>

      {/* Agent Grid */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
        {filteredAndSortedAgents.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
            {filters.mine && !userId
              ? '请先连接钱包查看你创建的 Agent'
              : '暂无符合条件的 Agent，请调整筛选条件'}
          </div>
        )}
        {filteredAndSortedAgents.map((agent) => (
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
      </section>

      {/* Select Modal */}
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

      {/* Create Agent Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-background/80 backdrop-blur"
            onClick={() => setIsCreateOpen(false)}
            aria-label="关闭创建 Agent 弹窗"
          />
          <div className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <CreateAgentForm
              onClose={() => setIsCreateOpen(false)}
              onSuccess={() => {
                setIsCreateOpen(false);
                // 刷新页面以显示新创建的 Agent
                window.location.reload();
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
