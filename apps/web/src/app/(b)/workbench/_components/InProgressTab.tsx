'use client';

import Link from 'next/link';
import { useInProgressOrders } from '@/hooks/use-workbench';
import { OrderCard } from './OrderCard';

type InProgressTabProps = {
  userId: string;
};

export function InProgressTab({ userId }: InProgressTabProps) {
  const { orders, loading, error } = useInProgressOrders(userId);

  if (loading) return <div className="text-center text-muted-foreground">加载中...</div>;
  if (error) return <div className="text-center text-destructive">{error}</div>;
  if (!orders.length)
    return <div className="text-center text-muted-foreground">暂无进行中订单</div>;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {orders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          actions={
            <Link
              href={`/tasks/${order.taskId}`}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              提交交付
            </Link>
          }
        />
      ))}
    </div>
  );
}
