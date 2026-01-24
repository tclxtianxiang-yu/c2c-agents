'use client';

import type { Agent } from '@c2c-agents/shared';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AboutAgent } from '@/app/agents/[id]/_components/AboutAgent';
import { ActionButtons } from '@/app/agents/[id]/_components/ActionButtons';
import { AgentHeader } from '@/app/agents/[id]/_components/AgentHeader';
import { MastraIntegration } from '@/app/agents/[id]/_components/MastraIntegration';
import { ProviderControls } from '@/app/agents/[id]/_components/ProviderControls';
import { RecentActivity } from '@/app/agents/[id]/_components/RecentActivity';
import { apiFetch } from '@/lib/api';

type AgentDetailPageProps = {
  agentId: string;
};

export function AgentDetailPage({ agentId }: AgentDetailPageProps) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgent = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch<Agent>(`/agents/${agentId}`)
      .then(setAgent)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load agent');
      })
      .finally(() => setLoading(false));
  }, [agentId]);

  useEffect(() => {
    fetchAgent();
  }, [fetchAgent]);

  if (loading) {
    return (
      <main className="min-h-screen bg-background px-4 py-12 text-foreground">
        <div className="mx-auto w-full max-w-7xl">
          <output className="block py-12 text-center text-muted-foreground">加载中...</output>
        </div>
      </main>
    );
  }

  if (error || !agent) {
    return (
      <main className="min-h-screen bg-background px-4 py-12 text-foreground">
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-border bg-card p-8 shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            {error ? 'Error' : 'Agent Not Found'}
          </p>
          <h1 className="mt-4 text-2xl font-semibold">{error ?? '无法找到该 Agent'}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            请求的 Agent ID: <span className="font-mono text-foreground">{agentId}</span>
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              href="/agents"
              className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:border-primary/40 hover:text-primary"
            >
              返回市场
            </Link>
            {error && (
              <button
                type="button"
                onClick={fetchAgent}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                重试
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto w-full max-w-7xl">
        {/* Breadcrumb */}
        <nav className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/agents" className="hover:text-foreground">
            Marketplace
          </Link>
          <span>/</span>
          <Link href="/agents" className="hover:text-foreground">
            AI Agents
          </Link>
          <span>/</span>
          <span className="text-foreground">{agent.name}</span>
        </nav>

        {/* Agent Header */}
        <AgentHeader agent={agent} />

        {/* Main Content Grid */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_400px]">
          {/* Left Column */}
          <div className="space-y-6">
            <AboutAgent agent={agent} />
            <MastraIntegration agent={agent} />
            <RecentActivity agentId={agent.id} />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <ActionButtons agent={agent} />
            <ProviderControls agent={agent} />
          </div>
        </div>
      </div>
    </main>
  );
}
