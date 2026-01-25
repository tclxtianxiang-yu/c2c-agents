'use client';

import type { Order, Task } from '@c2c-agents/shared';
import { Button, Card } from '@c2c-agents/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type DeliveredActionsProps = {
  task: Task;
  order: Order;
};

type DeliveryInfo = {
  id: string;
  orderId: string;
  providerId: string;
  contentText: string | null;
  externalUrl: string | null;
  submittedAt: string;
};

type AcceptResult = {
  success: boolean;
  newStatus: string;
  message: string;
};

type RefundRequestResult = {
  success: boolean;
  newStatus: string;
  message: string;
};

const AUTO_ACCEPT_HOURS = 24;

export function DeliveredActions({ task, order }: DeliveredActionsProps) {
  const router = useRouter();
  const [delivery, setDelivery] = useState<DeliveryInfo | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  const autoAcceptAt = order.deliveredAt
    ? new Date(new Date(order.deliveredAt).getTime() + AUTO_ACCEPT_HOURS * 60 * 60 * 1000)
    : null;

  // Fetch Delivery info
  useEffect(() => {
    const fetchDelivery = async () => {
      try {
        const deliveryData = await apiFetch<DeliveryInfo>(`/orders/${order.id}/delivery`, {
          headers: {
            'x-user-id': task.creatorId,
          },
        });
        setDelivery(deliveryData);
      } catch (err) {
        console.error('Failed to fetch delivery:', err);
      }
    };

    fetchDelivery();
  }, [order.id, task.creatorId]);

  // Countdown timer for auto-accept
  useEffect(() => {
    if (!autoAcceptAt) return;

    const updateCountdown = () => {
      const now = Date.now();
      const autoAcceptTime = autoAcceptAt.getTime();
      const diff = autoAcceptTime - now;

      if (diff <= 0) {
        setTimeRemaining('即将自动验收');
        router.refresh();
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeRemaining(`${hours}小时 ${minutes}分钟 ${seconds}秒`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [autoAcceptAt, router]);

  const handleAccept = async () => {
    try {
      setIsAccepting(true);
      setError(null);

      await apiFetch<AcceptResult>(`/settlement/orders/${order.id}/accept`, {
        method: 'POST',
        headers: {
          'x-user-id': task.creatorId,
        },
      });

      // 成功后刷新页面
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '验收失败，请重试');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleSubmitRefund = async () => {
    if (!refundReason.trim()) {
      setError('请输入退款原因');
      return;
    }

    try {
      setIsSubmittingRefund(true);
      setError(null);

      await apiFetch<RefundRequestResult>(`/dispute/orders/${order.id}/request-refund`, {
        method: 'POST',
        headers: {
          'x-user-id': task.creatorId,
        },
        body: JSON.stringify({
          refundRequestReason: refundReason,
        }),
      });

      // 成功后刷新页面
      setShowRefundModal(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '发起退款失败，请重试');
    } finally {
      setIsSubmittingRefund(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <svg
              aria-hidden="true"
              className="h-5 w-5 flex-shrink-0 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-700">操作失败</p>
              <p className="mt-1 text-xs text-red-600">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Auto-accept countdown */}
      {autoAcceptAt && (
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
          <div className="flex items-start gap-3">
            <svg
              aria-hidden="true"
              className="h-5 w-5 flex-shrink-0 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-semibold text-yellow-700">自动验收倒计时</p>
              <p className="mt-1 text-xs text-yellow-600">
                剩余时间 <span className="font-mono font-bold">{timeRemaining}</span>
                ，超时将自动验收通过
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Delivery content */}
      <Card className="p-6">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            交付内容
          </h3>

          {delivery ? (
            <div className="space-y-4">
              {/* Text content */}
              {delivery.contentText && (
                <div className="rounded-lg border border-border bg-muted/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    文本内容
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                    {delivery.contentText}
                  </p>
                </div>
              )}

              {/* External URL */}
              {delivery.externalUrl && (
                <div className="rounded-lg border border-border bg-muted/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    交付链接
                  </p>
                  <a
                    href={delivery.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                  >
                    <svg
                      aria-hidden="true"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                    {delivery.externalUrl}
                  </a>
                </div>
              )}

              {/* Attachments placeholder */}
              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  附件
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {/* TODO: Implement attachment display when API is available */}
                  暂无附件
                </p>
              </div>

              {/* Submission time */}
              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted-foreground">
                  提交时间:{' '}
                  {new Date(delivery.submittedAt).toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <svg
                aria-hidden="true"
                className="h-8 w-8 animate-spin text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span className="ml-3 text-sm text-muted-foreground">加载交付内容...</span>
            </div>
          )}
        </div>
      </Card>

      {/* Action buttons */}
      {delivery && (
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                验收决策
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                请仔细检查交付内容，确认是否符合要求
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={handleAccept}
                disabled={isAccepting}
                className="flex-1"
                variant="default"
              >
                {isAccepting ? (
                  <>
                    <svg
                      aria-hidden="true"
                      className="mr-2 h-4 w-4 animate-spin"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    处理中...
                  </>
                ) : (
                  <>
                    <svg
                      aria-hidden="true"
                      className="mr-2 h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    验收通过
                  </>
                )}
              </Button>

              <Button
                onClick={() => setShowRefundModal(true)}
                disabled={isAccepting}
                className="flex-1"
                variant="outline"
              >
                <svg
                  aria-hidden="true"
                  className="mr-2 h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                  />
                </svg>
                发起退款
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Refund modal */}
      {showRefundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">发起退款申请</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    请说明退款原因，系统将发起协商流程
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRefundModal(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <svg
                    aria-hidden="true"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div>
                <label htmlFor="refundReason" className="text-sm font-semibold text-foreground">
                  退款原因
                </label>
                <textarea
                  id="refundReason"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="请详细说明退款原因..."
                />
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => setShowRefundModal(false)}
                  variant="outline"
                  className="flex-1"
                  disabled={isSubmittingRefund}
                >
                  取消
                </Button>
                <Button
                  onClick={handleSubmitRefund}
                  variant="default"
                  className="flex-1"
                  disabled={isSubmittingRefund || !refundReason.trim()}
                >
                  {isSubmittingRefund ? '提交中...' : '提交申请'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
