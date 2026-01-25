import type { Task } from '@c2c-agents/shared';
import { OrderStatus } from '@c2c-agents/shared';

import { formatCurrency } from '@/utils/formatCurrency';
import { TASK_TYPE_LABELS } from '@/utils/taskLabels';

import { TaskStatusBadge } from './TaskStatusBadge';

export type TaskSummary = Pick<
  Task,
  'id' | 'title' | 'type' | 'expectedReward' | 'status' | 'currentStatus'
>;

const statusLabels: Record<string, string> = {
  unpaid: '未支付',
  published: '已发布',
  archived: '已归档',
};

const orderStatusLabels: Record<string, string> = {
  Standby: '待匹配',
  Pairing: '拟成单',
  InProgress: '进行中',
  Delivered: '待验收',
  Accepted: '已验收',
  AutoAccepted: '自动验收',
  RefundRequested: '申请退款',
  CancelRequested: '申请取消',
  Disputed: '争议中',
  AdminArbitrating: '仲裁中',
  Refunded: '已退款',
  Paid: '已支付',
  Completed: '已完成',
};

type TaskCardProps = {
  task: TaskSummary;
  onViewStatus?: (taskId: string) => void;
  onAutoMatch?: (taskId: string) => void;
  onManualSelect?: (taskId: string) => void;
  onRefundRequest?: (taskId: string) => void;
};

export function TaskCard({
  task,
  onViewStatus,
  onAutoMatch,
  onManualSelect,
  onRefundRequest,
}: TaskCardProps) {
  const isStandby = task.currentStatus === OrderStatus.Standby;
  const isPairing = task.currentStatus === OrderStatus.Pairing;
  // const isDelivered = task.currentStatus === OrderStatus.Delivered;
  const isDelivered = true;
  const actionLabel = isStandby ? '自动匹配' : isPairing ? '确认匹配' : '查看状态';
  const handleViewStatus = () => onViewStatus?.(task.id);
  const handleAutoMatch = () => onAutoMatch?.(task.id);
  const handleManualSelect = () => onManualSelect?.(task.id);
  const handleRefundRequest = () => onRefundRequest?.(task.id);

  return (
    <article className="group relative flex h-full flex-col rounded-lg border border-border bg-card p-5 shadow-lg transition duration-300 hover:-translate-y-1 hover:border-primary/50">
      <div className="flex items-center justify-between">
        <TaskStatusBadge taskStatus={task.status} orderStatus={task.currentStatus} />
        <span className="text-xs text-muted-foreground">#{task.id.slice(0, 6)}</span>
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground leading-snug line-clamp-2">
        {task.title}
      </h3>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary/70">
        {TASK_TYPE_LABELS[task.type] ?? task.type}
      </p>
      <div className="mt-5 flex items-baseline gap-1">
        <span className="text-2xl font-semibold text-primary">
          {formatCurrency(task.expectedReward)}
        </span>
        <span className="text-xs font-semibold text-muted-foreground">USDT</span>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <span className="rounded-full border border-border bg-muted px-3 py-1 text-[11px] text-muted-foreground">
          {statusLabels[task.status] ?? task.status}
        </span>
        {task.currentStatus && (
          <span className="rounded-full border border-border bg-muted px-3 py-1 text-[11px] text-muted-foreground">
            {orderStatusLabels[task.currentStatus] ?? task.currentStatus}
          </span>
        )}
      </div>
      <div className="mt-auto pt-6">
        {isStandby ? (
          <div className="grid gap-2">
            <button
              type="button"
              onClick={handleAutoMatch}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_10px_30px_rgba(14,116,219,0.35)] transition hover:opacity-90"
            >
              <span aria-hidden="true">⚡</span>
              自动匹配 (Auto Match)
            </button>
            <button
              type="button"
              onClick={handleManualSelect}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background/60 px-4 py-2.5 text-sm font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-primary"
            >
              <span aria-hidden="true">🖐️</span>
              手动选择 (Select)
            </button>
          </div>
        ) : isDelivered ? (
          <div className="grid gap-2">
            <button
              type="button"
              onClick={handleRefundRequest ?? handleViewStatus}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-destructive transition hover:border-destructive/60"
            >
              申请退款
            </button>
            <button
              type="button"
              onClick={handleViewStatus}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background/60 px-4 py-2.5 text-sm font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-primary"
            >
              查看状态
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={actionLabel === '查看状态' ? handleViewStatus : undefined}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow transition hover:opacity-90"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </article>
  );
}
