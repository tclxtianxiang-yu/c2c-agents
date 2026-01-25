import { PAIRING_TTL_HOURS } from '@c2c-agents/config/constants';
import { AgentStatus, OrderStatus, ValidationError } from '@c2c-agents/shared';
import { HttpException } from '@nestjs/common';
import type { MatchingRepository } from '../matching.repository';
import { PairingService } from '../pairing.service';

describe('PairingService', () => {
  let service: PairingService;
  let mockRepository: MatchingRepository;

  beforeEach(() => {
    // Mock MatchingRepository
    mockRepository = {
      findOrderById: jest.fn(),
      findAgentById: jest.fn(),
      findTaskById: jest.fn(),
      updateOrderPairing: jest.fn(),
      updateTaskCurrentStatus: jest.fn(),
      updateOrderStatus: jest.fn(),
      updateAgentStatus: jest.fn(),
      clearOrderPairing: jest.fn(),
      cancelQueueItem: jest.fn(),
      findExpiredPairings: jest.fn(),
    } as unknown as MatchingRepository;

    service = new PairingService(mockRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPairing', () => {
    it('should create pairing successfully for Standby order', async () => {
      const orderId = 'order-1';
      const agentId = 'agent-1';
      const taskId = 'task-1';

      const mockOrder = {
        id: orderId,
        task_id: taskId,
        status: OrderStatus.Standby,
        creator_id: 'user-1',
        provider_id: null,
        agent_id: null,
        pairing_created_at: null,
      };

      const mockAgent = {
        id: agentId,
        owner_id: 'provider-1',
        name: 'Test Agent',
        is_listed: true,
        status: AgentStatus.Idle,
      };

      const mockTask = {
        id: taskId,
        creator_id: 'user-1',
      };

      (mockRepository.findOrderById as jest.Mock).mockResolvedValue(mockOrder as any);
      (mockRepository.findAgentById as jest.Mock).mockResolvedValue(mockAgent as any);
      (mockRepository.findTaskById as jest.Mock).mockResolvedValue(mockTask as any);
      (mockRepository.updateOrderPairing as jest.Mock).mockResolvedValue({} as any);
      (mockRepository.updateTaskCurrentStatus as jest.Mock).mockResolvedValue(undefined);

      const result = await service.createPairing(orderId, agentId);

      expect(result.orderId).toBe(orderId);
      expect(result.agentId).toBe(agentId);
      expect(result.providerId).toBe('provider-1');
      expect(result.expiresAt).toBeDefined();
      expect(result.pairingCreatedAt).toBeDefined();

      // Verify repository calls
      expect(mockRepository.findOrderById).toHaveBeenCalledWith(orderId);
      expect(mockRepository.findAgentById).toHaveBeenCalledWith(agentId);
      expect(mockRepository.updateOrderPairing).toHaveBeenCalled();
      expect(mockRepository.updateTaskCurrentStatus).toHaveBeenCalledWith(
        taskId,
        OrderStatus.Pairing
      );
    });

    it('should throw error if order not found', async () => {
      (mockRepository.findOrderById as jest.Mock).mockResolvedValue(null);

      await expect(service.createPairing('order-1', 'agent-1')).rejects.toThrow(HttpException);
      await expect(service.createPairing('order-1', 'agent-1')).rejects.toThrow('Order not found');
    });

    it('should throw error if order is not in Standby status', async () => {
      const mockOrder = {
        id: 'order-1',
        status: OrderStatus.Pairing,
      };

      (mockRepository.findOrderById as jest.Mock).mockResolvedValue(mockOrder as any);

      await expect(service.createPairing('order-1', 'agent-1')).rejects.toThrow(ValidationError);
      await expect(service.createPairing('order-1', 'agent-1')).rejects.toThrow(
        'Order is not in Standby status'
      );
    });

    it('should throw error if agent not found or not listed', async () => {
      const mockOrder = {
        id: 'order-1',
        status: OrderStatus.Standby,
      };

      (mockRepository.findOrderById as jest.Mock).mockResolvedValue(mockOrder as any);
      (mockRepository.findAgentById as jest.Mock).mockResolvedValue(null);

      await expect(service.createPairing('order-1', 'agent-1')).rejects.toThrow(HttpException);
      await expect(service.createPairing('order-1', 'agent-1')).rejects.toThrow(
        'Agent not found or not listed'
      );
    });

    it('should calculate correct expiration time', async () => {
      const orderId = 'order-1';
      const agentId = 'agent-1';
      const taskId = 'task-1';

      const mockOrder = {
        id: orderId,
        task_id: taskId,
        status: OrderStatus.Standby,
      };

      const mockAgent = {
        id: agentId,
        owner_id: 'provider-1',
        is_listed: true,
      };

      const mockTask = { id: taskId };

      (mockRepository.findOrderById as jest.Mock).mockResolvedValue(mockOrder as any);
      (mockRepository.findAgentById as jest.Mock).mockResolvedValue(mockAgent as any);
      (mockRepository.findTaskById as jest.Mock).mockResolvedValue(mockTask as any);
      (mockRepository.updateOrderPairing as jest.Mock).mockResolvedValue({} as any);

      const beforeCall = Date.now();
      const result = await service.createPairing(orderId, agentId);
      const afterCall = Date.now();

      const expiresAt = new Date(result.expiresAt).getTime();
      const expectedExpiration = beforeCall + PAIRING_TTL_HOURS * 60 * 60 * 1000;

      // Allow 1 second tolerance
      expect(expiresAt).toBeGreaterThanOrEqual(expectedExpiration - 1000);
      expect(expiresAt).toBeLessThanOrEqual(afterCall + PAIRING_TTL_HOURS * 60 * 60 * 1000 + 1000);
    });
  });

  describe('acceptPairing', () => {
    it('should accept pairing successfully by creator (role A)', async () => {
      const orderId = 'order-1';
      const userId = 'user-1';
      const taskId = 'task-1';
      const agentId = 'agent-1';

      const mockOrder = {
        id: orderId,
        task_id: taskId,
        status: OrderStatus.Pairing,
        creator_id: userId,
        provider_id: 'provider-1',
        agent_id: agentId,
        pairing_created_at: new Date().toISOString(),
      };

      const mockTask = { id: taskId };

      (mockRepository.findOrderById as jest.Mock).mockResolvedValue(mockOrder as any);
      (mockRepository.findTaskById as jest.Mock).mockResolvedValue(mockTask as any);
      (mockRepository.updateOrderStatus as jest.Mock).mockResolvedValue(undefined);
      (mockRepository.updateAgentStatus as jest.Mock).mockResolvedValue(undefined);
      (mockRepository.updateTaskCurrentStatus as jest.Mock).mockResolvedValue(undefined);

      const result = await service.acceptPairing(orderId, userId, 'A');

      expect(result.orderId).toBe(orderId);
      expect(result.status).toBe(OrderStatus.InProgress);
      expect(result.message).toContain('accepted');

      expect(mockRepository.updateOrderStatus).toHaveBeenCalledWith(
        orderId,
        OrderStatus.InProgress
      );
      expect(mockRepository.updateAgentStatus).toHaveBeenCalledWith(
        agentId,
        AgentStatus.Busy,
        orderId
      );
      expect(mockRepository.updateTaskCurrentStatus).toHaveBeenCalledWith(
        taskId,
        OrderStatus.InProgress
      );
    });

    it('should accept pairing successfully by provider (role B)', async () => {
      const orderId = 'order-1';
      const providerId = 'provider-1';

      const mockOrder = {
        id: orderId,
        task_id: 'task-1',
        status: OrderStatus.Pairing,
        creator_id: 'user-1',
        provider_id: providerId,
        agent_id: 'agent-1',
        pairing_created_at: new Date().toISOString(),
      };

      const mockTask = { id: 'task-1' };

      (mockRepository.findOrderById as jest.Mock).mockResolvedValue(mockOrder as any);
      (mockRepository.findTaskById as jest.Mock).mockResolvedValue(mockTask as any);
      (mockRepository.updateOrderStatus as jest.Mock).mockResolvedValue(undefined);
      (mockRepository.updateAgentStatus as jest.Mock).mockResolvedValue(undefined);
      (mockRepository.updateTaskCurrentStatus as jest.Mock).mockResolvedValue(undefined);

      const result = await service.acceptPairing(orderId, providerId, 'B');

      expect(result.status).toBe(OrderStatus.InProgress);
    });

    it('should throw error if order not found', async () => {
      (mockRepository.findOrderById as jest.Mock).mockResolvedValue(null);

      await expect(service.acceptPairing('order-1', 'user-1', 'A')).rejects.toThrow(HttpException);
    });

    it('should throw error if order is not in Pairing status', async () => {
      const mockOrder = {
        id: 'order-1',
        status: OrderStatus.Standby,
      };

      (mockRepository.findOrderById as jest.Mock).mockResolvedValue(mockOrder as any);

      await expect(service.acceptPairing('order-1', 'user-1', 'A')).rejects.toThrow(
        ValidationError
      );
      await expect(service.acceptPairing('order-1', 'user-1', 'A')).rejects.toThrow(
        'Order is not in Pairing status'
      );
    });

    it('should throw error if role A user is not the creator', async () => {
      const mockOrder = {
        id: 'order-1',
        status: OrderStatus.Pairing,
        creator_id: 'user-1',
        provider_id: 'provider-1',
        pairing_created_at: new Date().toISOString(),
      };

      (mockRepository.findOrderById as jest.Mock).mockResolvedValue(mockOrder as any);

      await expect(service.acceptPairing('order-1', 'wrong-user', 'A')).rejects.toThrow(
        HttpException
      );
      await expect(service.acceptPairing('order-1', 'wrong-user', 'A')).rejects.toThrow(
        'User is not the creator of this order'
      );
    });

    it('should throw error if role B user is not the provider', async () => {
      const mockOrder = {
        id: 'order-1',
        status: OrderStatus.Pairing,
        creator_id: 'user-1',
        provider_id: 'provider-1',
        pairing_created_at: new Date().toISOString(),
      };

      (mockRepository.findOrderById as jest.Mock).mockResolvedValue(mockOrder as any);

      await expect(service.acceptPairing('order-1', 'wrong-provider', 'B')).rejects.toThrow(
        HttpException
      );
      await expect(service.acceptPairing('order-1', 'wrong-provider', 'B')).rejects.toThrow(
        'User is not the provider of this order'
      );
    });

    it('should throw error if pairing has expired', async () => {
      const expiredTime = new Date(Date.now() - (PAIRING_TTL_HOURS + 1) * 60 * 60 * 1000);

      const mockOrder = {
        id: 'order-1',
        status: OrderStatus.Pairing,
        creator_id: 'user-1',
        provider_id: 'provider-1',
        pairing_created_at: expiredTime.toISOString(),
      };

      (mockRepository.findOrderById as jest.Mock).mockResolvedValue(mockOrder as any);

      await expect(service.acceptPairing('order-1', 'user-1', 'A')).rejects.toThrow(
        ValidationError
      );
      await expect(service.acceptPairing('order-1', 'user-1', 'A')).rejects.toThrow(
        'Pairing has expired'
      );
    });
  });

  describe('rejectPairing', () => {
    it('should reject pairing successfully by creator', async () => {
      const orderId = 'order-1';
      const userId = 'user-1';
      const agentId = 'agent-1';
      const taskId = 'task-1';

      const mockOrder = {
        id: orderId,
        task_id: taskId,
        status: OrderStatus.Pairing,
        creator_id: userId,
        provider_id: 'provider-1',
        agent_id: agentId,
        pairing_created_at: new Date().toISOString(),
      };

      const mockTask = { id: taskId };

      (mockRepository.findOrderById as jest.Mock).mockResolvedValue(mockOrder as any);
      (mockRepository.findTaskById as jest.Mock).mockResolvedValue(mockTask as any);
      (mockRepository.clearOrderPairing as jest.Mock).mockResolvedValue(undefined);
      (mockRepository.cancelQueueItem as jest.Mock).mockResolvedValue(undefined);
      (mockRepository.updateTaskCurrentStatus as jest.Mock).mockResolvedValue(undefined);

      const result = await service.rejectPairing(orderId, userId, 'A');

      expect(result.orderId).toBe(orderId);
      expect(result.status).toBe(OrderStatus.Standby);
      expect(result.message).toContain('rejected');

      expect(mockRepository.clearOrderPairing).toHaveBeenCalledWith(orderId);
      expect(mockRepository.cancelQueueItem).toHaveBeenCalledWith(agentId, orderId);
      expect(mockRepository.updateTaskCurrentStatus).toHaveBeenCalledWith(
        taskId,
        OrderStatus.Standby
      );
    });

    it('should reject pairing successfully by provider', async () => {
      const orderId = 'order-1';
      const providerId = 'provider-1';

      const mockOrder = {
        id: orderId,
        task_id: 'task-1',
        status: OrderStatus.Pairing,
        creator_id: 'user-1',
        provider_id: providerId,
        agent_id: 'agent-1',
        pairing_created_at: new Date().toISOString(),
      };

      const mockTask = { id: 'task-1' };

      (mockRepository.findOrderById as jest.Mock).mockResolvedValue(mockOrder as any);
      (mockRepository.findTaskById as jest.Mock).mockResolvedValue(mockTask as any);
      (mockRepository.clearOrderPairing as jest.Mock).mockResolvedValue(undefined);
      (mockRepository.cancelQueueItem as jest.Mock).mockResolvedValue(undefined);
      (mockRepository.updateTaskCurrentStatus as jest.Mock).mockResolvedValue(undefined);

      const result = await service.rejectPairing(orderId, providerId, 'B');

      expect(result.status).toBe(OrderStatus.Standby);
    });

    it('should throw error if order not found', async () => {
      (mockRepository.findOrderById as jest.Mock).mockResolvedValue(null);

      await expect(service.rejectPairing('order-1', 'user-1', 'A')).rejects.toThrow(HttpException);
    });

    it('should throw error if order is not in Pairing status', async () => {
      const mockOrder = {
        id: 'order-1',
        status: OrderStatus.InProgress,
      };

      (mockRepository.findOrderById as jest.Mock).mockResolvedValue(mockOrder as any);

      await expect(service.rejectPairing('order-1', 'user-1', 'A')).rejects.toThrow(
        ValidationError
      );
    });

    it('should not cancel queue item if agent_id is null', async () => {
      const mockOrder = {
        id: 'order-1',
        task_id: 'task-1',
        status: OrderStatus.Pairing,
        creator_id: 'user-1',
        provider_id: 'provider-1',
        agent_id: null,
        pairing_created_at: new Date().toISOString(),
      };

      const mockTask = { id: 'task-1' };

      (mockRepository.findOrderById as jest.Mock).mockResolvedValue(mockOrder as any);
      (mockRepository.findTaskById as jest.Mock).mockResolvedValue(mockTask as any);
      (mockRepository.clearOrderPairing as jest.Mock).mockResolvedValue(undefined);
      (mockRepository.updateTaskCurrentStatus as jest.Mock).mockResolvedValue(undefined);

      await service.rejectPairing('order-1', 'user-1', 'A');

      expect(mockRepository.cancelQueueItem).not.toHaveBeenCalled();
    });
  });

  describe('checkPairingExpiration', () => {
    it('should process expired pairings successfully', async () => {
      const now = new Date();
      const expiredOrder1 = {
        id: 'order-1',
        task_id: 'task-1',
        agent_id: 'agent-1',
        pairing_created_at: new Date(
          now.getTime() - (PAIRING_TTL_HOURS + 1) * 60 * 60 * 1000
        ).toISOString(),
      };

      const expiredOrder2 = {
        id: 'order-2',
        task_id: 'task-2',
        agent_id: 'agent-2',
        pairing_created_at: new Date(
          now.getTime() - (PAIRING_TTL_HOURS + 2) * 60 * 60 * 1000
        ).toISOString(),
      };

      const mockTask1 = { id: 'task-1' };
      const mockTask2 = { id: 'task-2' };

      (mockRepository.findExpiredPairings as jest.Mock).mockResolvedValue([
        expiredOrder1,
        expiredOrder2,
      ] as any);

      (mockRepository.findTaskById as jest.Mock)
        .mockResolvedValueOnce(mockTask1 as any)
        .mockResolvedValueOnce(mockTask2 as any);

      (mockRepository.clearOrderPairing as jest.Mock).mockResolvedValue(undefined);
      (mockRepository.cancelQueueItem as jest.Mock).mockResolvedValue(undefined);
      (mockRepository.updateTaskCurrentStatus as jest.Mock).mockResolvedValue(undefined);

      const result = await service.checkPairingExpiration();

      expect(result.processedCount).toBe(2);
      expect(result.expiredOrderIds).toEqual(['order-1', 'order-2']);

      expect(mockRepository.clearOrderPairing).toHaveBeenCalledTimes(2);
      expect(mockRepository.cancelQueueItem).toHaveBeenCalledWith('agent-1', 'order-1');
      expect(mockRepository.cancelQueueItem).toHaveBeenCalledWith('agent-2', 'order-2');
    });

    it('should return zero count if no expired pairings', async () => {
      (mockRepository.findExpiredPairings as jest.Mock).mockResolvedValue([]);

      const result = await service.checkPairingExpiration();

      expect(result.processedCount).toBe(0);
      expect(result.expiredOrderIds).toEqual([]);
    });

    it('should continue processing even if one order fails', async () => {
      const expiredOrder1 = {
        id: 'order-1',
        task_id: 'task-1',
        agent_id: 'agent-1',
      };

      const expiredOrder2 = {
        id: 'order-2',
        task_id: 'task-2',
        agent_id: 'agent-2',
      };

      (mockRepository.findExpiredPairings as jest.Mock).mockResolvedValue([
        expiredOrder1,
        expiredOrder2,
      ] as any);

      (mockRepository.clearOrderPairing as jest.Mock)
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce(undefined);

      (mockRepository.findTaskById as jest.Mock).mockResolvedValue({ id: 'task-2' } as any);
      (mockRepository.cancelQueueItem as jest.Mock).mockResolvedValue(undefined);
      (mockRepository.updateTaskCurrentStatus as jest.Mock).mockResolvedValue(undefined);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        /* noop */
      });

      const result = await service.checkPairingExpiration();

      expect(result.processedCount).toBe(1);
      expect(result.expiredOrderIds).toEqual(['order-2']);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});
