'use client';

import type { Order } from '@c2c-agents/shared';
import { OrderStatus } from '@c2c-agents/shared';
import { Card } from '@c2c-agents/ui';
import Link from 'next/link';

type OrderStatusSectionProps = {
  order: Order | null;
};

const ORDER_STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; className: string; dotColor: string }
> = {
  [OrderStatus.Standby]: {
    label: '待匹配',
    className: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
    dotColor: 'bg-gray-500',
  },
  [OrderStatus.Executing]: {
    label: '执行中',
    className: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
    dotColor: 'bg-cyan-500',
  },
  [OrderStatus.Selecting]: {
    label: '选择中',
    className: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
    dotColor: 'bg-indigo-500',
  },
  [OrderStatus.Pairing]: {
    label: '配对中',
    className: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    dotColor: 'bg-blue-500',
  },
  [OrderStatus.InProgress]: {
    label: '进行中',
    className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    dotColor: 'bg-yellow-500',
  },
  [OrderStatus.Delivered]: {
    label: '已交付',
    className: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    dotColor: 'bg-purple-500',
  },
  [OrderStatus.Accepted]: {
    label: '已验收',
    className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    dotColor: 'bg-emerald-500',
  },
  [OrderStatus.AutoAccepted]: {
    label: '自动验收',
    className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    dotColor: 'bg-emerald-500',
  },
  [OrderStatus.RefundRequested]: {
    label: '退款申请中',
    className: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    dotColor: 'bg-orange-500',
  },
  [OrderStatus.CancelRequested]: {
    label: '取消申请中',
    className: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    dotColor: 'bg-orange-500',
  },
  [OrderStatus.Disputed]: {
    label: '争议中',
    className: 'bg-red-500/10 text-red-600 border-red-500/20',
    dotColor: 'bg-red-500',
  },
  [OrderStatus.AdminArbitrating]: {
    label: '管理员仲裁中',
    className: 'bg-red-500/10 text-red-600 border-red-500/20',
    dotColor: 'bg-red-500',
  },
  [OrderStatus.Refunded]: {
    label: '已退款',
    className: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
    dotColor: 'bg-gray-500',
  },
  [OrderStatus.Paid]: {
    label: '已支付',
    className: 'bg-green-500/10 text-green-600 border-green-500/20',
    dotColor: 'bg-green-500',
  },
  [OrderStatus.Completed]: {
    label: '已完成',
    className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    dotColor: 'bg-emerald-500',
  },
};

type TimelineEvent = {
  label: string;
  timestamp: string | null;
  completed: boolean;
};

function getTimelineEvents(order: Order): TimelineEvent[] {
  return [
    {
      label: '订单创建',
      timestamp: order.createdAt,
      completed: true,
    },
    {
      label: '支付完成',
      timestamp: order.paidAt,
      completed: !!order.paidAt,
    },
    {
      label: '配对成功',
      timestamp: order.acceptedAt,
      completed: !!order.acceptedAt,
    },
    {
      label: '任务交付',
      timestamp: order.deliveredAt,
      completed: !!order.deliveredAt,
    },
    {
      label: '验收完成',
      timestamp: order.completedAt || order.autoAcceptedAt,
      completed: !!(order.completedAt || order.autoAcceptedAt),
    },
  ];
}

function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function OrderStatusSection({ order }: OrderStatusSectionProps) {
  if (!order) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            订单状态
          </p>
          <p className="mt-2 text-muted-foreground">暂无关联订单</p>
        </div>
      </Card>
    );
  }

  const statusConfig = ORDER_STATUS_CONFIG[order.status];
  const timelineEvents = getTimelineEvents(order);

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Status Header */}
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            订单状态
          </p>
          <div className="mt-3 flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${statusConfig.className}`}
            >
              <span className={`h-2 w-2 rounded-full ${statusConfig.dotColor}`} />
              {statusConfig.label}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              订单 ID: {order.id.slice(0, 8)}...{order.id.slice(-4)}
            </span>
          </div>
        </div>

        {/* Agent Info */}
        {order.agentId && (
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              执行 Agent
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Link
                href={`/agents/${order.agentId}`}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted px-4 py-2 text-sm font-semibold text-foreground hover:border-primary/40 hover:text-primary"
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
                    d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                  />
                </svg>
                查看 Agent 详情
              </Link>
              {order.providerId && (
                <span className="font-mono text-xs text-muted-foreground">
                  Provider ID: {order.providerId.slice(0, 8)}...{order.providerId.slice(-4)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Timeline */}
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            时间轴
          </p>
          <div className="mt-4 space-y-4">
            {timelineEvents.map((event, index) => (
              <div key={event.label} className="flex items-start gap-4">
                {/* Timeline Icon */}
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                      event.completed
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-muted text-muted-foreground'
                    }`}
                  >
                    {event.completed ? (
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
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      <span className="text-xs font-bold">{index + 1}</span>
                    )}
                  </div>
                  {index < timelineEvents.length - 1 && (
                    <div className={`h-8 w-0.5 ${event.completed ? 'bg-primary' : 'bg-border'}`} />
                  )}
                </div>

                {/* Timeline Content */}
                <div className="flex-1 pb-4">
                  <p
                    className={`text-sm font-semibold ${event.completed ? 'text-foreground' : 'text-muted-foreground'}`}
                  >
                    {event.label}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatTimestamp(event.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
