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
        <div className="relative">
          <select
            className="appearance-none rounded-md border border-input bg-background/80 px-3 py-1 pr-8 text-sm text-foreground shadow-[0_8px_18px_rgba(15,23,42,0.18)] backdrop-blur focus:border-primary focus:outline-none"
            value={status ?? ''}
            onChange={(event) =>
              onChange({
                status: event.target.value ? (event.target.value as TaskStatus) : undefined,
                currentStatus,
              })
            }
          >
            <option value="" className="bg-background text-foreground">
              全部
            </option>
            <option value={TaskStatus.Unpaid} className="bg-background text-foreground">
              未支付
            </option>
            <option value={TaskStatus.Published} className="bg-background text-foreground">
              已发布
            </option>
            <option value={TaskStatus.Archived} className="bg-background text-foreground">
              已归档
            </option>
          </select>
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path
                d="M6 8l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      </label>
      <label className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          订单
        </span>
        <div className="relative">
          <select
            className="appearance-none rounded-md border border-input bg-background/80 px-3 py-1 pr-8 text-sm text-foreground shadow-[0_8px_18px_rgba(15,23,42,0.18)] backdrop-blur focus:border-primary focus:outline-none"
            value={currentStatus ?? ''}
            onChange={(event) =>
              onChange({
                status,
                currentStatus: event.target.value ? (event.target.value as OrderStatus) : undefined,
              })
            }
          >
            <option value="" className="bg-background text-foreground">
              全部
            </option>
            <option value={OrderStatus.Standby} className="bg-background text-foreground">
              待匹配
            </option>
            <option value={OrderStatus.Pairing} className="bg-background text-foreground">
              拟成单
            </option>
            <option value={OrderStatus.InProgress} className="bg-background text-foreground">
              进行中
            </option>
            <option value={OrderStatus.Delivered} className="bg-background text-foreground">
              已交付
            </option>
            <option value={OrderStatus.Completed} className="bg-background text-foreground">
              已完成
            </option>
          </select>
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path
                d="M6 8l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      </label>
    </div>
  );
}
