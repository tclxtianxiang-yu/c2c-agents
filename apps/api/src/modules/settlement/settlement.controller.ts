import { ValidationError } from '@c2c-agents/shared';
import { Controller, Headers, Inject, Param, Post } from '@nestjs/common';
import { SettlementService } from './settlement.service';

@Controller()
export class SettlementController {
  constructor(@Inject(SettlementService) private readonly settlementService: SettlementService) {}

  @Post('orders/:id/accept')
  acceptOrder(@Headers('x-user-id') userId: string | undefined, @Param('id') orderId: string) {
    if (!userId) {
      throw new ValidationError('x-user-id header is required');
    }
    return this.settlementService.acceptOrder(userId, orderId);
  }

  @Post('settlement/auto-accept')
  runAutoAccept() {
    return this.settlementService.runAutoAccept();
  }
}
