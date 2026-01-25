'use client';

import type { Order, Task } from '@c2c-agents/shared';
import { Button, Card } from '@c2c-agents/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';

type StandbyActionsProps = {
  task: Task;
  order: Order;
};

type AutoMatchResult =
  | {
      result: 'pairing';
      orderId: string;
      agentId: string;
      providerId: string;
      status: string;
    }
  | {
      result: 'queued';
      orderId: string;
      agentId: string;
      status: string;
      queuePosition: number;
      queuedCount: number;
      capacity: number;
    };

type CancelQueueResult = {
  orderId: string;
  status: string;
  message: string;
};

export function StandbyActions({ task, order }: StandbyActionsProps) {
  const router = useRouter();
  const [isAutoMatching, setIsAutoMatching] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isQueued = !!order.agentId;

  const handleAutoMatch = async () => {
    try {
      setIsAutoMatching(true);
      setError(null);

      const result = await apiFetch<AutoMatchResult>('/matching/auto', {
        method: 'POST',
        headers: {
          'x-user-id': task.creatorId,
        },
        body: JSON.stringify({
          taskId: task.id,
        }),
      });

      if (result.result === 'pairing') {
        // 成功创建 Pairing，刷新页面展示 Pairing UI
        router.refresh();
      } else if (result.result === 'queued') {
        // 加入队列，显示提示并刷新
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '自动匹配失败，请重试');
    } finally {
      setIsAutoMatching(false);
    }
  };

  const handleManualSelect = () => {
    router.push(`/agents?taskId=${task.id}`);
  };

  const handleCancelQueue = async () => {
    try {
      setIsCanceling(true);
      setError(null);

      await apiFetch<CancelQueueResult>('/matching/queue/cancel', {
        method: 'POST',
        headers: {
          'x-user-id': task.creatorId,
        },
        body: JSON.stringify({
          orderId: order.id,
        }),
      });

      // 取消成功，刷新页面恢复自动匹配按钮
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '取消排队失败，请重试');
    } finally {
      setIsCanceling(false);
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

      {!isQueued ? (
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                选择匹配方式
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                您可以让系统自动为您匹配最合适的 Agent，或者手动选择心仪的 Agent
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={handleAutoMatch}
                disabled={isAutoMatching}
                className="flex-1"
                variant="default"
              >
                {isAutoMatching ? (
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
                    匹配中...
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
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    自动匹配
                  </>
                )}
              </Button>

              <Button
                onClick={handleManualSelect}
                disabled={isAutoMatching}
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
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                手动选择 Agent
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/10">
                <svg
                  aria-hidden="true"
                  className="h-6 w-6 text-blue-600"
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
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-foreground">已加入队列</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  您的任务已加入 Agent 队列，请耐心等待。Agent 完成当前任务后会自动处理您的任务。
                </p>
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <span className="font-mono text-xs text-muted-foreground">
                    Agent ID: {order.agentId.slice(0, 8)}...{order.agentId.slice(-4)}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <Button
                onClick={handleCancelQueue}
                disabled={isCanceling}
                variant="outline"
                className="w-full sm:w-auto"
              >
                {isCanceling ? (
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
                    取消中...
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                    取消排队
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
