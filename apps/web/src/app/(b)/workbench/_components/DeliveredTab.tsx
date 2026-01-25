'use client';

import { AutoAcceptCountdown } from '@/components/delivery/AutoAcceptCountdown';
import { useDeliveredOrders } from '@/hooks/use-workbench';
import { OrderCard } from './OrderCard';

type DeliveredTabProps = {
  userId: string;
};

export function DeliveredTab({ userId }: DeliveredTabProps) {
  const { orders, loading, error } = useDeliveredOrders(userId);

  if (loading) return <div className="text-center text-muted-foreground">加载中...</div>;
  if (error) return <div className="text-center text-destructive">{error}</div>;
  if (!orders.length)
    return <div className="text-center text-muted-foreground">暂无已交付订单</div>;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {orders.map((order) => (
        <div key={order.id}>
          <OrderCard order={order} />
          {order.deliveredAt && (
            <div className="mt-2">
              <AutoAcceptCountdown deliveredAt={order.deliveredAt} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
