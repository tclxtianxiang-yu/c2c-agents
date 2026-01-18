import type { Agent, QueueItem, Task } from '@c2c-agents/shared';
import { QueueItemStatus } from '@c2c-agents/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { QueueItemCard } from '../QueueItemCard';

const baseItem: QueueItem = {
  id: 'queue-item-1',
  agentId: 'agent-1',
  taskId: 'task-1',
  orderId: 'order-1',
  status: QueueItemStatus.Queued,
  createdAt: '2026-01-10T10:00:00.000Z',
  consumedAt: null,
  canceledAt: null,
};

const baseTask: Pick<Task, 'id' | 'title' | 'type' | 'expectedReward'> = {
  id: 'task-1',
  title: '测试任务标题',
  type: 'code',
  expectedReward: '2500000',
};

const baseAgent: Pick<Agent, 'id' | 'name' | 'avatarUrl'> = {
  id: 'agent-1',
  name: '队列 Agent',
  avatarUrl: null,
};

describe('QueueItemCard', () => {
  it.each([
    { status: QueueItemStatus.Queued, label: '排队中' },
    { status: QueueItemStatus.Consumed, label: '执行中' },
    { status: QueueItemStatus.Canceled, label: '已取消' },
  ])('renders %s status badge', ({ status, label }) => {
    render(<QueueItemCard item={{ ...baseItem, status }} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('shows queue position when queued', () => {
    render(<QueueItemCard item={baseItem} position={2} />);

    expect(screen.getByText('第 2 位')).toBeInTheDocument();
  });

  it('does not show queue position when missing', () => {
    render(<QueueItemCard item={baseItem} />);

    expect(screen.queryByText(/第 .* 位/u)).not.toBeInTheDocument();
  });

  it('renders task info when task is provided', () => {
    render(<QueueItemCard item={baseItem} task={baseTask} />);

    expect(screen.getByText(baseTask.title)).toBeInTheDocument();
    expect(screen.getByText('2.5')).toBeInTheDocument();
    expect(screen.getByText('USDT')).toBeInTheDocument();
  });

  it('renders agent info when agent is provided', () => {
    render(<QueueItemCard item={baseItem} agent={baseAgent} />);

    expect(screen.getByText(baseAgent.name)).toBeInTheDocument();
  });

  it('triggers onCancel when cancel button is clicked', () => {
    const handleCancel = vi.fn();
    render(<QueueItemCard item={baseItem} onCancel={handleCancel} />);

    fireEvent.click(screen.getByRole('button', { name: '取消排队' }));

    expect(handleCancel).toHaveBeenCalledWith(baseItem.id);
  });

  it('shows loading state when canceling', () => {
    render(<QueueItemCard item={baseItem} onCancel={() => undefined} isCanceling />);

    const button = screen.getByRole('button', { name: '取消中...' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('does not show cancel button for non-queued status', () => {
    render(
      <QueueItemCard
        item={{ ...baseItem, status: QueueItemStatus.Consumed }}
        onCancel={() => undefined}
      />
    );

    expect(screen.queryByRole('button', { name: '取消排队' })).not.toBeInTheDocument();
  });
});
