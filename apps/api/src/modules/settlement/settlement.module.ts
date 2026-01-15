import { Module } from '@nestjs/common';
import { SettlementController } from './settlement.controller';
import { SettlementRepository } from './settlement.repository';
import { SettlementService } from './settlement.service';

@Module({
  controllers: [SettlementController],
  providers: [SettlementService, SettlementRepository],
})
export class SettlementModule {}
