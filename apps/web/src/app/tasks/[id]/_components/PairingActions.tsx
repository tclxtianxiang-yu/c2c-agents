'use client';

import type { Order, Task } from '@c2c-agents/shared';
import { fromMinUnit } from '@c2c-agents/shared';
import { Avatar, AvatarFallback, AvatarImage, Button, Card } from '@c2c-agents/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type PairingActionsProps = {
  task: Task;
  order: Order;
};

type AgentInfo = {
  id: string;
  name: string;
  description: string;
  avatarUrl: string | null;
  minPrice: string;
  maxPrice: string;
  avgRating: number;
  ratingCount: number;
  completedOrderCount: number;
};

type PairingActionResult = {
  success: boolean;
  newStatus: string;
  message: string;
};

const PAIRING_TTL_HOURS = 24;

export function PairingActions({ task, order }: PairingActionsProps) {
  const router = useRouter();
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  // In task detail page, always show creator's view (A side)
  const isCreator = true;
  const expiresAt = order.pairingCreatedAt
    ? new Date(new Date(order.pairingCreatedAt).getTime() + PAIRING_TTL_HOURS * 60 * 60 * 1000)
    : null;

  // Fetch Agent info
  useEffect(() => {
    const fetchAgent = async () => {
      if (!order.agentId) return;

      try {
        const agentData = await apiFetch<AgentInfo>(`/agents/${order.agentId}`, {
          headers: {
            'x-user-id': task.creatorId,
          },
        });
        setAgent(agentData);
      } catch (err) {
        console.error('Failed to fetch agent:', err);
      }
    };

    fetchAgent();
  }, [order.agentId, task.creatorId]);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;

    const updateCountdown = () => {
      const now = Date.now();
      const expireTime = expiresAt.getTime();
      const diff = expireTime - now;

      if (diff <= 0) {
        setTimeRemaining('已过期');
        router.refresh(); // Refresh to show updated status
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
  }, [expiresAt, router]);

  const handleAccept = async () => {
    try {
      setIsAccepting(true);
      setError(null);

      await apiFetch<PairingActionResult>('/matching/pairing/accept', {
        method: 'POST',
        headers: {
          'x-user-id': task.creatorId,
        },
        body: JSON.stringify({
          orderId: order.id,
          role: 'A',
        }),
      });

      // 成功后刷新页面，展示 InProgress 状态
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '同意配对失败，请重试');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleReject = async () => {
    try {
      setIsRejecting(true);
      setError(null);

      await apiFetch<PairingActionResult>('/matching/pairing/reject', {
        method: 'POST',
        headers: {
          'x-user-id': task.creatorId,
        },
        body: JSON.stringify({
          orderId: order.id,
          role: 'A',
        }),
      });

      // 成功后刷新页面，回到 Standby 状态
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '拒绝配对失败，请重试');
    } finally {
      setIsRejecting(false);
    }
  };

  const initials =
    agent?.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) ?? '?';

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

      {/* TTL Countdown */}
      {expiresAt && (
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
              <p className="text-sm font-semibold text-yellow-700">配对等待中</p>
              <p className="mt-1 text-xs text-yellow-600">
                请在 <span className="font-mono font-bold">{timeRemaining}</span>{' '}
                内做出决策，否则配对将自动取消
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Agent Info Card */}
      <Card className="p-6">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            配对 Agent 信息
          </h3>

          {agent ? (
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16 flex-shrink-0 rounded-xl border-2 border-border">
                <AvatarImage src={agent.avatarUrl ?? undefined} alt={agent.name} />
                <AvatarFallback className="rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-lg font-bold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-lg font-bold text-foreground">{agent.name}</h4>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {agent.description}
                    </p>
                  </div>
                  <Link
                    href={`/agents/${agent.id}`}
                    className="flex-shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary/40 hover:text-primary"
                  >
                    查看详情
                  </Link>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="text-yellow-500">⭐</span>
                    <span className="font-semibold text-foreground">
                      {agent.avgRating.toFixed(1)}
                    </span>
                    <span className="text-muted-foreground">({agent.ratingCount})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg
                      aria-hidden="true"
                      className="h-4 w-4 text-primary"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="font-semibold text-primary">{agent.completedOrderCount}</span>
                    <span className="text-muted-foreground">已完成任务</span>
                  </div>
                </div>

                <div className="mt-3 rounded-lg border border-border bg-muted p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    报价范围
                  </p>
                  <p className="mt-1 text-sm font-bold text-foreground">
                    {fromMinUnit(agent.minPrice, 6)} - {fromMinUnit(agent.maxPrice, 6)} USDT
                  </p>
                </div>
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
              <span className="ml-3 text-sm text-muted-foreground">加载 Agent 信息...</span>
            </div>
          )}
        </div>
      </Card>

      {/* Action Buttons (Creator only) */}
      {isCreator && agent && (
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                配对决策
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                请确认是否同意由该 Agent 执行您的任务
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={handleAccept}
                disabled={isAccepting || isRejecting}
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
                    同意配对
                  </>
                )}
              </Button>

              <Button
                onClick={handleReject}
                disabled={isAccepting || isRejecting}
                className="flex-1"
                variant="outline"
              >
                {isRejecting ? (
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                    拒绝配对
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
