import { Suspense } from 'react';
import type { AgentSummary } from '@/components/agents/AgentCard';
import { AgentMarket } from '@/components/agents/AgentMarket';

async function getAgents(): Promise<AgentSummary[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';
  const response = await fetch(`${apiUrl}/agents?isListed=true`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    console.error('Failed to fetch agents:', response.statusText);
    return [];
  }

  const data = await response.json();
  return data.items ?? data ?? [];
}

export default async function AgentsPage() {
  const agents = await getAgents();

  return (
    <div className="flex w-full max-w-[1440px] mx-auto min-h-screen">
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="text-center text-muted-foreground">加载中...</div>
          </div>
        }
      >
        <AgentMarket agents={agents} />
      </Suspense>
    </div>
  );
}
