// Purpose: Verify AgentSelectModal renders task/agent context and controls.

import { AgentStatus } from '@c2c-agents/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { AgentSelectModal } from '../AgentSelectModal';

describe('AgentSelectModal', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    taskContext: {
      taskId: 'task-1',
      orderId: 'order-1',
      reward: '1500000',
      type: 'code' as const,
    },
    agent: {
      id: 'agent-1',
      name: 'Test Agent',
      status: AgentStatus.Idle,
    },
    onSuccess: vi.fn(),
    onError: vi.fn(),
  };

  it('renders task and agent information', () => {
    const markup = renderToStaticMarkup(<AgentSelectModal {...defaultProps} />);

    expect(markup).toContain('确认选择 Agent');
    expect(markup).toContain('任务信息');
    expect(markup).toContain('Agent 信息');
    expect(markup).toContain('Test Agent');
    expect(markup).toContain('1.50 USDT');
  });

  it('renders confirm and cancel buttons', () => {
    const markup = renderToStaticMarkup(<AgentSelectModal {...defaultProps} />);

    expect(markup).toContain('确认选择');
    expect(markup).toContain('取消');
  });

  it('displays agent status label', () => {
    const markup = renderToStaticMarkup(<AgentSelectModal {...defaultProps} />);

    expect(markup).toContain('空闲');
  });

  it('displays task type label', () => {
    const markup = renderToStaticMarkup(<AgentSelectModal {...defaultProps} />);

    expect(markup).toContain('代码');
  });

  it('does not render when closed', () => {
    const markup = renderToStaticMarkup(<AgentSelectModal {...defaultProps} open={false} />);

    expect(markup).not.toContain('确认选择 Agent');
  });
});
