import { Module } from '@nestjs/common';
import { TaskController } from './task.controller';
import { TaskQueryService } from './task.query.service';
import { TaskRepository } from './task.repository';
import { TaskService } from './task.service';

@Module({
  controllers: [TaskController],
  providers: [TaskService, TaskQueryService, TaskRepository],
  exports: [TaskQueryService, TaskRepository],
})
export class TaskModule {}
