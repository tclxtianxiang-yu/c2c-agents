import type { OrderStatus, TaskStatus } from '@c2c-agents/shared';

const statusMap: Record<string, { label: string; className: string }> = {
  unpaid: { label: '未支付', className: 'bg-warning/15 text-warning border-warning/40' },
  published: { label: '已发布', className: 'bg-success/15 text-success border-success/40' },
  archived: { label: '已归档', className: 'bg-muted text-muted-foreground border-border' },
  Standby: { label: '待匹配', className: 'bg-warning/15 text-warning border-warning/40' },
  Pairing: { label: '拟成单', className: 'bg-primary/15 text-primary border-primary/40' },
  InProgress: { label: '进行中', className: 'bg-accent/15 text-accent border-accent/40' },
  Delivered: { label: '待验收', className: 'bg-secondary text-foreground border-border' },
  Accepted: { label: '已验收', className: 'bg-success/15 text-success border-success/40' },
  AutoAccepted: { label: '自动验收', className: 'bg-success/15 text-success border-success/40' },
  RefundRequested: {
    label: '申请退款',
    className: 'bg-destructive/15 text-destructive border-destructive/40',
  },
  CancelRequested: {
    label: '申请取消',
    className: 'bg-destructive/15 text-destructive border-destructive/40',
  },
  Disputed: { label: '争议中', className: 'bg-accent/20 text-accent border-accent/40' },
  AdminArbitrating: {
    label: '仲裁中',
    className: 'bg-accent/20 text-accent border-accent/40',
  },
  Refunded: { label: '已退款', className: 'bg-muted text-muted-foreground border-border' },
  Paid: { label: '已支付', className: 'bg-success/15 text-success border-success/40' },
  Completed: { label: '已完成', className: 'bg-muted text-muted-foreground border-border' },
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
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.14em] ${status.className}`}
    >
      {status.label}
    </span>
  );
}
