'use client';

import type { Agent } from '@c2c-agents/shared';
import { AgentStatus } from '@c2c-agents/shared';
import { Avatar, AvatarFallback, AvatarImage } from '@c2c-agents/ui';
import { AGENT_STATUS_LABELS } from '@/utils/agentStatusLabels';

type AgentHeaderProps = {
  agent: Agent;
};

const STATUS_CONFIG: Record<AgentStatus, { label: string; className: string; dotColor: string }> = {
  [AgentStatus.Idle]: {
    label: AGENT_STATUS_LABELS[AgentStatus.Idle],
    className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    dotColor: 'bg-emerald-500',
  },
  [AgentStatus.Busy]: {
    label: AGENT_STATUS_LABELS[AgentStatus.Busy],
    className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    dotColor: 'bg-yellow-500',
  },
  [AgentStatus.Queueing]: {
    label: AGENT_STATUS_LABELS[AgentStatus.Queueing],
    className: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    dotColor: 'bg-blue-500',
  },
};

export function AgentHeader({ agent }: AgentHeaderProps) {
  const statusConfig = STATUS_CONFIG[agent.status];
  const initials = agent.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {/* Avatar */}
        <Avatar className="h-32 w-32 flex-shrink-0 rounded-xl border-2 border-border">
          <AvatarImage src={agent.avatarUrl ?? undefined} alt={agent.name} />
          <AvatarFallback className="rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-2xl font-bold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-bold text-foreground">{agent.name}</h1>
                <span className="inline-flex items-center gap-1.5 rounded-full border bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-600 border-cyan-500/20">
                  <svg
                    aria-hidden="true"
                    className="h-3 w-3"
                    viewBox="0 0 12 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M6 0L7.545 4.13L12 4.635L8.73 7.455L9.708 12L6 9.885L2.292 12L3.27 7.455L0 4.635L4.455 4.13L6 0Z"
                      fill="currentColor"
                    />
                  </svg>
                  VERIFIED
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusConfig.className}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dotColor}`} />
                  {statusConfig.label.toUpperCase()}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-mono text-xs">
                  ID: {agent.id.slice(0, 8)}...{agent.id.slice(-4)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(agent.id);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                  title="复制 ID"
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
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Share & Report Icons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-primary"
                title="分享"
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
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
              </button>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-primary"
                title="报告"
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
                    d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-yellow-500">⭐</span>
              <span className="font-semibold text-foreground">{agent.avgRating.toFixed(1)}</span>
              <span className="text-muted-foreground">({agent.ratingCount} Reviews)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg
                aria-hidden="true"
                className="h-4 w-4 text-primary"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path
                  fillRule="evenodd"
                  d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="font-semibold text-primary">{agent.completedOrderCount}k</span>
              <span className="text-muted-foreground">Jobs Completed</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
