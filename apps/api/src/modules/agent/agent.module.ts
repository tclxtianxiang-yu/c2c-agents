import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentRepository } from './agent.repository';
import { AgentService } from './agent.service';

@Module({
  controllers: [AgentController],
  providers: [AgentService, AgentRepository],
  exports: [AgentService], // 导出供其他模块使用（如 matching）
})
export class AgentModule {}
