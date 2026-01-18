import type { Agent, QueueItem, Task } from '@c2c-agents/shared';
import { QueueItemStatus } from '@c2c-agents/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { apiFetch } from '@/lib/api';
import { useUserId } from '@/lib/useUserId';

import { QueueList } from '../QueueList';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/lib/useUserId', () => ({
  useUserId: vi.fn(),
}));

const baseItems: QueueItem[] = [
  {
    id: 'queue-item-1',
    agentId: 'agent-1',
    taskId: 'task-1',
    orderId: 'order-1',
    status: QueueItemStatus.Queued,
    createdAt: '2026-01-10T10:00:00.000Z',
    consumedAt: null,
    canceledAt: null,
  },
  {
    id: 'queue-item-2',
    agentId: 'agent-1',
    taskId: 'task-2',
    orderId: 'order-2',
    status: QueueItemStatus.Queued,
    createdAt: '2026-01-09T10:00:00.000Z',
    consumedAt: null,
    canceledAt: null,
  },
];

const baseTasks = new Map<string, Pick<Task, 'id' | 'title' | 'type' | 'expectedReward'>>([
  [
    'task-1',
    {
      id: 'task-1',
      title: '较晚任务',
      type: 'code',
      expectedReward: '1000000',
    },
  ],
  [
    'task-2',
    {
      id: 'task-2',
      title: '更早任务',
      type: 'design',
      expectedReward: '2000000',
    },
  ],
]);

const baseAgents = new Map<string, Pick<Agent, 'id' | 'name' | 'avatarUrl'>>([
  [
    'agent-1',
    {
      id: 'agent-1',
      name: '队列 Agent',
      avatarUrl: null,
    },
  ],
]);

const queueStatusResponse = {
  agentId: 'agent-1',
  queuedCount: 2,
  capacity: 5,
  available: 3,
  items: baseItems,
};

const queueStatusEmpty = {
  agentId: 'agent-1',
  queuedCount: 0,
  capacity: 5,
  available: 5,
  items: [],
};

describe('QueueList', () => {
  it('renders queue items sorted by createdAt with positions', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(queueStatusResponse);
    vi.mocked(useUserId).mockReturnValue({
      userId: 'user-1',
      isConnected: true,
      address: '0x123',
      loading: false,
      error: null,
    });

    render(<QueueList agentId="agent-1" tasks={baseTasks} agents={baseAgents} />);

    expect(await screen.findByText('队列 2/5')).toBeInTheDocument();

    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings[0]).toHaveTextContent('更早任务');
    expect(headings[1]).toHaveTextContent('较晚任务');
    expect(screen.getByText('第 1 位')).toBeInTheDocument();
    expect(screen.getByText('第 2 位')).toBeInTheDocument();
  });

  it('shows empty state when queue has no items', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(queueStatusEmpty);
    vi.mocked(useUserId).mockReturnValue({
      userId: 'user-1',
      isConnected: true,
      address: '0x123',
      loading: false,
      error: null,
    });

    render(<QueueList agentId="agent-1" />);

    expect(await screen.findByText('队列暂无任务')).toBeInTheDocument();
  });

  it('shows loading state while fetching', async () => {
    vi.mocked(apiFetch).mockReturnValueOnce(new Promise(() => undefined));
    vi.mocked(useUserId).mockReturnValue({
      userId: 'user-1',
      isConnected: true,
      address: '0x123',
      loading: false,
      error: null,
    });

    render(<QueueList agentId="agent-1" />);

    expect(await screen.findByText('加载中...')).toBeInTheDocument();
  });

  it('calls cancel API when cancel button is clicked', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(queueStatusResponse)
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce(queueStatusResponse);
    vi.mocked(useUserId).mockReturnValue({
      userId: 'user-1',
      isConnected: true,
      address: '0x123',
      loading: false,
      error: null,
    });

    render(<QueueList agentId="agent-1" tasks={baseTasks} agents={baseAgents} />);

    await screen.findByText('队列 2/5');

    fireEvent.click(screen.getAllByRole('button', { name: '取消排队' })[0]);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenNthCalledWith(2, '/queue/agents/agent-1/orders/order-2', {
        method: 'DELETE',
        headers: {
          'x-user-id': 'user-1',
        },
      });
    });
  });

  it('shows error message when fetching fails', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('加载失败'));
    vi.mocked(useUserId).mockReturnValue({
      userId: 'user-1',
      isConnected: true,
      address: '0x123',
      loading: false,
      error: null,
    });

    render(<QueueList agentId="agent-1" />);

    expect(await screen.findByText('加载失败')).toBeInTheDocument();
  });
});
