import { Module } from '@nestjs/common';
import { WorkbenchController } from './workbench.controller';
import { WorkbenchRepository } from './workbench.repository';
import { WorkbenchService } from './workbench.service';

@Module({
  controllers: [WorkbenchController],
  providers: [WorkbenchService, WorkbenchRepository],
  exports: [WorkbenchService],
})
export class WorkbenchModule {}
