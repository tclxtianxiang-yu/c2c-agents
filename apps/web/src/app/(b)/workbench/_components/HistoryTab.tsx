'use client';

import { useHistoryOrders } from '@/hooks/use-workbench';
import { OrderCard } from './OrderCard';

type HistoryTabProps = {
  userId: string;
};

export function HistoryTab({ userId }: HistoryTabProps) {
  const { orders, loading, error } = useHistoryOrders(userId);

  if (loading) return <div className="text-center text-muted-foreground">加载中...</div>;
  if (error) return <div className="text-center text-destructive">{error}</div>;
  if (!orders.length) return <div className="text-center text-muted-foreground">暂无历史订单</div>;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}
