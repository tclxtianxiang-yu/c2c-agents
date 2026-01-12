import type { OrderStatus, TaskStatus } from '@c2c-agents/shared';

const statusMap: Record<string, { label: string; className: string }> = {
  unpaid: { label: 'UNPAID', className: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
  published: {
    label: 'PUBLISHED',
    className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  },
  archived: { label: 'ARCHIVED', className: 'bg-slate-500/10 text-slate-300 border-slate-500/30' },
  Standby: { label: 'STANDBY', className: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
  Pairing: { label: 'PAIRING', className: 'bg-sky-500/10 text-sky-300 border-sky-500/30' },
  InProgress: {
    label: 'IN PROGRESS',
    className: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
  },
  Delivered: { label: 'DELIVERED', className: 'bg-teal-500/10 text-teal-300 border-teal-500/30' },
  Accepted: {
    label: 'ACCEPTED',
    className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  },
  AutoAccepted: {
    label: 'AUTO ACCEPTED',
    className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  },
  RefundRequested: {
    label: 'REFUND',
    className: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  },
  CancelRequested: {
    label: 'CANCEL',
    className: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  },
  Disputed: {
    label: 'DISPUTED',
    className: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
  },
  AdminArbitrating: {
    label: 'ARBITRATING',
    className: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
  },
  Refunded: { label: 'REFUNDED', className: 'bg-slate-500/10 text-slate-300 border-slate-500/30' },
  Paid: { label: 'PAID', className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' },
  Completed: {
    label: 'COMPLETED',
    className: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
  },
};

type TaskStatusBadgeProps = {
  taskStatus: TaskStatus;
  orderStatus?: OrderStatus | null;
};

export function TaskStatusBadge({ taskStatus, orderStatus }: TaskStatusBadgeProps) {
  const key = orderStatus ?? taskStatus;
  const status = statusMap[key] ?? {
    label: String(key),
    className: 'bg-slate-100 text-slate-600',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${status.className}`}
    >
      {status.label}
    </span>
  );
}
