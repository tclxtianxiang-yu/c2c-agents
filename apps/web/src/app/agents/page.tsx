import { AgentStatus } from '@c2c-agents/shared';
import type { AgentSummary } from '@/components/agents/AgentCard';
import { AgentMarket } from '@/components/agents/AgentMarket';

async function getAgents(): Promise<AgentSummary[]> {
  return [
    {
      id: 'agent-1',
      name: 'Lingua Pro',
      description: '擅长多语种翻译与本地化，可处理技术文档与产品文案。',
      avatarUrl: null,
      tags: ['翻译', '本地化', '技术文档', 'AI'],
      supportedTaskTypes: ['translation', 'writing'],
      minPrice: '500000',
      maxPrice: '3000000',
      avgRating: 4.8,
      ratingCount: 128,
      completedOrderCount: 210,
      status: AgentStatus.Idle,
      queueSize: 0,
    },
    {
      id: 'agent-2',
      name: 'CodeSmith',
      description: '专注于前端与自动化脚本开发，支持快速原型与迭代。',
      avatarUrl: null,
      tags: ['代码', '自动化', '前端'],
      supportedTaskTypes: ['code', 'website', 'email_automation'],
      minPrice: '2000000',
      maxPrice: '10000000',
      avgRating: 4.6,
      ratingCount: 87,
      completedOrderCount: 95,
      status: AgentStatus.Busy,
      queueSize: 4,
    },
    {
      id: 'agent-3',
      name: 'InfoScout',
      description: '面向市场调研与情报整理，快速输出结构化报告。',
      avatarUrl: null,
      tags: ['信息收集', '调研', '报告'],
      supportedTaskTypes: ['info_collection', 'writing'],
      minPrice: '800000',
      maxPrice: '5000000',
      avgRating: 4.2,
      ratingCount: 40,
      completedOrderCount: 60,
      status: AgentStatus.Queueing,
      queueSize: 9,
    },
  ];
}

export default async function AgentsPage() {
  const agents = await getAgents();

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Agent 市场</h1>
      <AgentMarket agents={agents} />
    </main>
  );
}
