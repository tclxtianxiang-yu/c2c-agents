import { OrderStatus, ValidationError } from '@c2c-agents/shared';
import { describe, expect, it, jest } from '@jest/globals';
import type { DeliveryRepository } from '../delivery.repository';
import { DeliveryService } from '../delivery.service';

describe('DeliveryService', () => {
  it('rejects empty delivery payload', async () => {
    const repository = {
      findOrderById: jest.fn(async () => ({
        id: 'order-1',
        task_id: 'task-1',
        creator_id: 'user-a',
        provider_id: 'user-b',
        status: OrderStatus.InProgress,
        delivered_at: null,
      })),
    } as unknown as DeliveryRepository;

    const service = new DeliveryService(repository);
    await expect(
      service.createDelivery('user-b', 'order-1', {
        contentText: '   ',
        externalUrl: '',
        attachments: [],
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('creates delivery and updates order', async () => {
    const repository = {
      findOrderById: jest.fn(async () => ({
        id: 'order-1',
        task_id: 'task-1',
        creator_id: 'user-a',
        provider_id: 'user-b',
        status: OrderStatus.InProgress,
        delivered_at: null,
      })),
      findDeliveryByOrderId: jest.fn(async () => null),
      createDelivery: jest.fn(async () => ({
        id: 'delivery-1',
        orderId: 'order-1',
        providerId: 'user-b',
        contentText: 'done',
        externalUrl: null,
        submittedAt: new Date().toISOString(),
      })),
      addDeliveryAttachments: jest.fn(async () => undefined),
      updateOrderDelivered: jest.fn(async () => undefined),
      updateTaskCurrentStatus: jest.fn(async () => undefined),
      findDeliveryAttachments: jest.fn(async () => []),
    } as unknown as DeliveryRepository;

    const service = new DeliveryService(repository);
    const result = await service.createDelivery('user-b', 'order-1', {
      contentText: 'done',
      attachments: ['file-1'],
    });

    expect(result.delivery.id).toBe('delivery-1');
    expect(repository.addDeliveryAttachments).toHaveBeenCalledWith('delivery-1', ['file-1']);
    expect(repository.updateOrderDelivered).toHaveBeenCalled();
  });
});
