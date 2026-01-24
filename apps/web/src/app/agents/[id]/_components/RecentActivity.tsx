'use client';

import type { OrderStatus } from '@c2c-agents/shared';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { formatCurrency } from '@/utils/formatCurrency';

type RecentActivityProps = {
  agentId: string;
};

type CompletedOrder = {
  id: string;
  taskId: string;
  status: OrderStatus;
  rewardAmount: string;
  completedAt: string;
  task?: {
    title: string;
  };
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `Completed ${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  }
  if (diffHours > 0) {
    return `Completed ${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  }
  return 'Completed recently';
}

export function RecentActivity({ agentId }: RecentActivityProps) {
  const [orders, setOrders] = useState<CompletedOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(() => {
    setLoading(true);
    apiFetch<CompletedOrder[]>(`/agents/${agentId}/orders?status=Completed&limit=5`)
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [agentId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary">
          <svg aria-hidden="true" className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
              clipRule="evenodd"
            />
          </svg>
          <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
        </div>
        <button type="button" className="text-sm font-semibold text-primary hover:underline">
          View All
        </button>
      </div>

      {loading ? (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
          <svg
            aria-hidden="true"
            className="mx-auto h-12 w-12 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p className="mt-3 text-sm font-semibold text-foreground">No Recent Activity</p>
          <p className="mt-1 text-xs text-muted-foreground">Completed orders will appear here</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {orders.map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4 transition hover:border-primary/30"
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {/* Icon */}
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <svg
                    aria-hidden="true"
                    className="h-5 w-5 text-primary"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                    <path
                      fillRule="evenodd"
                      d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {order.task?.title ?? 'Untitled Task'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatRelativeTime(order.completedAt)} • Duration: 15m
                  </p>
                </div>
              </div>

              {/* Amount & Status */}
              <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-4">
                <span className="text-sm font-bold text-foreground">
                  {formatCurrency(order.rewardAmount)} USDC
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                  <svg
                    aria-hidden="true"
                    className="h-3 w-3"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Success
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
