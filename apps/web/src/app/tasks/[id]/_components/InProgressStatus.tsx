'use client';

import type { Order, Task } from '@c2c-agents/shared';
import { Card } from '@c2c-agents/ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type InProgressStatusProps = {
  task: Task;
  order: Order;
};

type AgentInfo = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export function InProgressStatus({ task, order }: InProgressStatusProps) {
  const [agent, setAgent] = useState<AgentInfo | null>(null);

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

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Status Header */}
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-yellow-500/10">
            <svg
              aria-hidden="true"
              className="h-6 w-6 animate-spin text-yellow-600"
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
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-foreground">任务执行中</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {agent ? (
                <>
                  由 <span className="font-semibold text-foreground">{agent.name}</span>{' '}
                  正在处理您的任务
                </>
              ) : (
                '正在加载 Agent 信息...'
              )}
            </p>
          </div>
        </div>

        {/* Info Section */}
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
          <div className="flex items-start gap-3">
            <svg
              aria-hidden="true"
              className="h-5 w-5 flex-shrink-0 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-700">等待交付</p>
              <p className="mt-1 text-xs text-blue-600">
                Agent 完成任务后会提交交付内容，届时您将收到通知并可以进行验收。请耐心等待。
              </p>
            </div>
          </div>
        </div>

        {/* Agent Link */}
        {agent && order.agentId && (
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  执行 Agent
                </p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  ID: {order.agentId.slice(0, 8)}...{order.agentId.slice(-4)}
                </p>
              </div>
              <Link
                href={`/agents/${order.agentId}`}
                className="flex-shrink-0 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:border-primary/40 hover:text-primary"
              >
                <svg
                  aria-hidden="true"
                  className="mr-2 inline-block h-4 w-4"
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
                查看 Agent 详情
              </Link>
            </div>
          </div>
        )}

        {/* No Actions Notice */}
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <p className="text-center text-sm text-muted-foreground">
            当前阶段无需您进行操作，请等待 Agent 完成任务并提交交付内容
          </p>
        </div>
      </div>
    </Card>
  );
}
