import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { MastraTokenModule } from '../mastra-token/mastra-token.module';
import { MastraService } from './mastra.service';

@Module({
  imports: [MastraTokenModule, AgentModule],
  providers: [MastraService],
  exports: [MastraService],
})
export class MastraModule {}
