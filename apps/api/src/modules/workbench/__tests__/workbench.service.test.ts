import { OrderStatus, QueueItemStatus } from '@c2c-agents/shared';
import type { WorkbenchOrder, WorkbenchQueueItem } from '../workbench.repository';
import { WorkbenchService } from '../workbench.service';

const mockRepository = {
  findOrdersByProviderAndStatus: jest.fn(),
  findQueueItemsByAgentOwner: jest.fn(),
};

describe('WorkbenchService', () => {
  let service: WorkbenchService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorkbenchService(mockRepository as any);
  });

  describe('getPairingOrders', () => {
    it('should call repository with Pairing status', async () => {
      mockRepository.findOrdersByProviderAndStatus.mockResolvedValue([]);
      await service.getPairingOrders('user-1');
      expect(mockRepository.findOrdersByProviderAndStatus).toHaveBeenCalledWith('user-1', [
        OrderStatus.Pairing,
      ]);
    });

    it('should return orders from repository', async () => {
      const mockOrders: WorkbenchOrder[] = [
        {
          id: 'order-1',
          taskId: 'task-1',
          status: OrderStatus.Pairing,
          rewardAmount: '100',
          providerId: 'user-1',
          agentId: 'agent-1',
          deliveredAt: null,
          pairingCreatedAt: '2026-01-25T00:00:00Z',
          createdAt: '2026-01-25T00:00:00Z',
          task: { id: 'task-1', title: 'Test Task', type: 'test', description: 'desc' },
          agent: { id: 'agent-1', name: 'Agent 1' },
        },
      ];
      mockRepository.findOrdersByProviderAndStatus.mockResolvedValue(mockOrders);
      const result = await service.getPairingOrders('user-1');
      expect(result).toEqual(mockOrders);
    });
  });

  describe('getInProgressOrders', () => {
    it('should call repository with InProgress status', async () => {
      mockRepository.findOrdersByProviderAndStatus.mockResolvedValue([]);
      await service.getInProgressOrders('user-1');
      expect(mockRepository.findOrdersByProviderAndStatus).toHaveBeenCalledWith('user-1', [
        OrderStatus.InProgress,
      ]);
    });
  });

  describe('getDeliveredOrders', () => {
    it('should call repository with Delivered status', async () => {
      mockRepository.findOrdersByProviderAndStatus.mockResolvedValue([]);
      await service.getDeliveredOrders('user-1');
      expect(mockRepository.findOrdersByProviderAndStatus).toHaveBeenCalledWith('user-1', [
        OrderStatus.Delivered,
      ]);
    });
  });

  describe('getHistoryOrders', () => {
    it('should call repository with completed statuses', async () => {
      mockRepository.findOrdersByProviderAndStatus.mockResolvedValue([]);
      await service.getHistoryOrders('user-1');
      expect(mockRepository.findOrdersByProviderAndStatus).toHaveBeenCalledWith('user-1', [
        OrderStatus.Paid,
        OrderStatus.Refunded,
        OrderStatus.Completed,
      ]);
    });
  });

  describe('getQueueItems', () => {
    it('should call repository with owner id', async () => {
      mockRepository.findQueueItemsByAgentOwner.mockResolvedValue([]);
      await service.getQueueItems('user-1');
      expect(mockRepository.findQueueItemsByAgentOwner).toHaveBeenCalledWith('user-1');
    });

    it('should return queue items from repository', async () => {
      const mockItems: WorkbenchQueueItem[] = [
        {
          id: 'item-1',
          agentId: 'agent-1',
          orderId: 'order-1',
          status: QueueItemStatus.Queued,
          createdAt: '2026-01-25T00:00:00Z',
          order: {
            id: 'order-1',
            taskId: 'task-1',
            task: { id: 'task-1', title: 'Test', type: 'test' },
          },
          agent: { id: 'agent-1', name: 'Agent 1' },
        },
      ];
      mockRepository.findQueueItemsByAgentOwner.mockResolvedValue(mockItems);
      const result = await service.getQueueItems('user-1');
      expect(result).toEqual(mockItems);
    });
  });
});
