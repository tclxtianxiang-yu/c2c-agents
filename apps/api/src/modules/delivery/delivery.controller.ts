import { ValidationError } from '@c2c-agents/shared';
import { Body, Controller, Get, Headers, Inject, Param, Post } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import type { CreateDeliveryDto } from './dtos/create-delivery.dto';

@Controller('orders')
export class DeliveryController {
  constructor(@Inject(DeliveryService) private readonly deliveryService: DeliveryService) {}

  @Post(':id/deliveries')
  createDelivery(
    @Headers('x-user-id') userId: string | undefined,
    @Param('id') orderId: string,
    @Body() body: CreateDeliveryDto
  ) {
    if (!userId) {
      throw new ValidationError('x-user-id header is required');
    }
    return this.deliveryService.createDelivery(userId, orderId, body);
  }

  @Get(':id/delivery')
  getDelivery(@Param('id') orderId: string) {
    return this.deliveryService.getDelivery(orderId);
  }
}
