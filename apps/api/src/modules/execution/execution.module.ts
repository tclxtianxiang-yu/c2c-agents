import { Module } from '@nestjs/common';
import { ExecutionController } from './execution.controller';
import { ExecutionRepository } from './execution.repository';
import { ExecutionService } from './execution.service';

@Module({
  controllers: [ExecutionController],
  providers: [ExecutionService, ExecutionRepository],
  exports: [ExecutionService, ExecutionRepository],
})
export class ExecutionModule {}
