import type { QueueItemStatus as QueueItemStatusType } from '@c2c-agents/shared';
import { QueueItemStatus } from '@c2c-agents/shared';
import { Badge, cn } from '@c2c-agents/ui';

interface QueueItemStatusBadgeProps {
  status: QueueItemStatusType;
  className?: string;
}

const statusConfig: Record<QueueItemStatusType, { label: string; className: string }> = {
  [QueueItemStatus.Queued]: {
    label: '排队中',
    className: 'bg-primary/15 text-primary border-primary/40',
  },
  [QueueItemStatus.Consumed]: {
    label: '执行中',
    className: 'bg-accent/15 text-accent border-accent/40',
  },
  [QueueItemStatus.Canceled]: {
    label: '已取消',
    className: 'bg-destructive/15 text-destructive border-destructive/40',
  },
};

export function QueueItemStatusBadge({ status, className }: QueueItemStatusBadgeProps) {
  const config = statusConfig[status] ?? {
    label: String(status),
    className: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        'px-3 py-1 text-[11px] font-semibold tracking-[0.14em]',
        config.className,
        className
      )}
    >
      {config.label}
    </Badge>
  );
}
