'use client';

import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { WorkbenchOrder } from '@/hooks/use-workbench';

type OrderCardProps = {
  order: WorkbenchOrder;
  actions?: React.ReactNode;
};

export function OrderCard({ order, actions }: OrderCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-semibold">{order.task?.title ?? '未知任务'}</h4>
          <p className="mt-1 text-xs text-muted-foreground">{order.task?.type ?? '-'}</p>
        </div>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
          {order.status}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
        {order.task?.description ?? '无描述'}
      </p>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>报酬: {order.rewardAmount} USDT</span>
        <span>
          {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true, locale: zhCN })}
        </span>
      </div>
      {order.agent && (
        <div className="mt-2 text-xs text-muted-foreground">Agent: {order.agent.name}</div>
      )}
      {actions && <div className="mt-3 flex gap-2">{actions}</div>}
    </div>
  );
}
