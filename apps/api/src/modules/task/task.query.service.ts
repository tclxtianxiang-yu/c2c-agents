import {
  ErrorCode,
  OrderStatus,
  TaskStatus,
  type TaskType,
  ValidationError,
} from '@c2c-agents/shared';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import type { TaskListQueryDto, TaskListScope } from './dtos/task-list-query.dto';
import { TaskRepository } from './task.repository';

const DEFAULT_SCOPE: TaskListScope = 'mine';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class TaskQueryService {
  constructor(@Inject(TaskRepository) private readonly repository: TaskRepository) {}

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
      const resolvedUserId = await this.resolveUserId(userId);
      if (!resolvedUserId) {
        throw new ValidationError('x-user-id header is required for scope=mine');
      }
      return this.repository.listTasks({
        ...query,
        creatorId: resolvedUserId,
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

  private async resolveUserId(userId: string | null): Promise<string | null> {
    if (!userId) return null;
    if (UUID_RE.test(userId)) return userId;
    return this.repository.findActiveUserIdByAddress(userId);
  }
}
