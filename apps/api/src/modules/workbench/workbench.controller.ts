import { ValidationError } from '@c2c-agents/shared';
import { Controller, Get, Headers, Inject } from '@nestjs/common';
import type { WorkbenchOrder, WorkbenchQueueItem } from './workbench.repository';
import { WorkbenchService } from './workbench.service';

function requireUserId(userId: string | undefined): asserts userId is string {
  if (!userId) {
    throw new ValidationError('x-user-id header is required');
  }
}

@Controller('workbench')
export class WorkbenchController {
  constructor(@Inject(WorkbenchService) private readonly service: WorkbenchService) {}

  @Get('orders/pairing')
  async getPairingOrders(
    @Headers('x-user-id') userId: string | undefined
  ): Promise<WorkbenchOrder[]> {
    requireUserId(userId);
    return this.service.getPairingOrders(userId);
  }

  @Get('orders/in-progress')
  async getInProgressOrders(
    @Headers('x-user-id') userId: string | undefined
  ): Promise<WorkbenchOrder[]> {
    requireUserId(userId);
    return this.service.getInProgressOrders(userId);
  }

  @Get('orders/delivered')
  async getDeliveredOrders(
    @Headers('x-user-id') userId: string | undefined
  ): Promise<WorkbenchOrder[]> {
    requireUserId(userId);
    return this.service.getDeliveredOrders(userId);
  }

  @Get('orders/history')
  async getHistoryOrders(
    @Headers('x-user-id') userId: string | undefined
  ): Promise<WorkbenchOrder[]> {
    requireUserId(userId);
    return this.service.getHistoryOrders(userId);
  }

  @Get('queue')
  async getQueueItems(
    @Headers('x-user-id') userId: string | undefined
  ): Promise<WorkbenchQueueItem[]> {
    requireUserId(userId);
    return this.service.getQueueItems(userId);
  }
}
