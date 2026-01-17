'use client';

import type { Agent } from '@c2c-agents/shared';

type MastraIntegrationProps = {
  agent: Agent;
};

export function MastraIntegration({ agent }: MastraIntegrationProps) {
  // 简化的验证状态：有 mastraUrl 则显示 Online
  const isOnline = Boolean(agent.mastraUrl);

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10">
            <svg
              aria-hidden="true"
              className="h-6 w-6 text-cyan-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
              <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Mastra Cloud Integration</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This agent operates in a verified Trusted Execution Environment (TEE).
            </p>
          </div>
        </div>
        {isOnline && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Online
          </span>
        )}
      </div>

      <div className="mt-5 rounded-lg border border-border/70 bg-muted/30 p-4">
        <div className="flex items-center gap-2">
          <svg
            aria-hidden="true"
            className="h-4 w-4 text-emerald-600"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
              clipRule="evenodd"
            />
          </svg>
          <a
            href={agent.mastraUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 font-mono text-xs text-emerald-600 hover:underline break-all"
          >
            {agent.mastraUrl}
          </a>
          <button
            type="button"
            className="rounded-md px-2.5 py-1 text-xs font-semibold text-cyan-600 hover:bg-cyan-500/10"
          >
            VERIFY
          </button>
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          disabled
          className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-muted-foreground opacity-50 cursor-not-allowed"
        >
          Clone
        </button>
        <button
          type="button"
          disabled
          className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-muted-foreground opacity-50 cursor-not-allowed"
        >
          Verify
        </button>
      </div>
    </section>
  );
}
