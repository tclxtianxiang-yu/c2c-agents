'use client';

import type { Order, Task } from '@c2c-agents/shared';
import { OrderStatus } from '@c2c-agents/shared';
import { Button, Card } from '@c2c-agents/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type FinalStatesProps = {
  task: Task;
  order: Order;
  currentUserId: string;
};

export function FinalStates({ task, order, currentUserId }: FinalStatesProps) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPublisher = currentUserId === task.creatorId;

  const handleWithdrawDispute = async () => {
    try {
      setIsProcessing(true);
      setError(null);
      console.log('撤回争议操作已触发');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '撤回争议失败');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReviewAgent = () => {
    console.log('评价 Agent 操作已触发');
  };

  return (
    <Card className="p-6">
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {(() => {
        switch (order.status) {
          case OrderStatus.Disputed:
            return (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  任务状态：争议中
                </h3>
                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
                  <p className="text-sm font-semibold text-yellow-700">
                    平台介入中，双方可继续协商。
                  </p>
                  <p className="mt-1 text-xs text-yellow-600">
                    您可以在此阶段与对方进行沟通，尝试达成一致。
                  </p>
                </div>
                <div className="flex justify-end border-t border-border pt-4">
                  <Button onClick={handleWithdrawDispute} disabled={isProcessing}>
                    {isProcessing ? '处理中...' : '撤回争议'}
                  </Button>
                </div>
              </div>
            );

          case OrderStatus.AdminArbitrating:
            return (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  任务状态：管理员仲裁中
                </h3>
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
                  <p className="text-sm font-semibold text-blue-700">
                    已进入平台仲裁流程，等待管理员处理。
                  </p>
                  <p className="mt-1 text-xs text-blue-600">
                    在此阶段，双方均无法进行操作，请等待仲裁结果。
                  </p>
                </div>
              </div>
            );

          case OrderStatus.Cancelled:
            return (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  任务状态：已取消
                </h3>
                <div className="rounded-lg border border-gray-500/20 bg-gray-500/10 p-4">
                  <p className="text-sm font-semibold text-gray-400">此订单已取消。</p>
                </div>
              </div>
            );

          case OrderStatus.Refunded:
          case OrderStatus.Paid:
          case OrderStatus.Completed: {
            const finalStatusText =
              order.status === OrderStatus.Refunded
                ? '已退款'
                : order.status === OrderStatus.Paid
                  ? '已付款'
                  : '已完成';

            return (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  任务状态：{finalStatusText}
                </h3>
                <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4">
                  <p className="text-sm font-semibold text-green-700">
                    订单已 {finalStatusText}。
                    {order.status === OrderStatus.Paid && ' 资金已支付给 Agent。'}
                    {order.status === OrderStatus.Refunded && ' 资金已退还给发布者。'}
                  </p>
                </div>
                {isPublisher &&
                  (order.status === OrderStatus.Paid || order.status === OrderStatus.Completed) && (
                    <div className="flex justify-end border-t border-border pt-4">
                      <Button onClick={handleReviewAgent}>评价 Agent</Button>
                    </div>
                  )}
              </div>
            );
          }

          default:
            return (
              <div className="text-center text-muted-foreground">
                <h3 className="text-sm font-semibold uppercase tracking-wider">未知最终状态</h3>
                <p className="mt-1 text-xs">当前订单状态无法识别或不支持：{order.status}</p>
              </div>
            );
        }
      })()}
    </Card>
  );
}
