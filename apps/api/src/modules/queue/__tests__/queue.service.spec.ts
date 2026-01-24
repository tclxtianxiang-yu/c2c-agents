import { QUEUE_MAX_N } from '@c2c-agents/config/constants';
import { QueueItemStatus } from '@c2c-agents/shared';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { AgentRepository } from '../../agent/agent.repository';
import { QueueRepository } from '../queue.repository';
import { QueueService } from '../queue.service';

describe('QueueService', () => {
  let service: QueueService;

  const mockQueueRepository = {
    getQueuedCount: jest.fn(),
    enqueue: jest.fn(),
    consumeNext: jest.fn(),
    cancel: jest.fn(),
    getQueuedItems: jest.fn(),
    getQueuePosition: jest.fn(),
    isInQueue: jest.fn(),
  };

  const mockAgentRepository = {
    updateAgent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: QueueRepository,
          useValue: mockQueueRepository,
        },
        {
          provide: AgentRepository,
          useValue: mockAgentRepository,
        },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);

    jest.clearAllMocks();
  });

  describe('enqueue', () => {
    const enqueueParams = {
      agentId: 'agent-1',
      taskId: 'task-1',
      orderId: 'order-1',
    };

    const mockQueueItem = {
      id: 'queue-1',
      agentId: 'agent-1',
      taskId: 'task-1',
      orderId: 'order-1',
      status: QueueItemStatus.Queued,
      createdAt: '2026-01-15T00:00:00.000Z',
      consumedAt: null,
      canceledAt: null,
    };

    it('should enqueue successfully', async () => {
      mockQueueRepository.getQueuedCount.mockResolvedValue(5);
      mockQueueRepository.enqueue.mockResolvedValue(mockQueueItem);
      mockAgentRepository.updateAgent.mockResolvedValue({});

      const result = await service.enqueue(enqueueParams);

      expect(result).toEqual(mockQueueItem);
      expect(mockQueueRepository.getQueuedCount).toHaveBeenCalledWith('agent-1');
      expect(mockQueueRepository.enqueue).toHaveBeenCalledWith(enqueueParams);
      expect(mockAgentRepository.updateAgent).toHaveBeenCalledWith('agent-1', { queueSize: 5 });
    });

    it('should throw 400 if queue is full', async () => {
      mockQueueRepository.getQueuedCount.mockResolvedValue(QUEUE_MAX_N);

      await expect(service.enqueue(enqueueParams)).rejects.toThrow(/Queue is full/);
      expect(mockQueueRepository.enqueue).not.toHaveBeenCalled();
    });

    it('should throw 409 if already in queue', async () => {
      mockQueueRepository.getQueuedCount.mockResolvedValue(5);
      mockQueueRepository.enqueue.mockResolvedValue(null);

      await expect(service.enqueue(enqueueParams)).rejects.toThrow(/already in queue/);
    });

    it('should update queue_size after enqueue', async () => {
      mockQueueRepository.getQueuedCount.mockResolvedValue(5);
      mockQueueRepository.enqueue.mockResolvedValue(mockQueueItem);
      mockAgentRepository.updateAgent.mockResolvedValue({});

      await service.enqueue(enqueueParams);

      expect(mockAgentRepository.updateAgent).toHaveBeenCalledWith('agent-1', { queueSize: 5 });
    });
  });

  describe('consumeNext', () => {
    const mockQueueItem = {
      id: 'queue-1',
      agentId: 'agent-1',
      taskId: 'task-1',
      orderId: 'order-1',
      status: QueueItemStatus.Consumed,
      createdAt: '2026-01-15T00:00:00.000Z',
      consumedAt: '2026-01-15T01:00:00.000Z',
      canceledAt: null,
    };

    it('should consume earliest queue item', async () => {
      mockQueueRepository.consumeNext.mockResolvedValue(mockQueueItem);
      mockQueueRepository.getQueuedCount.mockResolvedValue(2);
      mockAgentRepository.updateAgent.mockResolvedValue({});

      const result = await service.consumeNext('agent-1');

      expect(result).toEqual(mockQueueItem);
      expect(mockQueueRepository.consumeNext).toHaveBeenCalledWith('agent-1');
      expect(mockAgentRepository.updateAgent).toHaveBeenCalledWith('agent-1', { queueSize: 2 });
    });

    it('should return null if queue is empty', async () => {
      mockQueueRepository.consumeNext.mockResolvedValue(null);

      const result = await service.consumeNext('agent-1');

      expect(result).toBeNull();
      expect(mockAgentRepository.updateAgent).not.toHaveBeenCalled();
    });

    it('should update queue_size after consume', async () => {
      mockQueueRepository.consumeNext.mockResolvedValue(mockQueueItem);
      mockQueueRepository.getQueuedCount.mockResolvedValue(1);
      mockAgentRepository.updateAgent.mockResolvedValue({});

      await service.consumeNext('agent-1');

      expect(mockAgentRepository.updateAgent).toHaveBeenCalledWith('agent-1', { queueSize: 1 });
    });
  });

  describe('cancel', () => {
    it('should cancel queue item successfully', async () => {
      mockQueueRepository.cancel.mockResolvedValue(undefined);
      mockQueueRepository.getQueuedCount.mockResolvedValue(2);
      mockAgentRepository.updateAgent.mockResolvedValue({});

      await service.cancel('agent-1', 'order-1');

      expect(mockQueueRepository.cancel).toHaveBeenCalledWith('agent-1', 'order-1');
      expect(mockAgentRepository.updateAgent).toHaveBeenCalledWith('agent-1', { queueSize: 2 });
    });

    it('should be idempotent (cancel non-existent item does not throw)', async () => {
      mockQueueRepository.cancel.mockResolvedValue(undefined);
      mockQueueRepository.getQueuedCount.mockResolvedValue(3);
      mockAgentRepository.updateAgent.mockResolvedValue({});

      await expect(service.cancel('agent-1', 'order-999')).resolves.not.toThrow();
    });

    it('should update queue_size after cancel', async () => {
      mockQueueRepository.cancel.mockResolvedValue(undefined);
      mockQueueRepository.getQueuedCount.mockResolvedValue(1);
      mockAgentRepository.updateAgent.mockResolvedValue({});

      await service.cancel('agent-1', 'order-1');

      expect(mockAgentRepository.updateAgent).toHaveBeenCalledWith('agent-1', { queueSize: 1 });
    });
  });

  describe('getQueueStatus', () => {
    const mockQueueItems = [
      {
        id: 'queue-1',
        agentId: 'agent-1',
        taskId: 'task-1',
        orderId: 'order-1',
        status: QueueItemStatus.Queued,
        createdAt: '2026-01-15T00:00:00.000Z',
        consumedAt: null,
        canceledAt: null,
      },
      {
        id: 'queue-2',
        agentId: 'agent-1',
        taskId: 'task-2',
        orderId: 'order-2',
        status: QueueItemStatus.Queued,
        createdAt: '2026-01-15T01:00:00.000Z',
        consumedAt: null,
        canceledAt: null,
      },
    ];

    it('should return queue status with correct counts', async () => {
      mockQueueRepository.getQueuedItems.mockResolvedValue(mockQueueItems);

      const result = await service.getQueueStatus('agent-1');

      expect(result).toEqual({
        agentId: 'agent-1',
        queuedCount: 2,
        capacity: QUEUE_MAX_N,
        available: QUEUE_MAX_N - 2,
        items: mockQueueItems,
      });
    });

    it('should return items sorted by created_at ascending', async () => {
      mockQueueRepository.getQueuedItems.mockResolvedValue(mockQueueItems);

      const result = await service.getQueueStatus('agent-1');

      expect(result.items).toEqual(mockQueueItems);
      expect(result.items[0].createdAt).toBeLessThan(result.items[1].createdAt);
    });
  });

  describe('getQueuePosition', () => {
    it('should return 1-based position', async () => {
      mockQueueRepository.getQueuePosition.mockResolvedValue(3);

      const position = await service.getQueuePosition('agent-1', 'order-3');

      expect(position).toBe(3);
    });

    it('should return null if not in queue', async () => {
      mockQueueRepository.getQueuePosition.mockResolvedValue(null);

      const position = await service.getQueuePosition('agent-1', 'order-999');

      expect(position).toBeNull();
    });
  });

  describe('isInQueue', () => {
    it('should return true if in queue', async () => {
      mockQueueRepository.isInQueue.mockResolvedValue(true);

      const result = await service.isInQueue('agent-1', 'order-1');

      expect(result).toBe(true);
    });

    it('should return false if not in queue', async () => {
      mockQueueRepository.isInQueue.mockResolvedValue(false);

      const result = await service.isInQueue('agent-1', 'order-999');

      expect(result).toBe(false);
    });
  });
});
