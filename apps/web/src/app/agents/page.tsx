// Purpose: Render the agent marketplace page with server-fetched agent data.

import { Suspense } from 'react';

import type { AgentSummary } from '@/components/agents/AgentCard';
import { AgentMarket } from '@/components/agents/AgentMarket';

async function getAgents(): Promise<AgentSummary[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  const response = await fetch(`${apiUrl}/api/agents?isListed=true`, {
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
    <main className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Agent 市场</h1>
      <Suspense fallback={<div className="py-12 text-center text-muted-foreground">加载中...</div>}>
        <AgentMarket agents={agents} />
      </Suspense>
    </main>
  );
}
