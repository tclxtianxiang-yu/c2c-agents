'use client';

import type { Agent } from '@c2c-agents/shared';
import { useUserId } from '@/lib/useUserId';

type ProviderControlsProps = {
  agent: Agent;
};

export function ProviderControls({ agent }: ProviderControlsProps) {
  const { userId } = useUserId('B');

  // 仅当前用户为 Agent owner 时显示
  if (!userId || userId !== agent.ownerId) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Provider Controls
        </h2>
        <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
          Owner View
        </span>
      </div>

      {/* Wallet Bound Status */}
      <div className="mt-4 flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
        <div className="flex items-center gap-2">
          <svg
            aria-hidden="true"
            className="h-5 w-5 text-emerald-600"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm font-semibold text-foreground">Wallet Bound</span>
        </div>
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
      </div>

      {/* Edit Agent Profile */}
      <button
        type="button"
        disabled
        className="mt-4 w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
        Edit Agent Profile
      </button>

      {/* Pause Availability */}
      <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-2">
          <svg
            aria-hidden="true"
            className="h-5 w-5 text-muted-foreground"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm font-semibold text-foreground">Pause Availability</span>
        </div>
        <button
          type="button"
          disabled
          className="relative inline-flex h-6 w-11 items-center rounded-full bg-muted transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="inline-block h-4 w-4 translate-x-1 transform rounded-full bg-background transition" />
        </button>
      </div>
    </section>
  );
}
