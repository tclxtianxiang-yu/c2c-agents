'use client';

import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useUserId } from '../../lib/useUserId';

type AcceptResponse = {
  paidAt: string;
  completedAt: string;
  payoutTxHash: string;
};

type AcceptActionPanelProps = {
  orderId: string;
  onAccepted?: (payload: AcceptResponse) => void;
};

export function AcceptActionPanel({ orderId, onAccepted }: AcceptActionPanelProps) {
  const { userId, isConnected } = useUserId('A');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleAccept = async () => {
    if (!orderId || !userId) return;
    setLoading(true);
    setMessage(null);
    try {
      const result = await apiFetch<AcceptResponse>(`/orders/${orderId}/accept`, {
        method: 'POST',
        headers: { 'x-user-id': userId },
      });
      setMessage('验收完成，已结算');
      onAccepted?.(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '验收失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur">
      <h3 className="text-lg font-semibold">验收结算</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        A 侧验收后触发 payout，订单进入 Completed。
      </p>
      <button
        type="button"
        onClick={handleAccept}
        disabled={!isConnected || !userId || !orderId || loading}
        className="mt-4 w-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? '验收中...' : '确认验收'}
      </button>
      {message && (
        <div className="mt-3 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
          {message}
        </div>
      )}
    </div>
  );
}
