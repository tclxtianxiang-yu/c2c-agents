import {
  ErrorCode,
  OrderStatus,
  TaskStatus,
  type TaskType,
  ValidationError,
} from '@c2c-agents/shared';
import { HttpException, Injectable } from '@nestjs/common';
import type { TaskListQueryDto, TaskListScope } from './dtos/task-list-query.dto';
import type { TaskRepository } from './task.repository';

const DEFAULT_SCOPE: TaskListScope = 'mine';

@Injectable()
export class TaskQueryService {
  constructor(private readonly repository: TaskRepository) {}

  async findById(taskId: string) {
    const task = await this.repository.findTaskById(taskId);
    if (!task) {
      throw new HttpException(
        { code: ErrorCode.BUSINESS_RESOURCE_NOT_FOUND, message: 'Task not found' },
        404
      );
    }

    return task;
  }

  async getTaskSummary(taskId: string) {
    const task = await this.findById(taskId);
    return {
      id: task.id,
      title: task.title,
      type: task.type,
      expectedReward: task.expectedReward,
      status: task.status,
      currentStatus: task.currentStatus,
    };
  }

  async listTasks(userId: string | null, query: TaskListQueryDto) {
    const scope = query.scope ?? DEFAULT_SCOPE;
    if (scope === 'mine') {
      if (!userId) {
        throw new ValidationError('x-user-id header is required for scope=mine');
      }
      return this.repository.listTasks({
        ...query,
        creatorId: userId,
      });
    }

    if (scope === 'market') {
      return this.repository.listTasks({
        ...query,
        status: TaskStatus.Published,
        currentStatus: OrderStatus.Standby,
      });
    }

    throw new ValidationError('Invalid scope value');
  }

  async listPublishedStandbyTasks(filters?: {
    type?: TaskType;
    tags?: string[];
    minReward?: string;
    maxReward?: string;
  }) {
    return this.repository.listTasks({
      status: TaskStatus.Published,
      currentStatus: OrderStatus.Standby,
      type: filters?.type,
      tags: filters?.tags,
      minReward: filters?.minReward,
      maxReward: filters?.maxReward,
    });
  }
}
