/* eslint-disable @typescript-eslint/no-explicit-any */
import { QueueItemStatus } from '@c2c-agents/shared';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { MatchingRepository } from '../matching.repository';

/**
 * Queue Concurrency Tests
 *
 * These unit tests verify the concurrency handling in queue operations:
 * 1. enqueueQueueItem: Uses unique constraint (23505 error) to prevent duplicate entries
 * 2. atomicConsumeQueueItem: Uses RPC with FOR UPDATE SKIP LOCKED for atomic consumption
 *
 * Note: These are unit tests that mock the repository/database layer.
 * The actual database behavior with FOR UPDATE SKIP LOCKED would require integration tests.
 */

// Create mock Supabase service - use any to avoid complex typing issues
const createMockSupabase = (): any => ({
  query: jest.fn(),
  rpc: jest.fn(),
});

describe('Queue Concurrency', () => {
  let repository: MatchingRepository;
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    repository = new MatchingRepository(mockSupabase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('enqueueQueueItem - unique constraint handling', () => {
    const agentId = 'agent-123';
    const taskId = 'task-456';
    const orderId = 'order-789';

    it('should return existing item when unique constraint violation occurs (code 23505)', async () => {
      const existingItem = {
        id: 'item-existing',
        agent_id: agentId,
        task_id: taskId,
        order_id: orderId,
        status: QueueItemStatus.Queued,
        created_at: '2026-01-25T00:00:00Z',
      };

      // First call: simulate unique constraint violation (PostgreSQL error code 23505)
      const insertMockChain = {
        select: jest.fn<any>().mockReturnValue({
          maybeSingle: jest.fn<any>().mockResolvedValue({
            data: null,
            error: { code: '23505', message: 'duplicate key value violates unique constraint' },
          }),
        }),
      };

      // Second call: find existing item (fallback query after 23505)
      const selectMockChain = {
        eq: jest.fn<any>().mockReturnThis(),
        maybeSingle: jest.fn<any>().mockResolvedValue({
          data: existingItem,
          error: null,
        }),
      };

      mockSupabase.query
        .mockReturnValueOnce({
          insert: jest.fn<any>().mockReturnValue(insertMockChain),
        })
        .mockReturnValueOnce({
          select: jest.fn<any>().mockReturnValue(selectMockChain),
        });

      const result = await repository.enqueueQueueItem(agentId, taskId, orderId);

      // Should return the existing item instead of throwing an error
      expect(result).toEqual(existingItem);
      // Verify both queries were made
      expect(mockSupabase.query).toHaveBeenCalledTimes(2);
    });

    it('should return new item when insert succeeds without conflict', async () => {
      const newItem = {
        id: 'item-new',
        agent_id: agentId,
        task_id: taskId,
        order_id: orderId,
        status: QueueItemStatus.Queued,
        created_at: '2026-01-25T00:00:00Z',
      };

      const insertMockChain = {
        select: jest.fn<any>().mockReturnValue({
          maybeSingle: jest.fn<any>().mockResolvedValue({
            data: newItem,
            error: null,
          }),
        }),
      };

      mockSupabase.query.mockReturnValue({
        insert: jest.fn<any>().mockReturnValue(insertMockChain),
      });

      const result = await repository.enqueueQueueItem(agentId, taskId, orderId);

      expect(result).toEqual(newItem);
      // Only one query (insert) should be made
      expect(mockSupabase.query).toHaveBeenCalledTimes(1);
    });

    it('should throw error for non-23505 database errors', async () => {
      const insertMockChain = {
        select: jest.fn<any>().mockReturnValue({
          maybeSingle: jest.fn<any>().mockResolvedValue({
            data: null,
            error: { code: '42P01', message: 'relation "queue_items" does not exist' },
          }),
        }),
      };

      mockSupabase.query.mockReturnValue({
        insert: jest.fn<any>().mockReturnValue(insertMockChain),
      });

      await expect(repository.enqueueQueueItem(agentId, taskId, orderId)).rejects.toThrow(
        'Failed to enqueue queue item'
      );
    });

    it('should handle concurrent enqueue race condition - first request wins', async () => {
      // Simulate scenario: Two concurrent requests try to enqueue the same order
      // Request A: succeeds with insert
      // Request B: gets 23505, falls back to finding existing

      const firstItem = {
        id: 'item-first',
        agent_id: agentId,
        task_id: taskId,
        order_id: orderId,
        status: QueueItemStatus.Queued,
        created_at: '2026-01-25T00:00:00Z',
      };

      // Request A: successful insert
      const insertSuccessMockChain = {
        select: jest.fn<any>().mockReturnValue({
          maybeSingle: jest.fn<any>().mockResolvedValue({
            data: firstItem,
            error: null,
          }),
        }),
      };

      // Request B: 23505 violation, then finds existing
      const insertConflictMockChain = {
        select: jest.fn<any>().mockReturnValue({
          maybeSingle: jest.fn<any>().mockResolvedValue({
            data: null,
            error: { code: '23505', message: 'duplicate key' },
          }),
        }),
      };

      const selectExistingMockChain = {
        eq: jest.fn<any>().mockReturnThis(),
        maybeSingle: jest.fn<any>().mockResolvedValue({
          data: firstItem,
          error: null,
        }),
      };

      // Simulate Request A
      mockSupabase.query.mockReturnValueOnce({
        insert: jest.fn<any>().mockReturnValue(insertSuccessMockChain),
      });

      const resultA = await repository.enqueueQueueItem(agentId, taskId, orderId);

      // Reset and simulate Request B
      mockSupabase.query
        .mockReturnValueOnce({
          insert: jest.fn<any>().mockReturnValue(insertConflictMockChain),
        })
        .mockReturnValueOnce({
          select: jest.fn<any>().mockReturnValue(selectExistingMockChain),
        });

      const resultB = await repository.enqueueQueueItem(agentId, taskId, orderId);

      // Both should return the same item (idempotent behavior)
      expect(resultA).toEqual(firstItem);
      expect(resultB).toEqual(firstItem);
      expect(resultA?.id).toBe(resultB?.id);
    });
  });

  describe('atomicConsumeQueueItem - RPC behavior', () => {
    const agentId = 'agent-123';

    it('should return consumed item when RPC succeeds', async () => {
      const consumedItem = {
        id: 'item-1',
        agent_id: agentId,
        task_id: 'task-456',
        order_id: 'order-789',
        status: 'consumed',
        created_at: '2026-01-25T00:00:00Z',
        consumed_at: '2026-01-25T01:00:00Z',
      };

      mockSupabase.rpc.mockResolvedValue({
        data: [consumedItem],
        error: null,
      });

      const result = await repository.atomicConsumeQueueItem(agentId);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('consume_next_queue_item', {
        p_agent_id: agentId,
      });
      expect(result).toMatchObject({
        id: consumedItem.id,
        agent_id: consumedItem.agent_id,
        task_id: consumedItem.task_id,
        order_id: consumedItem.order_id,
        status: QueueItemStatus.Consumed,
        created_at: consumedItem.created_at,
        consumed_at: consumedItem.consumed_at,
      });
    });

    it('should return null when queue is empty (no items to consume)', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await repository.atomicConsumeQueueItem(agentId);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('consume_next_queue_item', {
        p_agent_id: agentId,
      });
      expect(result).toBeNull();
    });

    it('should return null when RPC returns null data', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await repository.atomicConsumeQueueItem(agentId);

      expect(result).toBeNull();
    });

    it('should return null and log warning on RPC error', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC function failed', code: 'PGRST202' },
      });

      const result = await repository.atomicConsumeQueueItem(agentId);

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Failed to consume queue item for agent ${agentId}`),
        expect.any(Object)
      );

      consoleWarnSpy.mockRestore();
    });

    it('should handle concurrent consume - only first caller gets the item (SKIP LOCKED simulation)', async () => {
      // Simulate FOR UPDATE SKIP LOCKED behavior:
      // Multiple concurrent requests try to consume from the same queue
      // Only the first one gets the item, others get empty result

      const queueItem = {
        id: 'item-1',
        agent_id: agentId,
        task_id: 'task-456',
        order_id: 'order-789',
        status: 'consumed',
        created_at: '2026-01-25T00:00:00Z',
        consumed_at: '2026-01-25T01:00:00Z',
      };

      // First concurrent call: gets the item
      mockSupabase.rpc
        .mockResolvedValueOnce({
          data: [queueItem],
          error: null,
        })
        // Second concurrent call: item already locked/consumed, gets empty
        .mockResolvedValueOnce({
          data: [],
          error: null,
        })
        // Third concurrent call: also gets empty
        .mockResolvedValueOnce({
          data: [],
          error: null,
        });

      // Simulate concurrent calls
      const [result1, result2, result3] = await Promise.all([
        repository.atomicConsumeQueueItem(agentId),
        repository.atomicConsumeQueueItem(agentId),
        repository.atomicConsumeQueueItem(agentId),
      ]);

      // Only one result should have the item
      const successResults = [result1, result2, result3].filter((r) => r !== null);
      expect(successResults).toHaveLength(1);
      expect(successResults[0]?.id).toBe(queueItem.id);

      // RPC should be called 3 times
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(3);
    });

    it('should handle FIFO ordering - returns earliest queued item', async () => {
      // The RPC function should return items in FIFO order (ORDER BY created_at ASC)
      const earliestItem = {
        id: 'item-oldest',
        agent_id: agentId,
        task_id: 'task-001',
        order_id: 'order-001',
        status: 'consumed',
        created_at: '2026-01-25T00:00:00Z', // Oldest
        consumed_at: '2026-01-25T02:00:00Z',
      };

      mockSupabase.rpc.mockResolvedValue({
        data: [earliestItem],
        error: null,
      });

      const result = await repository.atomicConsumeQueueItem(agentId);

      expect(result?.id).toBe('item-oldest');
      expect(result?.created_at).toBe('2026-01-25T00:00:00Z');
    });
  });

  describe('idempotency guarantees', () => {
    it('enqueue should be idempotent - multiple calls return same result', async () => {
      const agentId = 'agent-123';
      const taskId = 'task-456';
      const orderId = 'order-789';

      const existingItem = {
        id: 'item-1',
        agent_id: agentId,
        task_id: taskId,
        order_id: orderId,
        status: QueueItemStatus.Queued,
        created_at: '2026-01-25T00:00:00Z',
      };

      // First call: insert succeeds
      const insertSuccessMockChain = {
        select: jest.fn<any>().mockReturnValue({
          maybeSingle: jest.fn<any>().mockResolvedValue({
            data: existingItem,
            error: null,
          }),
        }),
      };

      mockSupabase.query.mockReturnValue({
        insert: jest.fn<any>().mockReturnValue(insertSuccessMockChain),
      });

      const result1 = await repository.enqueueQueueItem(agentId, taskId, orderId);

      // Reset mock for second call: insert fails with 23505
      const insertConflictMockChain = {
        select: jest.fn<any>().mockReturnValue({
          maybeSingle: jest.fn<any>().mockResolvedValue({
            data: null,
            error: { code: '23505', message: 'duplicate key' },
          }),
        }),
      };

      const selectExistingMockChain = {
        eq: jest.fn<any>().mockReturnThis(),
        maybeSingle: jest.fn<any>().mockResolvedValue({
          data: existingItem,
          error: null,
        }),
      };

      mockSupabase.query
        .mockReturnValueOnce({
          insert: jest.fn<any>().mockReturnValue(insertConflictMockChain),
        })
        .mockReturnValueOnce({
          select: jest.fn<any>().mockReturnValue(selectExistingMockChain),
        });

      const result2 = await repository.enqueueQueueItem(agentId, taskId, orderId);

      // Both results should be equal (idempotent)
      expect(result1).toEqual(result2);
    });

    it('consume is NOT idempotent - once consumed, item is gone', async () => {
      const agentId = 'agent-123';

      const queueItem = {
        id: 'item-1',
        agent_id: agentId,
        task_id: 'task-456',
        order_id: 'order-789',
        status: 'consumed',
        created_at: '2026-01-25T00:00:00Z',
        consumed_at: '2026-01-25T01:00:00Z',
      };

      // First call: gets the item
      mockSupabase.rpc
        .mockResolvedValueOnce({
          data: [queueItem],
          error: null,
        })
        // Second call: item already consumed, queue empty
        .mockResolvedValueOnce({
          data: [],
          error: null,
        });

      const result1 = await repository.atomicConsumeQueueItem(agentId);
      const result2 = await repository.atomicConsumeQueueItem(agentId);

      // First call succeeds, second returns null (not idempotent)
      expect(result1).not.toBeNull();
      expect(result2).toBeNull();
    });
  });
});
