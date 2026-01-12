import type { OrderStatus, TaskStatus } from '@c2c-agents/shared';

const statusMap: Record<string, { label: string; className: string }> = {
  unpaid: { label: 'UNPAID', className: 'bg-warning/15 text-warning border-warning/40' },
  published: { label: 'PUBLISHED', className: 'bg-success/15 text-success border-success/40' },
  archived: { label: 'ARCHIVED', className: 'bg-muted text-muted-foreground border-border' },
  Standby: { label: 'STANDBY', className: 'bg-warning/15 text-warning border-warning/40' },
  Pairing: { label: 'PAIRING', className: 'bg-primary/15 text-primary border-primary/40' },
  InProgress: { label: 'IN PROGRESS', className: 'bg-accent/15 text-accent border-accent/40' },
  Delivered: { label: 'DELIVERED', className: 'bg-secondary text-foreground border-border' },
  Accepted: { label: 'ACCEPTED', className: 'bg-success/15 text-success border-success/40' },
  AutoAccepted: {
    label: 'AUTO ACCEPTED',
    className: 'bg-success/15 text-success border-success/40',
  },
  RefundRequested: {
    label: 'REFUND',
    className: 'bg-destructive/15 text-destructive border-destructive/40',
  },
  CancelRequested: {
    label: 'CANCEL',
    className: 'bg-destructive/15 text-destructive border-destructive/40',
  },
  Disputed: { label: 'DISPUTED', className: 'bg-accent/20 text-accent border-accent/40' },
  AdminArbitrating: {
    label: 'ARBITRATING',
    className: 'bg-accent/20 text-accent border-accent/40',
  },
  Refunded: { label: 'REFUNDED', className: 'bg-muted text-muted-foreground border-border' },
  Paid: { label: 'PAID', className: 'bg-success/15 text-success border-success/40' },
  Completed: { label: 'COMPLETED', className: 'bg-muted text-muted-foreground border-border' },
};

type TaskStatusBadgeProps = {
  taskStatus: TaskStatus;
  orderStatus?: OrderStatus | null;
};

export function TaskStatusBadge({ taskStatus, orderStatus }: TaskStatusBadgeProps) {
  const key = orderStatus ?? taskStatus;
  const status = statusMap[key] ?? {
    label: String(key),
    className: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${status.className}`}
    >
      {status.label}
    </span>
  );
}
