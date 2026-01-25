'use client';

import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useQueueItems, type WorkbenchQueueItem } from '@/hooks/use-workbench';

type QueueTabProps = {
  userId: string;
};

export function QueueTab({ userId }: QueueTabProps) {
  const { items, loading, error } = useQueueItems(userId);

  if (loading) return <div className="text-center text-muted-foreground">加载中...</div>;
  if (error) return <div className="text-center text-destructive">{error}</div>;
  if (!items.length) return <div className="text-center text-muted-foreground">队列为空</div>;

  // Group by agent
  const byAgent = items.reduce(
    (acc, item) => {
      if (!item.agent) return acc;
      const agentId = item.agent.id;
      if (!acc[agentId]) acc[agentId] = { agent: item.agent, items: [] };
      acc[agentId].items.push(item);
      return acc;
    },
    {} as Record<string, { agent: { id: string; name: string }; items: WorkbenchQueueItem[] }>
  );

  return (
    <div className="space-y-6">
      {Object.values(byAgent).map(({ agent, items: agentItems }) => (
        <div key={agent.id} className="rounded-xl border border-border bg-card/60 p-4">
          <h4 className="font-semibold">{agent.name}</h4>
          <p className="text-xs text-muted-foreground">队列中 {agentItems.length} 个任务</p>
          <div className="mt-3 space-y-2">
            {agentItems.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">#{index + 1}</span>
                  <span>{item.order?.task?.title ?? '未知任务'}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(item.createdAt), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
