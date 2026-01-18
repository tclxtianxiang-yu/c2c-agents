'use client';

import type { Agent, QueueItem, Task } from '@c2c-agents/shared';
import { QueueItemStatus } from '@c2c-agents/shared';
import { Badge, Button } from '@c2c-agents/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { apiFetch } from '@/lib/api';
import { useUserId } from '@/lib/useUserId';

import { QueueItemCard } from './QueueItemCard';

interface QueueStatusDto {
  agentId: string;
  queuedCount: number;
  capacity: number;
  available: number;
  items: QueueItem[];
}

interface QueueListProps {
  agentId: string;
  tasks?: Map<string, Pick<Task, 'id' | 'title' | 'type' | 'expectedReward'>>;
  agents?: Map<string, Pick<Agent, 'id' | 'name' | 'avatarUrl'>>;
  onQueueChange?: () => void;
}

export function QueueList({ agentId, tasks, agents, onQueueChange }: QueueListProps) {
  const { userId } = useUserId('B');
  const [queueStatus, setQueueStatus] = useState<QueueStatusDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const loadQueueStatus = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<QueueStatusDto>(`/queue/agents/${agentId}/status`);
      setQueueStatus(data);
    } catch (err) {
      setQueueStatus(null);
      setError(err instanceof Error ? err.message : '加载队列失败');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    void loadQueueStatus();
  }, [loadQueueStatus]);

  const sortedItems = useMemo(() => {
    if (!queueStatus?.items?.length) return [] as QueueItem[];
    return [...queueStatus.items].sort(
      (current, next) => new Date(current.createdAt).getTime() - new Date(next.createdAt).getTime()
    );
  }, [queueStatus]);

  const queuedPositionMap = useMemo(() => {
    const queuedItems = sortedItems.filter((item) => item.status === QueueItemStatus.Queued);
    return new Map(queuedItems.map((item, index) => [item.id, index + 1]));
  }, [sortedItems]);

  const handleCancel = useCallback(
    async (itemId: string) => {
      const target = queueStatus?.items.find((item) => item.id === itemId);
      if (!target) return;
      if (!userId) {
        setError('请先连接钱包');
        return;
      }
      setCancelingId(itemId);
      setError(null);
      try {
        await apiFetch(`/queue/agents/${agentId}/orders/${target.orderId}`, {
          method: 'DELETE',
          headers: {
            'x-user-id': userId,
          },
        });
        onQueueChange?.();
        await loadQueueStatus();
      } catch (err) {
        setError(err instanceof Error ? err.message : '取消排队失败');
      } finally {
        setCancelingId(null);
      }
    },
    [agentId, loadQueueStatus, onQueueChange, queueStatus?.items, userId]
  );

  const hasItems = sortedItems.length > 0;
  const capacityLabel = queueStatus
    ? `队列 ${queueStatus.queuedCount}/${queueStatus.capacity}`
    : '队列 --/--';
  const availableLabel = queueStatus ? `剩余 ${queueStatus.available}` : '剩余 --';

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            队列
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">Agent 队列列表</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
            {capacityLabel}
          </Badge>
          <Badge variant="outline" className="border-border/70 bg-muted/40 text-muted-foreground">
            {availableLabel}
          </Badge>
          <Button type="button" variant="ghost" size="sm" onClick={() => void loadQueueStatus()}>
            刷新
          </Button>
        </div>
      </header>

      {loading && (
        <div className="rounded-2xl border border-border/60 bg-card/60 p-8 text-sm text-muted-foreground">
          加载中...
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && !hasItems && (
        <div className="rounded-2xl border border-border/60 bg-card/60 p-8 text-sm text-muted-foreground">
          队列暂无任务
        </div>
      )}

      {!loading && !error && hasItems && (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {sortedItems.map((item) => (
            <QueueItemCard
              key={item.id}
              item={item}
              position={queuedPositionMap.get(item.id)}
              task={tasks?.get(item.taskId)}
              agent={agents?.get(item.agentId)}
              onCancel={handleCancel}
              isCanceling={cancelingId === item.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}
