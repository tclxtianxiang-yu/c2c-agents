'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AgentSummary } from '@/components/agents/AgentCard';
import { AgentMarket } from '@/components/agents/AgentMarket';
import { TopNav } from '@/components/layout/TopNav';
import { apiFetch } from '@/lib/api';

type AgentsApiResponse = AgentSummary[] | { items: AgentSummary[] };

export function AgentsListPage() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch<AgentsApiResponse>('/agents?isListed=true')
      .then((data) => {
        // Handle both array and { items: [] } response formats
        const items = Array.isArray(data) ? data : (data.items ?? []);
        setAgents(items);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load agents');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <TopNav />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <output className="text-center text-muted-foreground">加载中...</output>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="text-center text-destructive">{error}</div>
            <button
              type="button"
              onClick={fetchAgents}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              重试
            </button>
          </div>
        )}

        {!loading && !error && <AgentMarket agents={agents} />}
      </div>
    </main>
  );
}
