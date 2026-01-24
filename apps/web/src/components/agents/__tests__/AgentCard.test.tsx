import { AgentStatus } from '@c2c-agents/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AgentCard, type AgentSummary } from '../AgentCard';

describe('AgentCard', () => {
  const baseAgent: AgentSummary = {
    id: 'agent-1',
    ownerId: 'user-1',
    name: 'Test Agent',
    description: '擅长测试与验证。',
    avatarUrl: null,
    tags: ['测试', '自动化', '代码', '前端'],
    supportedTaskTypes: ['code'],
    minPrice: '1000000',
    maxPrice: '3000000',
    avgRating: 4.5,
    ratingCount: 20,
    completedOrderCount: 12,
    status: AgentStatus.Busy,
    queueSize: 3,
  };

  it('renders view details button without task context', () => {
    const markup = renderToStaticMarkup(<AgentCard agent={baseAgent} />);

    expect(markup).toContain('查看详情');
    expect(markup).toContain('Test Agent');
    expect(markup).toContain('+1');
  });

  it('disables selection when reward is out of range', () => {
    const markup = renderToStaticMarkup(
      <AgentCard
        agent={baseAgent}
        taskContext={{ taskId: 'task-1', reward: '500000', type: 'code' }}
        onSelect={() => undefined}
      />
    );

    expect(markup).toContain('选择此 Agent');
    expect(markup).toContain('报价不匹配');
  });

  it('renders estimated completion time for idle agent', () => {
    const markup = renderToStaticMarkup(
      <AgentCard agent={{ ...baseAgent, status: AgentStatus.Idle, queueSize: 0 }} />
    );

    expect(markup).toContain('预计完成');
    expect(markup).toContain('立即开始');
  });

  it('renders estimated completion time for busy agent without queue', () => {
    const markup = renderToStaticMarkup(
      <AgentCard agent={{ ...baseAgent, status: AgentStatus.Busy, queueSize: 0 }} />
    );

    expect(markup).toContain('预计 1 个工作日');
  });

  it('renders estimated completion time for busy agent with queue', () => {
    const markup = renderToStaticMarkup(
      <AgentCard agent={{ ...baseAgent, status: AgentStatus.Busy, queueSize: 5 }} />
    );

    expect(markup).toContain('预计 6 个工作日');
  });

  it('shows loading state when selecting', () => {
    const markup = renderToStaticMarkup(
      <AgentCard
        agent={baseAgent}
        taskContext={{ taskId: 'task-1', reward: '1500000', type: 'code' }}
        onSelect={() => undefined}
        isSelecting
      />
    );

    expect(markup).toContain('选择中...');
    expect(markup).toContain('aria-busy="true"');
  });

  it('adds aria-label to status badge', () => {
    const markup = renderToStaticMarkup(<AgentCard agent={baseAgent} />);

    expect(markup).toContain('aria-label="状态：忙碌"');
  });
});
