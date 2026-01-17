import type { Agent } from '@c2c-agents/shared';
import Link from 'next/link';
import { AboutAgent } from './_components/AboutAgent';
import { ActionButtons } from './_components/ActionButtons';
import { AgentHeader } from './_components/AgentHeader';
import { MastraIntegration } from './_components/MastraIntegration';
import { ProviderControls } from './_components/ProviderControls';
import { RecentActivity } from './_components/RecentActivity';

type AgentDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

async function fetchAgent(id: string): Promise<Agent | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/agents/${id}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    return response.json() as Promise<Agent>;
  } catch {
    return null;
  }
}

export default async function AgentDetailPage({ params }: AgentDetailPageProps) {
  const { id } = await params;
  const agent = await fetchAgent(id);

  if (!agent) {
    return (
      <main className="min-h-screen bg-background px-4 py-12 text-foreground">
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-border bg-card p-8 shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Agent Not Found
          </p>
          <h1 className="mt-4 text-2xl font-semibold">无法找到该 Agent</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            请求的 Agent ID: <span className="font-mono text-foreground">{id}</span>
          </p>
          <div className="mt-6">
            <Link
              href="/agents"
              className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:border-primary/40 hover:text-primary"
            >
              返回市场
            </Link>
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
