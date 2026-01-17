import { MAX_TASK_REWARD, MIN_TASK_REWARD, PLATFORM_FEE_RATE } from '@c2c-agents/config/constants';
import {
  ErrorCode,
  IdempotencyViolationError,
  OrderStatus,
  TaskStatus,
  ValidationError,
} from '@c2c-agents/shared';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { validateApiEnv } from '../../config/env';
import { ChainService } from '../core/chain.service';
import type { CreateTaskDto } from './dtos/create-task.dto';
import { TaskRepository } from './task.repository';

const MAX_TAGS = 10;
const TASK_TYPES = [
  'writing',
  'translation',
  'code',
  'website',
  'email_automation',
  'info_collection',
  'other_mastra',
] as const;

function isNonEmptyText(value: string | undefined | null): boolean {
  return Boolean(value && value.trim().length > 0);
}

function toStringAmount(value: string | number): string {
  return typeof value === 'number' ? value.toString() : value;
}

function isValidMinUnit(value: string): boolean {
  if (!/^[0-9]+$/.test(value)) return false;
  return true;
}

@Injectable()
export class TaskService {
  private readonly escrowAddress: string;

  constructor(
    @Inject(TaskRepository) private readonly repository: TaskRepository,
    @Inject(ChainService) private readonly chainService: ChainService
  ) {
    this.escrowAddress = validateApiEnv().escrowAddress;
  }

  async createTask(userId: string, input: CreateTaskDto) {
    const resolvedUserId = await this.resolveUserId(userId);
    if (!resolvedUserId) {
      throw new ValidationError('x-user-id header is required');
    }
    this.validateCreateTask(input);

    const task = await this.repository.createTask({
      creatorId: resolvedUserId,
      title: input.title.trim(),
      description: input.description.trim(),
      type: input.type,
      tags: input.tags ?? [],
      expectedReward: input.expectedReward,
    });

    if (input.attachments?.length) {
      await this.repository.addTaskAttachments(task.id, input.attachments);
    }

    return { id: task.id, status: task.status };
  }

  async confirmPayment(userId: string, taskId: string, payTxHash: string) {
    const resolvedUserId = await this.resolveUserId(userId);
    if (!resolvedUserId) {
      throw new ValidationError('x-user-id header is required');
    }
    const normalizedHash = payTxHash.trim();
    if (!isNonEmptyText(normalizedHash)) {
      throw new ValidationError('payTxHash is required');
    }

    const task = await this.repository.findTaskById(taskId);
    if (!task) {
      throw new HttpException(
        { code: ErrorCode.BUSINESS_RESOURCE_NOT_FOUND, message: 'Task not found' },
        404
      );
    }

    if (task.creatorId !== resolvedUserId) {
      throw new HttpException(
        { code: ErrorCode.AUTH_FORBIDDEN, message: 'Task does not belong to current user' },
        403
      );
    }

    const existingOrderByTx = await this.repository.findOrderByPayTxHash(normalizedHash);
    if (existingOrderByTx) {
      if (existingOrderByTx.taskId !== task.id) {
        throw new IdempotencyViolationError('payTxHash already used for another task');
      }

      if (task.currentOrderId && task.currentOrderId !== existingOrderByTx.id) {
        throw new IdempotencyViolationError('Task already has a different order bound');
      }

      return {
        taskId: task.id,
        orderId: existingOrderByTx.id,
        status: task.status,
        confirmations: 0,
      };
    }

    if (task.status !== TaskStatus.Unpaid) {
      throw new ValidationError('Task is not in unpaid status');
    }

    const creatorAddress = await this.repository.getActiveWalletAddress(resolvedUserId, 'A');
    if (!creatorAddress) {
      throw new ValidationError('Active wallet address not found for user');
    }

    const verification = await this.chainService.verifyPayment({
      txHash: normalizedHash,
      expectedFrom: creatorAddress,
      expectedTo: this.escrowAddress,
      expectedAmount: task.expectedReward,
    });

    if (!verification.success) {
      await this.repository.updateTask(task.id, {
        lastPayTxHash: normalizedHash,
        payFailReason: verification.error.message,
      });
      throw verification.error;
    }

    const order = await this.repository.createOrder({
      taskId: task.id,
      creatorId: task.creatorId,
      status: OrderStatus.Standby,
      rewardAmount: task.expectedReward,
      platformFeeRate: PLATFORM_FEE_RATE.toString(),
      payTxHash: normalizedHash,
      escrowAmount: verification.actualAmount,
    });

    try {
      const recordResult = await this.chainService.recordEscrow({
        orderId: order.id,
        amount: verification.actualAmount,
      });

      if (!recordResult.success) {
        throw recordResult.error;
      }
    } catch (error) {
      await this.repository.deleteOrder(order.id);
      throw error;
    }

    await this.repository.updateTask(task.id, {
      status: TaskStatus.Published,
      currentOrderId: order.id,
      currentStatus: OrderStatus.Standby,
      lastPayTxHash: normalizedHash,
      payFailReason: null,
    });

    return {
      taskId: task.id,
      orderId: order.id,
      status: TaskStatus.Published,
      confirmations: verification.confirmations,
    };
  }

  async deleteTask(userId: string, taskId: string) {
    const resolvedUserId = await this.resolveUserId(userId);
    if (!resolvedUserId) {
      throw new ValidationError('x-user-id header is required');
    }

    const task = await this.repository.findTaskById(taskId);
    if (!task) {
      throw new HttpException(
        { code: ErrorCode.BUSINESS_RESOURCE_NOT_FOUND, message: 'Task not found' },
        404
      );
    }

    if (task.creatorId !== resolvedUserId) {
      throw new HttpException(
        { code: ErrorCode.AUTH_FORBIDDEN, message: 'Task does not belong to current user' },
        403
      );
    }

    if (task.status === TaskStatus.Archived) {
      return { taskId: task.id, status: task.status };
    }

    const canDelete =
      task.status === TaskStatus.Unpaid || task.currentStatus === OrderStatus.Completed;
    if (!canDelete) {
      throw new ValidationError('Task can only be deleted when unpaid or completed');
    }

    const updated = await this.repository.updateTask(task.id, {
      status: TaskStatus.Archived,
    });

    return { taskId: updated.id, status: updated.status };
  }

  private validateCreateTask(input: CreateTaskDto): void {
    if (!isNonEmptyText(input.title)) {
      throw new ValidationError('title is required');
    }
    if (!isNonEmptyText(input.description)) {
      throw new ValidationError('description is required');
    }
    if (!isNonEmptyText(input.type)) {
      throw new ValidationError('type is required');
    }
    if (!TASK_TYPES.includes(input.type)) {
      throw new ValidationError('type is invalid');
    }
    if (!isNonEmptyText(input.expectedReward)) {
      throw new ValidationError('expectedReward is required');
    }

    const tags = input.tags ?? [];
    if (tags.length > MAX_TAGS) {
      throw new ValidationError(`tags exceeds limit (${MAX_TAGS})`);
    }

    const reward = toStringAmount(input.expectedReward);
    if (!isValidMinUnit(reward)) {
      throw new ValidationError('expectedReward must be a non-negative integer string');
    }

    const rewardValue = BigInt(reward);
    if (rewardValue < BigInt(MIN_TASK_REWARD)) {
      throw new ValidationError(`expectedReward must be >= ${MIN_TASK_REWARD}`);
    }
    if (rewardValue > BigInt(MAX_TASK_REWARD)) {
      throw new ValidationError(`expectedReward must be <= ${MAX_TASK_REWARD}`);
    }
  }

  private async resolveUserId(userId: string | null): Promise<string | null> {
    if (!userId) return null;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
      return userId;
    }
    return this.repository.findActiveUserIdByAddress(userId);
  }
}
