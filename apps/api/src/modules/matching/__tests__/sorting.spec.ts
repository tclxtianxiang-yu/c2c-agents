import { AgentStatus } from '@c2c-agents/shared';
import { describe, expect, it } from 'vitest';
import { sortAgents } from '../sorting';

describe('sortAgents', () => {
  it('should prioritize Idle agents over Busy agents', () => {
    const agents = [
      {
        id: '1',
        name: 'Busy Agent',
        status: AgentStatus.Busy,
        avgRating: 5.0,
        completedOrderCount: 100,
        queueSize: 5,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: '2',
        name: 'Idle Agent',
        status: AgentStatus.Idle,
        avgRating: 3.0,
        completedOrderCount: 10,
        queueSize: 0,
        createdAt: '2026-01-10T00:00:00Z',
      },
    ];

    const sorted = sortAgents(agents);

    expect(sorted[0].id).toBe('2'); // Idle 优先
    expect(sorted[1].id).toBe('1');
  });

  it('should sort by avgRating DESC when status is same', () => {
    const agents = [
      {
        id: '1',
        name: 'Agent 1',
        status: AgentStatus.Idle,
        avgRating: 3.5,
        completedOrderCount: 10,
        queueSize: 0,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: '2',
        name: 'Agent 2',
        status: AgentStatus.Idle,
        avgRating: 4.8,
        completedOrderCount: 10,
        queueSize: 0,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: '3',
        name: 'Agent 3',
        status: AgentStatus.Idle,
        avgRating: 4.2,
        completedOrderCount: 10,
        queueSize: 0,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];

    const sorted = sortAgents(agents);

    expect(sorted[0].id).toBe('2'); // 4.8
    expect(sorted[1].id).toBe('3'); // 4.2
    expect(sorted[2].id).toBe('1'); // 3.5
  });

  it('should sort by completedOrderCount DESC when rating is same', () => {
    const agents = [
      {
        id: '1',
        name: 'Agent 1',
        status: AgentStatus.Idle,
        avgRating: 4.5,
        completedOrderCount: 50,
        queueSize: 0,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: '2',
        name: 'Agent 2',
        status: AgentStatus.Idle,
        avgRating: 4.5,
        completedOrderCount: 100,
        queueSize: 0,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: '3',
        name: 'Agent 3',
        status: AgentStatus.Idle,
        avgRating: 4.5,
        completedOrderCount: 20,
        queueSize: 0,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];

    const sorted = sortAgents(agents);

    expect(sorted[0].id).toBe('2'); // 100
    expect(sorted[1].id).toBe('1'); // 50
    expect(sorted[2].id).toBe('3'); // 20
  });

  it('should sort by queueSize ASC when rating and experience are same', () => {
    const agents = [
      {
        id: '1',
        name: 'Agent 1',
        status: AgentStatus.Busy,
        avgRating: 4.5,
        completedOrderCount: 100,
        queueSize: 5,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: '2',
        name: 'Agent 2',
        status: AgentStatus.Busy,
        avgRating: 4.5,
        completedOrderCount: 100,
        queueSize: 2,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: '3',
        name: 'Agent 3',
        status: AgentStatus.Busy,
        avgRating: 4.5,
        completedOrderCount: 100,
        queueSize: 8,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];

    const sorted = sortAgents(agents);

    expect(sorted[0].id).toBe('2'); // queueSize: 2
    expect(sorted[1].id).toBe('1'); // queueSize: 5
    expect(sorted[2].id).toBe('3'); // queueSize: 8
  });

  it('should sort by createdAt ASC when all other factors are equal', () => {
    const agents = [
      {
        id: '1',
        name: 'Agent 1',
        status: AgentStatus.Idle,
        avgRating: 4.5,
        completedOrderCount: 100,
        queueSize: 0,
        createdAt: '2026-01-10T00:00:00Z',
      },
      {
        id: '2',
        name: 'Agent 2',
        status: AgentStatus.Idle,
        avgRating: 4.5,
        completedOrderCount: 100,
        queueSize: 0,
        createdAt: '2026-01-05T00:00:00Z',
      },
      {
        id: '3',
        name: 'Agent 3',
        status: AgentStatus.Idle,
        avgRating: 4.5,
        completedOrderCount: 100,
        queueSize: 0,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];

    const sorted = sortAgents(agents);

    expect(sorted[0].id).toBe('3'); // 2026-01-01 (earliest)
    expect(sorted[1].id).toBe('2'); // 2026-01-05
    expect(sorted[2].id).toBe('1'); // 2026-01-10
  });

  it('should apply all sorting rules in correct order', () => {
    const agents = [
      {
        id: '1',
        name: 'Busy Low Rating',
        status: AgentStatus.Busy,
        avgRating: 3.0,
        completedOrderCount: 50,
        queueSize: 3,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: '2',
        name: 'Idle High Rating',
        status: AgentStatus.Idle,
        avgRating: 4.8,
        completedOrderCount: 80,
        queueSize: 0,
        createdAt: '2026-01-05T00:00:00Z',
      },
      {
        id: '3',
        name: 'Idle Low Rating Old',
        status: AgentStatus.Idle,
        avgRating: 3.5,
        completedOrderCount: 30,
        queueSize: 0,
        createdAt: '2026-01-02T00:00:00Z',
      },
      {
        id: '4',
        name: 'Busy High Rating',
        status: AgentStatus.Busy,
        avgRating: 4.9,
        completedOrderCount: 100,
        queueSize: 5,
        createdAt: '2026-01-03T00:00:00Z',
      },
      {
        id: '5',
        name: 'Idle Medium Rating',
        status: AgentStatus.Idle,
        avgRating: 4.0,
        completedOrderCount: 60,
        queueSize: 0,
        createdAt: '2026-01-04T00:00:00Z',
      },
    ];

    const sorted = sortAgents(agents);

    // Expected order:
    // 1. Idle agents first (2, 3, 5)
    // 2. Among Idle: by avgRating DESC → 2 (4.8), 5 (4.0), 3 (3.5)
    // 3. Then Busy agents (1, 4)
    // 4. Among Busy: by avgRating DESC → 4 (4.9), 1 (3.0)

    expect(sorted[0].id).toBe('2'); // Idle, 4.8 rating
    expect(sorted[1].id).toBe('5'); // Idle, 4.0 rating
    expect(sorted[2].id).toBe('3'); // Idle, 3.5 rating
    expect(sorted[3].id).toBe('4'); // Busy, 4.9 rating
    expect(sorted[4].id).toBe('1'); // Busy, 3.0 rating
  });

  it('should handle Queueing status with lowest priority', () => {
    const agents = [
      {
        id: '1',
        name: 'Queueing Agent',
        status: AgentStatus.Queueing,
        avgRating: 5.0,
        completedOrderCount: 200,
        queueSize: 8,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: '2',
        name: 'Busy Agent',
        status: AgentStatus.Busy,
        avgRating: 3.0,
        completedOrderCount: 10,
        queueSize: 2,
        createdAt: '2026-01-10T00:00:00Z',
      },
      {
        id: '3',
        name: 'Idle Agent',
        status: AgentStatus.Idle,
        avgRating: 2.0,
        completedOrderCount: 5,
        queueSize: 0,
        createdAt: '2026-01-15T00:00:00Z',
      },
    ];

    const sorted = sortAgents(agents);

    expect(sorted[0].id).toBe('3'); // Idle (highest priority)
    expect(sorted[1].id).toBe('2'); // Busy
    expect(sorted[2].id).toBe('1'); // Queueing (lowest priority)
  });

  it('should not mutate original array', () => {
    const agents = [
      {
        id: '1',
        name: 'Agent 1',
        status: AgentStatus.Busy,
        avgRating: 3.0,
        completedOrderCount: 10,
        queueSize: 5,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: '2',
        name: 'Agent 2',
        status: AgentStatus.Idle,
        avgRating: 4.0,
        completedOrderCount: 20,
        queueSize: 0,
        createdAt: '2026-01-02T00:00:00Z',
      },
    ];

    const originalOrder = agents.map((a) => a.id);
    sortAgents(agents);

    expect(agents.map((a) => a.id)).toEqual(originalOrder);
  });
});
