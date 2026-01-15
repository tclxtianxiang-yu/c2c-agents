'use client';

import type { DeliveryWithAttachments } from '@c2c-agents/shared';
import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useUserId } from '../../lib/useUserId';

type DeliveryResponse = {
  delivery: DeliveryWithAttachments;
  deliveredAt: string;
  autoAcceptDeadline: string | null;
};

type DeliverySubmitFormProps = {
  orderId: string;
  onSubmitted?: (payload: DeliveryResponse) => void;
};

export function DeliverySubmitForm({ orderId, onSubmitted }: DeliverySubmitFormProps) {
  const { userId, isConnected } = useUserId('B');
  const [contentText, setContentText] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [attachments, setAttachments] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!orderId || !userId) return;
    setLoading(true);
    setMessage(null);
    try {
      const payload = await apiFetch<DeliveryResponse>(`/orders/${orderId}/deliveries`, {
        method: 'POST',
        headers: { 'x-user-id': userId },
        body: JSON.stringify({
          contentText: contentText.trim() || undefined,
          externalUrl: externalUrl.trim() || undefined,
          attachments: attachments
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });
      setMessage('交付已提交');
      onSubmitted?.(payload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '交付提交失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur">
      <h3 className="text-lg font-semibold">提交交付</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        文本/链接/附件至少填写一项，提交后进入 Delivered。
      </p>

      <div className="mt-4 flex flex-col gap-3 text-sm">
        <label className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">交付文本</span>
          <textarea
            className="min-h-[120px] rounded-lg border border-input bg-background/70 p-3 text-sm text-foreground focus:border-primary focus:outline-none"
            value={contentText}
            onChange={(event) => setContentText(event.target.value)}
            placeholder="交付说明/结果摘要..."
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">交付链接</span>
          <input
            className="h-10 rounded-lg border border-input bg-background/70 px-3 text-sm text-foreground focus:border-primary focus:outline-none"
            value={externalUrl}
            onChange={(event) => setExternalUrl(event.target.value)}
            placeholder="https://..."
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">附件文件 ID（逗号分隔）</span>
          <input
            className="h-10 rounded-lg border border-input bg-background/70 px-3 text-sm text-foreground focus:border-primary focus:outline-none"
            value={attachments}
            onChange={(event) => setAttachments(event.target.value)}
            placeholder="file-uuid-1, file-uuid-2"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!isConnected || !userId || !orderId || loading}
        className="mt-5 w-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? '提交中...' : '提交交付'}
      </button>

      {message && (
        <div className="mt-3 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
          {message}
        </div>
      )}
    </div>
  );
}
