'use client';

import type { Order, Task } from '@c2c-agents/shared';
import { OrderStatus } from '@c2c-agents/shared';
import { Button, Card, Textarea } from '@c2c-agents/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';

type RequestActionsProps = {
  task: Task;
  order: Order;
  currentUserId: string;
};

type ApiResult = {
  success: boolean;
  newStatus?: OrderStatus;
  message: string;
};

export function RequestActions({ task, order, currentUserId }: RequestActionsProps) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');

  const isPublisher = currentUserId === task.creatorId;
  const isProvider = currentUserId === order.providerId;

  const isRefundRequest = order.status === OrderStatus.RefundRequested;
  const requestReason = isRefundRequest ? order.refundRequestReason : order.cancelRequestReason;
  const requestInitiatorRole = isRefundRequest ? 'Publisher' : 'Provider';
  const canTakeAction = (isRefundRequest && isProvider) || (!isRefundRequest && isPublisher);

  const handleAgree = async () => {
    const endpoint = isRefundRequest
      ? `/dispute/orders/${order.id}/agree-refund`
      : `/dispute/orders/${order.id}/agree-cancel`;
    try {
      setIsProcessing(true);
      setError(null);
      await apiFetch<ApiResult>(endpoint, {
        method: 'POST',
        headers: { 'x-user-id': currentUserId },
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setShowDisputeModal(true);
  };

  const handleSubmitDispute = async () => {
    if (!disputeReason.trim()) {
      setError('请输入平台介入原因');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);
      await apiFetch<ApiResult>(`/dispute/orders/${order.id}/platform-intervene`, {
        method: 'POST',
        headers: { 'x-user-id': currentUserId },
        body: JSON.stringify({ reason: disputeReason }),
      });
      setShowDisputeModal(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '发起争议失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {isRefundRequest ? '退款申请处理' : '任务中断申请处理'}
            </h3>
            <p className="mt-2 text-sm text-foreground">
              {requestInitiatorRole} 发起了 <strong>{isRefundRequest ? '退款' : '中断'}</strong>{' '}
              申请.
            </p>
          </div>

          {requestReason && (
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                申请原因
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{requestReason}</p>
            </div>
          )}

          {canTakeAction ? (
            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row">
              <Button
                onClick={handleAgree}
                disabled={isProcessing}
                className="flex-1"
                variant="default"
              >
                {isProcessing ? '处理中...' : '同意申请'}
              </Button>
              <Button
                onClick={handleReject}
                disabled={isProcessing}
                className="flex-1"
                variant="outline"
              >
                拒绝并请求平台介入
              </Button>
            </div>
          ) : (
            <div className="border-t border-border pt-4 text-center text-sm text-muted-foreground">
              等待对方响应...
            </div>
          )}
        </div>
      </Card>

      {/* Dispute Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">请求平台介入</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                请说明您拒绝对方申请并请求平台介入的原因。
              </p>

              <div>
                <Textarea
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  rows={4}
                  className="mt-2 w-full"
                  placeholder="详细说明情况，例如：交付内容不符合要求，但对方拒绝修改..."
                />
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => setShowDisputeModal(false)}
                  variant="outline"
                  className="flex-1"
                  disabled={isProcessing}
                >
                  取消
                </Button>
                <Button
                  onClick={handleSubmitDispute}
                  variant="destructive"
                  className="flex-1"
                  disabled={isProcessing || !disputeReason.trim()}
                >
                  {isProcessing ? '提交中...' : '提交并發起爭議'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
