import { Module } from '@nestjs/common';
import { TaskModule } from '../task/task.module';
import { DeliveryController } from './delivery.controller';
import { DeliveryRepository } from './delivery.repository';
import { DeliveryService } from './delivery.service';

@Module({
  imports: [TaskModule],
  controllers: [DeliveryController],
  providers: [DeliveryService, DeliveryRepository],
})
export class DeliveryModule {}
