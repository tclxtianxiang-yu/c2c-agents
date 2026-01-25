import { QUEUE_MAX_N } from '@c2c-agents/config/constants';
import {
  AgentStatus,
  assertTransition,
  OrderStatus,
  QueueItemStatus,
  TaskStatus,
  ValidationError,
} from '@c2c-agents/shared';
import { HttpException } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { ExecutionRepository } from '../../execution/execution.repository';
import { MastraService } from '../../mastra/mastra.service';
import { MatchingRepository } from '../matching.repository';
import { MatchingService } from '../matching.service';

describe('MatchingService', () => {
  let service: MatchingService;

  const testUserId = '11111111-1111-4111-8111-111111111111';
  const mockTask = {
    id: 'task-1',
    creator_id: testUserId,
    type: 'writing',
    expected_reward: '5000000',
    status: TaskStatus.Published,
    current_order_id: 'order-1',
    current_status: OrderStatus.Standby,
  };

  const mockOrder = {
    id: 'order-1',
    task_id: 'task-1',
    creator_id: testUserId,
    provider_id: null,
    agent_id: null,
    status: OrderStatus.Standby,
    pairing_created_at: null,
  };

  const mockIdleAgent = {
    id: 'agent-1',
    owner_id: 'provider-1',
    name: 'Test Idle Agent',
    description: 'Test description',
    tags: ['test'],
    supported_task_types: ['writing'],
    min_price: '1000000',
    max_price: '10000000',
    status: AgentStatus.Idle,
    avg_rating: 4.5,
    completed_order_count: 10,
    is_listed: true,
  };

  const mockBusyAgent = {
    ...mockIdleAgent,
    id: 'agent-2',
    name: 'Test Busy Agent',
    status: AgentStatus.Busy,
  };

  const mockRepository = {
    findTaskById: jest.fn(),
    findOrderById: jest.fn(),
    findAgentById: jest.fn(),
    listCandidateAgents: jest.fn(),
    getQueueCount: jest.fn(),
    getInProgressOrderCount: jest.fn(),
    findQueuedItem: jest.fn(),
    enqueueQueueItem: jest.fn(),
    listQueuedItems: jest.fn(),
    updateOrderPairing: jest.fn(),
    updateTaskCurrentStatus: jest.fn(),
    findActiveUserIdByAddress: jest.fn(),
  };

  const expectHttpStatus = async (promise: Promise<unknown>, status: number) => {
    try {
      await promise;
      throw new Error('Expected error');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(status);
    }
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchingService,
        {
          provide: MatchingRepository,
          useValue: mockRepository,
        },
        {
          provide: ExecutionRepository,
          useValue: {},
        },
        {
          provide: MastraService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<MatchingService>(MatchingService);

    jest.clearAllMocks();
  });

  describe('autoMatch', () => {
    it('should create pairing for idle agent', async () => {
      mockRepository.findTaskById.mockResolvedValue(mockTask);
      mockRepository.findOrderById.mockResolvedValue(mockOrder);
      mockRepository.listCandidateAgents.mockResolvedValue([mockIdleAgent]);
      mockRepository.getQueueCount.mockResolvedValue(0);
      mockRepository.updateOrderPairing.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.Pairing,
      });
      mockRepository.updateTaskCurrentStatus.mockResolvedValue(undefined);

      const result = await service.autoMatchLegacy(testUserId, mockTask.id);

      expect(result).toEqual({
        result: 'pairing',
        orderId: mockOrder.id,
        agentId: mockIdleAgent.id,
        providerId: mockIdleAgent.owner_id,
        status: OrderStatus.Pairing,
      });
      expect(mockRepository.updateOrderPairing).toHaveBeenCalledWith(
        mockOrder.id,
        mockIdleAgent.id,
        mockIdleAgent.owner_id,
        expect.any(String)
      );
      expect(mockRepository.updateTaskCurrentStatus).toHaveBeenCalledWith(
        mockTask.id,
        OrderStatus.Pairing
      );
    });

    it('should enqueue busy agent and return queued result', async () => {
      mockRepository.findTaskById.mockResolvedValue(mockTask);
      mockRepository.findOrderById.mockResolvedValue(mockOrder);
      mockRepository.listCandidateAgents.mockResolvedValue([mockBusyAgent]);
      mockRepository.getQueueCount.mockResolvedValue(0);
      mockRepository.findQueuedItem.mockResolvedValue(null);
      mockRepository.enqueueQueueItem.mockResolvedValue({
        id: 'queue-1',
        agent_id: mockBusyAgent.id,
        order_id: mockOrder.id,
        status: QueueItemStatus.Queued,
        created_at: new Date().toISOString(),
      });
      mockRepository.listQueuedItems.mockResolvedValue([
        {
          id: 'queue-1',
          agent_id: mockBusyAgent.id,
          order_id: mockOrder.id,
          status: QueueItemStatus.Queued,
          created_at: new Date().toISOString(),
        },
      ]);

      const result = await service.autoMatchLegacy(testUserId, mockTask.id);

      expect(result).toEqual({
        result: 'queued',
        orderId: mockOrder.id,
        agentId: mockBusyAgent.id,
        status: OrderStatus.Standby,
        queuePosition: 1,
        queuedCount: 1,
        capacity: QUEUE_MAX_N,
      });
      expect(mockRepository.enqueueQueueItem).toHaveBeenCalledWith(
        mockBusyAgent.id,
        mockTask.id,
        mockOrder.id
      );
    });

    it('should throw error when no eligible agents found', async () => {
      mockRepository.findTaskById.mockResolvedValue(mockTask);
      mockRepository.findOrderById.mockResolvedValue(mockOrder);
      mockRepository.listCandidateAgents.mockResolvedValue([]);

      await expect(service.autoMatchLegacy(testUserId, mockTask.id)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw error when all agents queue is full', async () => {
      mockRepository.findTaskById.mockResolvedValue(mockTask);
      mockRepository.findOrderById.mockResolvedValue(mockOrder);
      mockRepository.listCandidateAgents.mockResolvedValue([mockIdleAgent, mockBusyAgent]);
      mockRepository.getQueueCount.mockResolvedValue(QUEUE_MAX_N);

      await expect(service.autoMatchLegacy(testUserId, mockTask.id)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw 404 when task not found', async () => {
      mockRepository.findTaskById.mockResolvedValue(null);

      await expectHttpStatus(service.autoMatchLegacy(testUserId, 'missing-task'), 404);
    });

    it('should throw 403 when task does not belong to user', async () => {
      mockRepository.findTaskById.mockResolvedValue({
        ...mockTask,
        creator_id: 'someone-else',
      });

      await expectHttpStatus(service.autoMatchLegacy(testUserId, mockTask.id), 403);
    });

    it('should throw error when task is not published', async () => {
      mockRepository.findTaskById.mockResolvedValue({
        ...mockTask,
        status: TaskStatus.Unpaid,
      });

      await expect(service.autoMatchLegacy(testUserId, mockTask.id)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw error when order is not in standby status', async () => {
      mockRepository.findTaskById.mockResolvedValue(mockTask);
      mockRepository.findOrderById.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.Pairing,
      });

      await expect(service.autoMatchLegacy(testUserId, mockTask.id)).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('manualSelect', () => {
    it('should create pairing for idle agent', async () => {
      mockRepository.findTaskById.mockResolvedValue(mockTask);
      mockRepository.findOrderById.mockResolvedValue(mockOrder);
      mockRepository.findAgentById.mockResolvedValue(mockIdleAgent);
      mockRepository.getQueueCount.mockResolvedValue(0);
      mockRepository.updateOrderPairing.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.Pairing,
      });
      mockRepository.updateTaskCurrentStatus.mockResolvedValue(undefined);

      const result = await service.manualSelect(testUserId, mockTask.id, mockIdleAgent.id);

      expect(result.result).toBe('pairing');
      expect(mockRepository.updateOrderPairing).toHaveBeenCalled();
    });

    it('should enqueue busy agent', async () => {
      mockRepository.findTaskById.mockResolvedValue(mockTask);
      mockRepository.findOrderById.mockResolvedValue(mockOrder);
      mockRepository.findAgentById.mockResolvedValue(mockBusyAgent);
      mockRepository.getQueueCount.mockResolvedValue(0);
      mockRepository.findQueuedItem.mockResolvedValue(null);
      mockRepository.enqueueQueueItem.mockResolvedValue({
        id: 'queue-1',
        agent_id: mockBusyAgent.id,
        order_id: mockOrder.id,
        status: QueueItemStatus.Queued,
        created_at: new Date().toISOString(),
      });
      mockRepository.listQueuedItems.mockResolvedValue([
        {
          id: 'queue-1',
          agent_id: mockBusyAgent.id,
          order_id: mockOrder.id,
          status: QueueItemStatus.Queued,
          created_at: new Date().toISOString(),
        },
      ]);

      const result = await service.manualSelect(testUserId, mockTask.id, mockBusyAgent.id);

      expect(result.result).toBe('queued');
      expect(result.status).toBe(OrderStatus.Standby);
    });

    it('should throw 404 when agent not found or not listed', async () => {
      mockRepository.findTaskById.mockResolvedValue(mockTask);
      mockRepository.findOrderById.mockResolvedValue(mockOrder);
      mockRepository.findAgentById.mockResolvedValue({
        ...mockIdleAgent,
        is_listed: false,
      });

      await expectHttpStatus(service.manualSelect(testUserId, mockTask.id, 'missing-agent'), 404);
    });

    it('should throw error when reward is out of range', async () => {
      mockRepository.findTaskById.mockResolvedValue(mockTask);
      mockRepository.findOrderById.mockResolvedValue(mockOrder);
      mockRepository.findAgentById.mockResolvedValue({
        ...mockIdleAgent,
        min_price: '6000000',
        max_price: '7000000',
      });

      await expect(service.manualSelect(testUserId, mockTask.id, mockIdleAgent.id)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw error when agent does not support task type', async () => {
      mockRepository.findTaskById.mockResolvedValue(mockTask);
      mockRepository.findOrderById.mockResolvedValue(mockOrder);
      mockRepository.findAgentById.mockResolvedValue({
        ...mockIdleAgent,
        supported_task_types: ['translation'],
      });

      await expect(service.manualSelect(testUserId, mockTask.id, mockIdleAgent.id)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw error when agent queue is full', async () => {
      mockRepository.findTaskById.mockResolvedValue(mockTask);
      mockRepository.findOrderById.mockResolvedValue(mockOrder);
      mockRepository.findAgentById.mockResolvedValue(mockIdleAgent);
      mockRepository.getQueueCount.mockResolvedValue(QUEUE_MAX_N);

      await expect(service.manualSelect(testUserId, mockTask.id, mockIdleAgent.id)).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('listCandidates', () => {
    it('should return candidate agents with queue info', async () => {
      mockRepository.findTaskById.mockResolvedValue(mockTask);
      mockRepository.findOrderById.mockResolvedValue(mockOrder);
      mockRepository.listCandidateAgents.mockResolvedValue([mockIdleAgent]);
      mockRepository.getQueueCount.mockResolvedValue(2);

      const result = await service.listCandidates(testUserId, mockTask.id);

      expect(result).toEqual([
        {
          agentId: mockIdleAgent.id,
          ownerId: mockIdleAgent.owner_id,
          name: mockIdleAgent.name,
          description: mockIdleAgent.description,
          tags: mockIdleAgent.tags,
          supportedTaskTypes: mockIdleAgent.supported_task_types,
          minPrice: String(mockIdleAgent.min_price),
          maxPrice: String(mockIdleAgent.max_price),
          status: mockIdleAgent.status,
          queue: {
            queuedCount: 2,
            capacity: QUEUE_MAX_N,
            available: QUEUE_MAX_N - 2,
          },
        },
      ]);
    });
  });

  describe('state machine validation', () => {
    it('should allow Standby to Pairing transition', () => {
      expect(() => assertTransition(OrderStatus.Standby, OrderStatus.Pairing)).not.toThrow();
    });
  });

  describe('idempotency', () => {
    it('should not create duplicate queue entries for same order and agent', async () => {
      mockRepository.findTaskById.mockResolvedValue(mockTask);
      mockRepository.findOrderById.mockResolvedValue(mockOrder);
      mockRepository.findAgentById.mockResolvedValue(mockBusyAgent);
      mockRepository.getQueueCount.mockResolvedValue(0);
      mockRepository.findQueuedItem.mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: 'queue-1',
        agent_id: mockBusyAgent.id,
        order_id: mockOrder.id,
        status: QueueItemStatus.Queued,
        created_at: new Date().toISOString(),
      });
      mockRepository.enqueueQueueItem.mockResolvedValue({
        id: 'queue-1',
        agent_id: mockBusyAgent.id,
        order_id: mockOrder.id,
        status: QueueItemStatus.Queued,
        created_at: new Date().toISOString(),
      });
      mockRepository.listQueuedItems.mockResolvedValue([
        {
          id: 'queue-1',
          agent_id: mockBusyAgent.id,
          order_id: mockOrder.id,
          status: QueueItemStatus.Queued,
          created_at: new Date().toISOString(),
        },
      ]);

      await service.manualSelect(testUserId, mockTask.id, mockBusyAgent.id);
      await service.manualSelect(testUserId, mockTask.id, mockBusyAgent.id);

      expect(mockRepository.enqueueQueueItem).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAgentStatus', () => {
    it('should return Idle when agent has no in-progress orders and no queue', async () => {
      mockRepository.getInProgressOrderCount.mockResolvedValue(0);
      mockRepository.getQueueCount.mockResolvedValue(0);

      const status = await service.getAgentStatus('agent-1');

      expect(status).toBe(AgentStatus.Idle);
      expect(mockRepository.getInProgressOrderCount).toHaveBeenCalledWith('agent-1');
      expect(mockRepository.getQueueCount).toHaveBeenCalledWith('agent-1');
    });

    it('should return Busy when agent has in-progress orders but no queue', async () => {
      mockRepository.getInProgressOrderCount.mockResolvedValue(1);
      mockRepository.getQueueCount.mockResolvedValue(0);

      const status = await service.getAgentStatus('agent-1');

      expect(status).toBe(AgentStatus.Busy);
    });

    it('should return Queueing when agent has both in-progress orders and queue', async () => {
      mockRepository.getInProgressOrderCount.mockResolvedValue(1);
      mockRepository.getQueueCount.mockResolvedValue(3);

      const status = await service.getAgentStatus('agent-1');

      expect(status).toBe(AgentStatus.Queueing);
    });

    it('should return Idle when agent has queue but no in-progress orders', async () => {
      mockRepository.getInProgressOrderCount.mockResolvedValue(0);
      mockRepository.getQueueCount.mockResolvedValue(2);

      const status = await service.getAgentStatus('agent-1');

      expect(status).toBe(AgentStatus.Idle);
    });
  });

  describe('autoMatch - multiple agent scenarios', () => {
    it('should skip agents with full queue and select next available agent', async () => {
      const mockIdleAgent1 = {
        ...mockIdleAgent,
        id: 'agent-1',
        name: 'First Idle Agent',
        avg_rating: 4.5,
        completed_order_count: 20,
      };
      const mockIdleAgent2 = {
        ...mockIdleAgent,
        id: 'agent-3',
        name: 'Second Idle Agent',
        avg_rating: 4.0,
        completed_order_count: 10,
      };

      mockRepository.findTaskById.mockResolvedValue(mockTask);
      mockRepository.findOrderById.mockResolvedValue(mockOrder);
      mockRepository.listCandidateAgents.mockResolvedValue([mockIdleAgent1, mockIdleAgent2]);
      // First idle agent has full queue, second has available queue
      mockRepository.getQueueCount.mockResolvedValueOnce(QUEUE_MAX_N).mockResolvedValueOnce(0);
      mockRepository.updateOrderPairing.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.Pairing,
      });
      mockRepository.updateTaskCurrentStatus.mockResolvedValue(undefined);

      const result = await service.autoMatchLegacy(testUserId, mockTask.id);

      expect(result.result).toBe('pairing');
      expect(result.agentId).toBe(mockIdleAgent2.id);
      expect(mockRepository.getQueueCount).toHaveBeenCalledTimes(2);
    });

    it('should try all agents before throwing error when all have full queues', async () => {
      mockRepository.findTaskById.mockResolvedValue(mockTask);
      mockRepository.findOrderById.mockResolvedValue(mockOrder);
      mockRepository.listCandidateAgents.mockResolvedValue([mockIdleAgent, mockBusyAgent]);
      // Both agents have full queues
      mockRepository.getQueueCount.mockResolvedValue(QUEUE_MAX_N);

      await expect(service.autoMatchLegacy(testUserId, mockTask.id)).rejects.toThrow(
        'No available agents with queue capacity'
      );
      expect(mockRepository.getQueueCount).toHaveBeenCalledTimes(2);
    });
  });

  describe('userId resolution', () => {
    it('should throw error when userId is null or empty', async () => {
      mockRepository.findTaskById.mockResolvedValue(mockTask);

      await expect(service.autoMatchLegacy('', mockTask.id)).rejects.toThrow(
        'x-user-id header is required'
      );
    });

    it('should accept UUID format userId', async () => {
      const uuidUserId = '11111111-1111-4111-8111-111111111111';
      mockRepository.findTaskById.mockResolvedValue({
        ...mockTask,
        creator_id: uuidUserId,
      });
      mockRepository.findOrderById.mockResolvedValue(mockOrder);
      mockRepository.listCandidateAgents.mockResolvedValue([mockIdleAgent]);
      mockRepository.getQueueCount.mockResolvedValue(0);
      mockRepository.updateOrderPairing.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.Pairing,
      });
      mockRepository.updateTaskCurrentStatus.mockResolvedValue(undefined);

      const result = await service.autoMatchLegacy(uuidUserId, mockTask.id);

      expect(result.result).toBe('pairing');
      expect(mockRepository.findActiveUserIdByAddress).not.toHaveBeenCalled();
    });

    it('should resolve wallet address to userId', async () => {
      const walletAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';
      const resolvedUserId = '11111111-1111-1111-1111-111111111111';

      mockRepository.findActiveUserIdByAddress.mockResolvedValue(resolvedUserId);
      mockRepository.findTaskById.mockResolvedValue({
        ...mockTask,
        creator_id: resolvedUserId,
      });
      mockRepository.findOrderById.mockResolvedValue(mockOrder);
      mockRepository.listCandidateAgents.mockResolvedValue([mockIdleAgent]);
      mockRepository.getQueueCount.mockResolvedValue(0);
      mockRepository.updateOrderPairing.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.Pairing,
      });
      mockRepository.updateTaskCurrentStatus.mockResolvedValue(undefined);

      const result = await service.autoMatchLegacy(walletAddress, mockTask.id);

      expect(result.result).toBe('pairing');
      expect(mockRepository.findActiveUserIdByAddress).toHaveBeenCalledWith(walletAddress);
    });
  });
});
