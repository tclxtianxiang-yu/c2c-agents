'use client';

import type { DeliveryWithAttachments } from '@c2c-agents/shared';
import { useState } from 'react';
import { AutoAcceptCountdown } from '../../../components/delivery/AutoAcceptCountdown';
import { DeliverySubmitForm } from '../../../components/delivery/DeliverySubmitForm';
import { DeliverySummary } from '../../../components/delivery/DeliverySummary';
import { TopNav } from '../../../components/layout/TopNav';
import { apiFetch } from '../../../lib/api';

type DeliveryResponse = {
  delivery: DeliveryWithAttachments;
  deliveredAt: string | null;
  autoAcceptDeadline: string | null;
};

export default function WorkbenchPage() {
  const [orderId, setOrderId] = useState('');
  const [deliveryData, setDeliveryData] = useState<DeliveryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleFetchDelivery = async () => {
    if (!orderId) return;
    setLoading(true);
    setMessage(null);
    try {
      const data = await apiFetch<DeliveryResponse>(`/orders/${orderId}/delivery`);
      setDeliveryData(data);
      setMessage(null);
    } catch (error) {
      setDeliveryData(null);
      setMessage(error instanceof Error ? error.message : '读取交付失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(24,36,70,0.6),rgba(10,14,30,0.95))] text-foreground">
      <TopNav />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
        <section className="rounded-3xl border border-border/70 bg-card/70 p-8 shadow-[0_35px_80px_rgba(8,12,28,0.55)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Workbench</p>
          <h1 className="mt-3 text-3xl font-semibold">B 侧工作台</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            在这里提交交付、查看交付进度与自动验收倒计时。
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.6fr_1fr]">
          <div className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur">
            <h3 className="text-lg font-semibold">订单查询</h3>
            <p className="mt-1 text-xs text-muted-foreground">输入订单 ID 以查看交付信息。</p>
            <div className="mt-4 flex flex-col gap-3">
              <input
                className="h-10 rounded-lg border border-input bg-background/70 px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                placeholder="order-uuid"
                value={orderId}
                onChange={(event) => setOrderId(event.target.value)}
              />
              <button
                type="button"
                onClick={handleFetchDelivery}
                disabled={!orderId || loading}
                className="rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? '加载中...' : '加载交付'}
              </button>
              {message && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/15 px-3 py-2 text-xs text-destructive">
                  {message}
                </div>
              )}
              {deliveryData?.deliveredAt && (
                <AutoAcceptCountdown deliveredAt={deliveryData.deliveredAt} />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-6">
            {orderId && (
              <DeliverySubmitForm
                orderId={orderId}
                onSubmitted={(payload) => setDeliveryData(payload)}
              />
            )}
            {deliveryData?.delivery && (
              <DeliverySummary
                delivery={deliveryData.delivery}
                deliveredAt={deliveryData.deliveredAt}
              />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
