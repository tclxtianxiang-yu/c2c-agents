import { OrderStatus, TaskStatus } from '@c2c-agents/shared';

type TaskFiltersProps = {
  status?: TaskStatus;
  currentStatus?: OrderStatus;
  onChange: (filters: { status?: TaskStatus; currentStatus?: OrderStatus }) => void;
};

export function TaskFilters({ status, currentStatus, onChange }: TaskFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
      <label className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          任务
        </span>
        <select
          className="rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground"
          value={status ?? ''}
          onChange={(event) =>
            onChange({
              status: event.target.value ? (event.target.value as TaskStatus) : undefined,
              currentStatus,
            })
          }
        >
          <option value="">全部</option>
          <option value={TaskStatus.Unpaid}>未支付</option>
          <option value={TaskStatus.Published}>已发布</option>
          <option value={TaskStatus.Archived}>已归档</option>
        </select>
      </label>
      <label className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          订单
        </span>
        <select
          className="rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground"
          value={currentStatus ?? ''}
          onChange={(event) =>
            onChange({
              status,
              currentStatus: event.target.value ? (event.target.value as OrderStatus) : undefined,
            })
          }
        >
          <option value="">全部</option>
          <option value={OrderStatus.Standby}>待匹配</option>
          <option value={OrderStatus.Pairing}>拟成单</option>
          <option value={OrderStatus.InProgress}>进行中</option>
          <option value={OrderStatus.Delivered}>已交付</option>
          <option value={OrderStatus.Completed}>已完成</option>
        </select>
      </label>
    </div>
  );
}
