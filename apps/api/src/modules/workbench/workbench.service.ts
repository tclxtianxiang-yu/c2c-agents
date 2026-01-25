import { OrderStatus } from '@c2c-agents/shared';
import { Inject, Injectable } from '@nestjs/common';
import {
  type WorkbenchOrder,
  type WorkbenchQueueItem,
  WorkbenchRepository,
} from './workbench.repository';

@Injectable()
export class WorkbenchService {
  constructor(@Inject(WorkbenchRepository) private readonly repository: WorkbenchRepository) {}

  async getPairingOrders(providerId: string): Promise<WorkbenchOrder[]> {
    return this.repository.findOrdersByProviderAndStatus(providerId, [OrderStatus.Pairing]);
  }

  async getInProgressOrders(providerId: string): Promise<WorkbenchOrder[]> {
    return this.repository.findOrdersByProviderAndStatus(providerId, [OrderStatus.InProgress]);
  }

  async getDeliveredOrders(providerId: string): Promise<WorkbenchOrder[]> {
    return this.repository.findOrdersByProviderAndStatus(providerId, [OrderStatus.Delivered]);
  }

  async getHistoryOrders(providerId: string): Promise<WorkbenchOrder[]> {
    return this.repository.findOrdersByProviderAndStatus(providerId, [
      OrderStatus.Paid,
      OrderStatus.Refunded,
      OrderStatus.Completed,
    ]);
  }

  async getQueueItems(ownerId: string): Promise<WorkbenchQueueItem[]> {
    return this.repository.findQueueItemsByAgentOwner(ownerId);
  }
}
