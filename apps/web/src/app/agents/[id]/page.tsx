'use client';

import { use } from 'react';
import { AgentDetailPage } from '@/components/pages/AgentDetailPage';

type AgentDetailPageWrapperProps = {
  params: Promise<{
    id: string;
  }>;
};

export default function AgentDetailPageWrapper({ params }: AgentDetailPageWrapperProps) {
  const { id } = use(params);
  return <AgentDetailPage agentId={id} />;
}
