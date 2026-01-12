import { OrderStatus, TaskStatus, ValidationError } from '@c2c-agents/shared';
import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import type { ConfirmPaymentDto } from './dtos/confirm-payment.dto';
import type { CreateTaskDto } from './dtos/create-task.dto';
import type { TaskListQueryDto } from './dtos/task-list-query.dto';
import type { TaskQueryService } from './task.query.service';
import type { TaskService } from './task.service';

function parseEnum<T extends Record<string, string>>(
  value: string | undefined,
  enumObj: T
): T[keyof T] | undefined {
  if (!value) return undefined;
  const values = Object.values(enumObj) as string[];
  if (values.includes(value)) return value as T[keyof T];
  return undefined;
}

function parseTags(tags: string | string[] | undefined): string[] | undefined {
  if (!tags) return undefined;
  if (Array.isArray(tags)) return tags.filter(Boolean);
  return tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

@Controller('tasks')
export class TaskController {
  constructor(
    private readonly taskService: TaskService,
    private readonly taskQueryService: TaskQueryService
  ) {}

  @Post()
  createTask(@Headers('x-user-id') userId: string | undefined, @Body() body: CreateTaskDto) {
    if (!userId) {
      throw new ValidationError('x-user-id header is required');
    }
    return this.taskService.createTask(userId, body);
  }

  @Post(':id/payments/confirm')
  confirmPayment(
    @Headers('x-user-id') userId: string | undefined,
    @Param('id') taskId: string,
    @Body() body: ConfirmPaymentDto
  ) {
    if (!userId) {
      throw new ValidationError('x-user-id header is required');
    }
    return this.taskService.confirmPayment(userId, taskId, body.payTxHash);
  }

  @Get(':id')
  getTask(@Param('id') taskId: string) {
    return this.taskQueryService.findById(taskId);
  }

  @Get()
  listTasks(
    @Headers('x-user-id') userId: string | undefined,
    @Query() query: Record<string, string | string[] | undefined>
  ) {
    const parsedQuery: TaskListQueryDto = {
      scope: query.scope === 'market' || query.scope === 'mine' ? query.scope : undefined,
      status: parseEnum(query.status as string | undefined, TaskStatus),
      currentStatus: parseEnum(query.currentStatus as string | undefined, OrderStatus),
      type: query.type as TaskListQueryDto['type'],
      tags: parseTags(query.tags),
      minReward: query.minReward as string | undefined,
      maxReward: query.maxReward as string | undefined,
    };

    return this.taskQueryService.listTasks(userId ?? null, parsedQuery);
  }
}
