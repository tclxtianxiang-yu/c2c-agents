import { AgentStatus, OrderStatus } from '@c2c-agents/shared';

import type { MatchingRepository } from '../matching.repository';
import type { PairingService } from '../pairing.service';
import { QueueService } from '../queue.service';

describe('QueueService', () => {
  let service: QueueService;
  let mockRepository: MatchingRepository;
  let mockPairingService: PairingService;

  beforeEach(() => {
    // Mock MatchingRepository
    mockRepository = {
      findAgentById: jest.fn(),
      getInProgressOrderCount: jest.fn(),
      atomicConsumeQueueItem: jest.fn(),
      findOrderById: jest.fn(),
      updateAgentStatus: jest.fn(),
    } as unknown as MatchingRepository;

    // Mock PairingService
    mockPairingService = {
      createPairing: jest.fn(),
    } as unknown as PairingService;

    service = new QueueService(mockRepository, mockPairingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('consumeNext', () => {
    it('should consume queue item and create pairing successfully', async () => {
      const agentId = 'agent-1';
      const orderId = 'order-1';
      const queueItemId = 'queue-item-1';

      const mockAgent = {
        id: agentId,
        owner_id: 'provider-1',
        name: 'Test Agent',
        status: AgentStatus.Idle,
        queue_size: 2,
      };

      const mockQueueItem = {
        id: queueItemId,
        agent_id: agentId,
        order_id: orderId,
        status: 'Consumed',
        created_at: new Date().toISOString(),
      };

      const mockOrder = {
        id: orderId,
        task_id: 'task-1',
        status: OrderStatus.Standby,
        creator_id: 'user-1',
      };

      const mockPairingInfo = {
        orderId,
        agentId,
        providerId: 'provider-1',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        pairingCreatedAt: new Date().toISOString(),
      };

      (mockRepository.findAgentById as jest.Mock).mockResolvedValue(mockAgent as any);
      (mockRepository.getInProgressOrderCount as jest.Mock).mockResolvedValue(0);
      (mockRepository.atomicConsumeQueueItem as jest.Mock).mockResolvedValue(mockQueueItem as any);
      (mockRepository.findOrderById as jest.Mock).mockResolvedValue(mockOrder as any);
      (mockPairingService.createPairing as jest.Mock).mockResolvedValue(mockPairingInfo as any);
      (mockRepository.updateAgentStatus as jest.Mock).mockResolvedValue(undefined);

      const result = await service.consumeNext(agentId);

      expect(result.consumed).toBe(true);
      expect(result.orderId).toBe(orderId);
      expect(result.pairingInfo).toEqual(mockPairingInfo);

      // Verify repository calls
      expect(mockRepository.findAgentById).toHaveBeenCalledWith(agentId);
      expect(mockRepository.getInProgressOrderCount).toHaveBeenCalledWith(agentId);
      expect(mockRepository.atomicConsumeQueueItem).toHaveBeenCalledWith(agentId);
      expect(mockRepository.findOrderById).toHaveBeenCalledWith(orderId);
      expect(mockPairingService.createPairing).toHaveBeenCalledWith(orderId, agentId);
      expect(mockRepository.updateAgentStatus).toHaveBeenCalledWith(
        agentId,
        AgentStatus.Idle,
        null
      );
    });

    it('should return consumed: false if agent not found', async () => {
      (mockRepository.findAgentById as jest.Mock).mockResolvedValue(null);

      const result = await service.consumeNext('non-existent-agent');

      expect(result.consumed).toBe(false);
      expect(result.orderId).toBeUndefined();
      expect(result.pairingInfo).toBeUndefined();

      // Should not proceed to consume queue
      expect(mockRepository.atomicConsumeQueueItem).not.toHaveBeenCalled();
    });

    it('should return consumed: false if agent has in-progress orders', async () => {
      const agentId = 'agent-1';

      const mockAgent = {
        id: agentId,
        status: AgentStatus.Busy,
      };

      (mockRepository.findAgentById as jest.Mock).mockResolvedValue(mockAgent as any);
      (mockRepository.getInProgressOrderCount as jest.Mock).mockResolvedValue(1);

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        /* noop */
      });

      const result = await service.consumeNext(agentId);

      expect(result.consumed).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('still has 1 in-progress orders')
      );

      // Should not proceed to consume queue
      expect(mockRepository.atomicConsumeQueueItem).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should return consumed: false if queue is empty', async () => {
      const agentId = 'agent-1';

      const mockAgent = {
        id: agentId,
        status: AgentStatus.Idle,
      };

      (mockRepository.findAgentById as jest.Mock).mockResolvedValue(mockAgent as any);
      (mockRepository.getInProgressOrderCount as jest.Mock).mockResolvedValue(0);
      (mockRepository.atomicConsumeQueueItem as jest.Mock).mockResolvedValue(null);

      const result = await service.consumeNext(agentId);

      expect(result.consumed).toBe(false);
      expect(mockRepository.atomicConsumeQueueItem).toHaveBeenCalledWith(agentId);
    });

    it('should return consumed: false if order not found', async () => {
      const agentId = 'agent-1';

      const mockAgent = {
        id: agentId,
        status: AgentStatus.Idle,
      };

      const mockQueueItem = {
        id: 'queue-item-1',
        order_id: 'order-1',
      };

      (mockRepository.findAgentById as jest.Mock).mockResolvedValue(mockAgent as any);
      (mockRepository.getInProgressOrderCount as jest.Mock).mockResolvedValue(0);
      (mockRepository.atomicConsumeQueueItem as jest.Mock).mockResolvedValue(mockQueueItem as any);
      (mockRepository.findOrderById as jest.Mock).mockResolvedValue(null);

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        /* noop */
      });

      const result = await service.consumeNext(agentId);

      expect(result.consumed).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Order order-1 not found')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should return consumed: false if order is not in Standby status', async () => {
      const agentId = 'agent-1';

      const mockAgent = {
        id: agentId,
        status: AgentStatus.Idle,
      };

      const mockQueueItem = {
        id: 'queue-item-1',
        order_id: 'order-1',
      };

      const mockOrder = {
        id: 'order-1',
        status: OrderStatus.InProgress,
      };

      (mockRepository.findAgentById as jest.Mock).mockResolvedValue(mockAgent as any);
      (mockRepository.getInProgressOrderCount as jest.Mock).mockResolvedValue(0);
      (mockRepository.atomicConsumeQueueItem as jest.Mock).mockResolvedValue(mockQueueItem as any);
      (mockRepository.findOrderById as jest.Mock).mockResolvedValue(mockOrder as any);

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        /* noop */
      });

      const result = await service.consumeNext(agentId);

      expect(result.consumed).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('is not in Standby status')
      );

      // Should not create pairing
      expect(mockPairingService.createPairing).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should handle FIFO order correctly', async () => {
      // This test verifies that atomicConsumeQueueItem is called,
      // which should return the first queued item in FIFO order
      const agentId = 'agent-1';

      const mockAgent = {
        id: agentId,
        status: AgentStatus.Idle,
      };

      const firstQueueItem = {
        id: 'queue-item-1',
        order_id: 'order-1',
        created_at: '2026-01-01T00:00:00Z',
      };

      const mockOrder = {
        id: 'order-1',
        status: OrderStatus.Standby,
      };

      const mockPairingInfo = {
        orderId: 'order-1',
        agentId,
        providerId: 'provider-1',
        expiresAt: new Date().toISOString(),
        pairingCreatedAt: new Date().toISOString(),
      };

      (mockRepository.findAgentById as jest.Mock).mockResolvedValue(mockAgent as any);
      (mockRepository.getInProgressOrderCount as jest.Mock).mockResolvedValue(0);
      (mockRepository.atomicConsumeQueueItem as jest.Mock).mockResolvedValue(firstQueueItem as any);
      (mockRepository.findOrderById as jest.Mock).mockResolvedValue(mockOrder as any);
      (mockPairingService.createPairing as jest.Mock).mockResolvedValue(mockPairingInfo as any);
      (mockRepository.updateAgentStatus as jest.Mock).mockResolvedValue(undefined);

      const result = await service.consumeNext(agentId);

      expect(result.consumed).toBe(true);
      expect(result.orderId).toBe('order-1');
      // The repository's atomicConsumeQueueItem should handle FIFO ordering
      expect(mockRepository.atomicConsumeQueueItem).toHaveBeenCalledWith(agentId);
    });
  });

  describe('consumeBatch', () => {
    it('should consume multiple queue items successfully', async () => {
      const agentId = 'agent-1';
      const maxCount = 3;

      const mockAgent = {
        id: agentId,
        status: AgentStatus.Idle,
      };

      const mockQueueItem1 = {
        id: 'queue-item-1',
        order_id: 'order-1',
      };

      const mockQueueItem2 = {
        id: 'queue-item-2',
        order_id: 'order-2',
      };

      const mockOrder1 = {
        id: 'order-1',
        status: OrderStatus.Standby,
      };

      const mockOrder2 = {
        id: 'order-2',
        status: OrderStatus.Standby,
      };

      const mockPairingInfo1 = {
        orderId: 'order-1',
        agentId,
        providerId: 'provider-1',
        expiresAt: new Date().toISOString(),
        pairingCreatedAt: new Date().toISOString(),
      };

      const mockPairingInfo2 = {
        orderId: 'order-2',
        agentId,
        providerId: 'provider-1',
        expiresAt: new Date().toISOString(),
        pairingCreatedAt: new Date().toISOString(),
      };

      (mockRepository.findAgentById as jest.Mock).mockResolvedValue(mockAgent as any);
      (mockRepository.getInProgressOrderCount as jest.Mock).mockResolvedValue(0);

      // Mock sequence: consume 2 items, then empty queue
      (mockRepository.atomicConsumeQueueItem as jest.Mock)
        .mockResolvedValueOnce(mockQueueItem1 as any)
        .mockResolvedValueOnce(mockQueueItem2 as any)
        .mockResolvedValueOnce(null);

      (mockRepository.findOrderById as jest.Mock)
        .mockResolvedValueOnce(mockOrder1 as any)
        .mockResolvedValueOnce(mockOrder2 as any);

      (mockPairingService.createPairing as jest.Mock)
        .mockResolvedValueOnce(mockPairingInfo1 as any)
        .mockResolvedValueOnce(mockPairingInfo2 as any);

      (mockRepository.updateAgentStatus as jest.Mock).mockResolvedValue(undefined);

      const results = await service.consumeBatch(agentId, maxCount);

      expect(results).toHaveLength(2);
      expect(results[0].consumed).toBe(true);
      expect(results[0].orderId).toBe('order-1');
      expect(results[1].consumed).toBe(true);
      expect(results[1].orderId).toBe('order-2');

      // Should stop when queue is empty (3rd call returns null)
      expect(mockRepository.atomicConsumeQueueItem).toHaveBeenCalledTimes(3);
    });

    it('should stop consuming when maxCount is reached', async () => {
      const agentId = 'agent-1';
      const maxCount = 2;

      const mockAgent = {
        id: agentId,
        status: AgentStatus.Idle,
      };

      const mockQueueItem = {
        id: 'queue-item-1',
        order_id: 'order-1',
      };

      const mockOrder = {
        id: 'order-1',
        status: OrderStatus.Standby,
      };

      const mockPairingInfo = {
        orderId: 'order-1',
        agentId,
        providerId: 'provider-1',
        expiresAt: new Date().toISOString(),
        pairingCreatedAt: new Date().toISOString(),
      };

      (mockRepository.findAgentById as jest.Mock).mockResolvedValue(mockAgent as any);
      (mockRepository.getInProgressOrderCount as jest.Mock).mockResolvedValue(0);
      (mockRepository.atomicConsumeQueueItem as jest.Mock).mockResolvedValue(mockQueueItem as any);
      (mockRepository.findOrderById as jest.Mock).mockResolvedValue(mockOrder as any);
      (mockPairingService.createPairing as jest.Mock).mockResolvedValue(mockPairingInfo as any);
      (mockRepository.updateAgentStatus as jest.Mock).mockResolvedValue(undefined);

      const results = await service.consumeBatch(agentId, maxCount);

      expect(results).toHaveLength(2);
      expect(mockRepository.atomicConsumeQueueItem).toHaveBeenCalledTimes(2);
    });

    it('should return empty array if first consume fails', async () => {
      const agentId = 'agent-1';

      const mockAgent = {
        id: agentId,
        status: AgentStatus.Busy,
      };

      (mockRepository.findAgentById as jest.Mock).mockResolvedValue(mockAgent as any);
      (mockRepository.getInProgressOrderCount as jest.Mock).mockResolvedValue(1);

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        /* noop */
      });

      const results = await service.consumeBatch(agentId, 3);

      expect(results).toHaveLength(0);

      consoleWarnSpy.mockRestore();
    });

    it('should handle zero maxCount gracefully', async () => {
      const results = await service.consumeBatch('agent-1', 0);

      expect(results).toHaveLength(0);
      expect(mockRepository.findAgentById).not.toHaveBeenCalled();
    });

    it('should handle partial success in batch', async () => {
      const agentId = 'agent-1';

      const mockAgent = {
        id: agentId,
        status: AgentStatus.Idle,
      };

      const mockQueueItem1 = {
        id: 'queue-item-1',
        order_id: 'order-1',
      };

      const mockOrder1 = {
        id: 'order-1',
        status: OrderStatus.Standby,
      };

      const mockPairingInfo = {
        orderId: 'order-1',
        agentId,
        providerId: 'provider-1',
        expiresAt: new Date().toISOString(),
        pairingCreatedAt: new Date().toISOString(),
      };

      (mockRepository.findAgentById as jest.Mock).mockResolvedValue(mockAgent as any);
      (mockRepository.getInProgressOrderCount as jest.Mock).mockResolvedValue(0);

      // First consume succeeds, second returns null (queue empty)
      (mockRepository.atomicConsumeQueueItem as jest.Mock)
        .mockResolvedValueOnce(mockQueueItem1 as any)
        .mockResolvedValueOnce(null);

      (mockRepository.findOrderById as jest.Mock).mockResolvedValue(mockOrder1 as any);
      (mockPairingService.createPairing as jest.Mock).mockResolvedValue(mockPairingInfo as any);
      (mockRepository.updateAgentStatus as jest.Mock).mockResolvedValue(undefined);

      const results = await service.consumeBatch(agentId, 5);

      expect(results).toHaveLength(1);
      expect(results[0].consumed).toBe(true);
    });
  });

  describe('concurrent consumption safety', () => {
    it('should handle concurrent consume attempts gracefully', async () => {
      // This test simulates concurrent consumption by having
      // atomicConsumeQueueItem return null (item already consumed by another process)
      const agentId = 'agent-1';

      const mockAgent = {
        id: agentId,
        status: AgentStatus.Idle,
      };

      (mockRepository.findAgentById as jest.Mock).mockResolvedValue(mockAgent as any);
      (mockRepository.getInProgressOrderCount as jest.Mock).mockResolvedValue(0);
      (mockRepository.atomicConsumeQueueItem as jest.Mock).mockResolvedValue(null);

      const result = await service.consumeNext(agentId);

      expect(result.consumed).toBe(false);
      // atomicConsumeQueueItem handles concurrency internally
      expect(mockRepository.atomicConsumeQueueItem).toHaveBeenCalledWith(agentId);
    });
  });
});
