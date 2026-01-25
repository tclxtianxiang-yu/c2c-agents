'use client';

import { useState } from 'react';
import { usePairingOrders } from '@/hooks/use-workbench';
import { apiFetch } from '@/lib/api';
import { OrderCard } from './OrderCard';

type PairingTabProps = {
  userId: string;
};

export function PairingTab({ userId }: PairingTabProps) {
  const { orders, loading, error, refetch } = usePairingOrders(userId);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAccept = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      await apiFetch('/matching/pairing/accept', {
        method: 'POST',
        headers: { 'x-user-id': userId },
        body: JSON.stringify({ orderId, role: 'B' }),
      });
      refetch();
    } catch (err) {
      console.error('Accept failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      await apiFetch('/matching/pairing/reject', {
        method: 'POST',
        headers: { 'x-user-id': userId },
        body: JSON.stringify({ orderId, role: 'B' }),
      });
      refetch();
    } catch (err) {
      console.error('Reject failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="text-center text-muted-foreground">加载中...</div>;
  if (error) return <div className="text-center text-destructive">{error}</div>;
  if (!orders.length) return <div className="text-center text-muted-foreground">暂无拟成单</div>;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {orders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          actions={
            <>
              <button
                type="button"
                onClick={() => handleAccept(order.id)}
                disabled={actionLoading === order.id}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                同意
              </button>
              <button
                type="button"
                onClick={() => handleReject(order.id)}
                disabled={actionLoading === order.id}
                className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
              >
                拒绝
              </button>
            </>
          }
        />
      ))}
    </div>
  );
}
