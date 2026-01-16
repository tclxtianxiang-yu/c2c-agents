import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { QueueController } from './queue.controller';
import { QueueRepository } from './queue.repository';
import { QueueService } from './queue.service';

@Module({
  imports: [AgentModule], // 导入 AgentModule 以使用 AgentRepository
  controllers: [QueueController],
  providers: [QueueService, QueueRepository],
  exports: [QueueService], // 导出供其他模块使用（如 matching）
})
export class QueueModule {}
