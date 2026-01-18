'use client';

import { USDT_DECIMALS } from '@c2c-agents/config/constants';
import type { Agent, QueueItem, Task } from '@c2c-agents/shared';
import { QueueItemStatus } from '@c2c-agents/shared';
import { fromMinUnit } from '@c2c-agents/shared/utils';
import { Avatar, AvatarFallback, AvatarImage, Badge, Button } from '@c2c-agents/ui';

import { TASK_TYPE_LABELS } from '@/utils/taskLabels';

import { QueueItemStatusBadge } from './QueueItemStatusBadge';

interface QueueItemCardProps {
  item: QueueItem;
  position?: number;
  task?: Pick<Task, 'id' | 'title' | 'type' | 'expectedReward'>;
  agent?: Pick<Agent, 'id' | 'name' | 'avatarUrl'>;
  onCancel?: (itemId: string) => void;
  isCanceling?: boolean;
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatReward(minUnit: string): string {
  const value = fromMinUnit(minUnit, USDT_DECIMALS);
  const [wholePart, fractionPart = ''] = value.split('.');
  const trimmedFraction = fractionPart.replace(/0+$/, '');
  return trimmedFraction ? `${wholePart}.${trimmedFraction}` : wholePart;
}

function getInitials(name: string) {
  const normalized = name.trim();
  if (!normalized) return '?';
  const parts = normalized.split(/\s+/);
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

export function QueueItemCard({
  item,
  position,
  task,
  agent,
  onCancel,
  isCanceling = false,
}: QueueItemCardProps) {
  const cardClassName = [
    'group relative flex h-full flex-col rounded-lg border border-border bg-card p-5',
    'shadow-lg transition-all duration-200 hover:-translate-y-1 hover:border-primary/50',
  ].join(' ');
  const positionClassName = [
    'border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-semibold',
    'text-primary',
  ].join(' ');
  const agentClassName = [
    'mt-4 flex items-center gap-3 rounded-lg border border-border/70 bg-muted/30 p-3',
  ].join(' ');
  const spinnerClassName = [
    'mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current',
    'border-t-transparent',
  ].join(' ');
  const showPosition = item.status === QueueItemStatus.Queued && position !== undefined;
  const showCancel = item.status === QueueItemStatus.Queued && Boolean(onCancel);

  const handleCancel = () => {
    if (onCancel) {
      onCancel(item.id);
    }
  };

  return (
    <article className={cardClassName}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <QueueItemStatusBadge status={item.status} />
          {showPosition && (
            <Badge variant="outline" className={positionClassName}>
              第 {position} 位
            </Badge>
          )}
        </div>
      </div>

      {task && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold text-foreground leading-snug line-clamp-2">
            {task.title}
          </h3>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary/70">
            {TASK_TYPE_LABELS[task.type] ?? task.type}
          </p>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-2xl font-semibold text-primary">
              {formatReward(task.expectedReward)}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">USDT</span>
          </div>
        </div>
      )}

      {agent && (
        <div className={agentClassName}>
          <Avatar className="h-10 w-10">
            <AvatarImage src={agent.avatarUrl ?? undefined} alt={agent.name} />
            <AvatarFallback>{getInitials(agent.name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold text-foreground">{agent.name}</p>
            <p className="text-xs text-muted-foreground">Agent</p>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-1 text-xs text-muted-foreground">
        <p>
          入队时间：
          <span className="ml-1 text-foreground/80">{formatDateTime(item.createdAt)}</span>
        </p>
        {item.consumedAt && (
          <p>
            消费时间：
            <span className="ml-1 text-foreground/80">{formatDateTime(item.consumedAt)}</span>
          </p>
        )}
        {item.canceledAt && (
          <p>
            取消时间：
            <span className="ml-1 text-foreground/80">{formatDateTime(item.canceledAt)}</span>
          </p>
        )}
      </div>

      {showCancel && (
        <div className="mt-auto pt-5">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleCancel}
            disabled={isCanceling}
            aria-busy={isCanceling}
          >
            {isCanceling && <span className={spinnerClassName} aria-hidden="true" />}
            {isCanceling ? '取消中...' : '取消排队'}
          </Button>
        </div>
      )}
    </article>
  );
}
