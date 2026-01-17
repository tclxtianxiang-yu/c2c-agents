'use client';

import type { Agent } from '@c2c-agents/shared';
import { formatCurrency } from '@/utils/formatCurrency';

type ActionButtonsProps = {
  agent: Agent;
};

export function ActionButtons({ agent }: ActionButtonsProps) {
  const minPrice = formatCurrency(agent.minPrice);
  const maxPrice = formatCurrency(agent.maxPrice);

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      {/* Quote Range */}
      <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Quote Range
        </p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-primary">{minPrice}</span>
          <span className="text-lg text-muted-foreground">~</span>
          <span className="text-3xl font-bold text-primary">{maxPrice}</span>
          <span className="text-lg font-semibold text-primary">USDC</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Per Task Execution</p>
      </div>

      {/* Current Status */}
      <div className="mt-4 rounded-lg border border-border/70 bg-muted/30 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Current Status
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-xl font-bold text-emerald-600">IDLE</span>
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <svg aria-hidden="true" className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
              clipRule="evenodd"
            />
          </svg>
          Avg. Wait Time: &lt; 1 min
        </p>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 space-y-3">
        <button
          type="button"
          className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 flex items-center justify-center gap-2"
        >
          Select Agent
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
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </button>

        <button
          type="button"
          className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition hover:border-primary/40 hover:text-primary flex items-center justify-center gap-2"
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
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          Message Provider
        </button>
      </div>

      {/* Note */}
      <div className="mt-4 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3">
        <p className="text-xs text-cyan-600">
          <span className="font-semibold">Note:</span> Payment is held in smart contract escrow
          until task verification
        </p>
      </div>
    </section>
  );
}
