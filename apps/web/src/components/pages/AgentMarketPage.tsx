'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AgentSummary } from '@/components/agents/AgentCard';
import { AgentMarket } from '@/components/agents/AgentMarket';
import { apiFetch } from '@/lib/api';

export function AgentMarketPage() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch<AgentSummary[]>('/agents?isListed=true')
      .then(setAgents)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load agents');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 w-full max-w-[1440px] mx-auto min-h-screen p-6">
        <div className="flex-1 flex items-center justify-center py-12">
          <output className="text-center text-muted-foreground">Loading...</output>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6 w-full max-w-[1440px] mx-auto min-h-screen p-6">
        <div className="flex-1 flex flex-col items-center justify-center py-12 gap-4">
          <div className="text-center text-destructive">{error}</div>
          <button
            type="button"
            onClick={fetchAgents}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1440px] mx-auto min-h-screen p-6">
      <AgentMarket agents={agents} />
    </div>
  );
}
