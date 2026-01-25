import { ErrorCode, type Execution, ValidationError } from '@c2c-agents/shared';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import type { SelectExecutionsDto } from './dtos/select-executions.dto';
import { ExecutionRepository, type ExecutionWithAgent } from './execution.repository';

@Injectable()
export class ExecutionService {
  constructor(@Inject(ExecutionRepository) private readonly repository: ExecutionRepository) {}

  /**
   * Get executions for an order with agent info
   * Validates that the user is either the creator or provider of the order
   */
  async getExecutionsByOrder(userId: string, orderId: string): Promise<ExecutionWithAgent[]> {
    const order = await this.repository.findOrderById(orderId);
    if (!order) {
      throw new HttpException(
        { code: ErrorCode.BUSINESS_RESOURCE_NOT_FOUND, message: 'Order not found' },
        404
      );
    }

    // Allow both creator (A) and provider (B) to view executions
    if (order.creatorId !== userId && order.providerId !== userId) {
      throw new HttpException(
        { code: ErrorCode.AUTH_FORBIDDEN, message: 'You do not have access to this order' },
        403
      );
    }

    return this.repository.findExecutionsByOrderIdWithAgent(orderId);
  }

  /**
   * Refresh execution status by querying Mastra
   * This is a placeholder that will be implemented when MastraClientService is available
   */
  async refreshExecutionStatus(executionId: string): Promise<Execution> {
    const execution = await this.repository.findExecutionById(executionId);
    if (!execution) {
      throw new HttpException(
        { code: ErrorCode.BUSINESS_RESOURCE_NOT_FOUND, message: 'Execution not found' },
        404
      );
    }

    // TODO: When MastraClientService is available, call it to refresh status
    // For now, just return the current execution state
    // const mastraStatus = await this.mastraClient.getRunStatus(execution.mastraRunId);
    // if (mastraStatus.changed) {
    //   return this.repository.updateExecution(executionId, {
    //     mastraStatus: mastraStatus.status,
    //     status: mapMastraStatusToExecutionStatus(mastraStatus.status),
    //     resultPreview: mastraStatus.preview,
    //     resultContent: mastraStatus.content,
    //     completedAt: mastraStatus.completedAt,
    //   });
    // }

    return execution;
  }

  /**
   * User selects execution results (0-3 selections allowed)
   * Only the order creator (A) can select executions
   * Order must be in the 'selecting' execution phase
   */
  async selectExecutions(
    userId: string,
    dto: SelectExecutionsDto
  ): Promise<{
    selectedExecutions: Execution[];
    rejectedExecutions: Execution[];
  }> {
    const { orderId, selectedExecutionIds } = dto;

    const order = await this.repository.findOrderById(orderId);
    if (!order) {
      throw new HttpException(
        { code: ErrorCode.BUSINESS_RESOURCE_NOT_FOUND, message: 'Order not found' },
        404
      );
    }

    // Only the creator (A) can select executions
    if (order.creatorId !== userId) {
      throw new HttpException(
        { code: ErrorCode.AUTH_FORBIDDEN, message: 'Only the task creator can select executions' },
        403
      );
    }

    // Order must be in selecting phase
    if (order.executionPhase !== 'selecting') {
      throw new ValidationError(
        `Cannot select executions: order is in '${order.executionPhase ?? 'unknown'}' phase, expected 'selecting'`
      );
    }

    // Get all executions for this order
    const executions = await this.repository.findExecutionsByOrderId(orderId);
    if (executions.length === 0) {
      throw new ValidationError('No executions found for this order');
    }

    // Validate that all selected IDs belong to this order
    const executionIds = new Set(executions.map((e) => e.id));
    for (const selectedId of selectedExecutionIds) {
      if (!executionIds.has(selectedId)) {
        throw new ValidationError(`Execution ${selectedId} does not belong to this order`);
      }
    }

    // Only allow selecting completed executions
    const completedExecutions = executions.filter((e) => e.status === 'completed');
    for (const selectedId of selectedExecutionIds) {
      const exec = completedExecutions.find((e) => e.id === selectedId);
      if (!exec) {
        throw new ValidationError(`Execution ${selectedId} is not in 'completed' status`);
      }
    }

    // Update selected executions to 'selected' status
    const selectedSet = new Set(selectedExecutionIds);
    const toSelect = executions.filter((e) => selectedSet.has(e.id));
    const toReject = executions.filter((e) => !selectedSet.has(e.id) && e.status === 'completed');

    const [selectedExecutions, rejectedExecutions] = await Promise.all([
      toSelect.length > 0
        ? this.repository.updateExecutionsBatch(
            toSelect.map((e) => e.id),
            { status: 'selected' }
          )
        : Promise.resolve([]),
      toReject.length > 0
        ? this.repository.updateExecutionsBatch(
            toReject.map((e) => e.id),
            { status: 'rejected' }
          )
        : Promise.resolve([]),
    ]);

    // Update order status based on selection
    const taskId = await this.repository.findTaskIdByOrderId(orderId);
    if (selectedExecutionIds.length > 0) {
      // User selected at least one execution -> create delivery and mark as Delivered
      // Agent 已经执行完毕，选择结果就是交付内容，直接进入 Delivered 状态

      // 1. 获取第一个选中执行的 agentId 和对应的 owner_id 作为 providerId
      const firstSelectedExecution = selectedExecutions[0];
      const selectedAgentId = firstSelectedExecution.agentId;
      const agentOwnerId = await this.repository.findAgentOwnerId(selectedAgentId);
      const providerId = agentOwnerId ?? order.creatorId;

      // 2. 更新订单的 agent_id 和 provider_id
      await this.repository.updateOrderProvider(orderId, selectedAgentId, providerId);

      // 3. 合并所有选中执行的结果内容作为交付内容
      const selectedResults = selectedExecutions
        .map((e) => e.resultContent)
        .filter((content): content is string => content !== null && content !== undefined);
      const deliveryContent =
        selectedResults.length > 0 ? selectedResults.join('\n\n---\n\n') : '执行结果已选择';

      // 4. 创建交付记录
      await this.repository.createDeliveryFromExecution(orderId, providerId, deliveryContent);

      // 5. 更新订单状态为 Delivered
      await this.repository.updateOrderAfterSelection(orderId, 'Delivered', 'completed');
      await this.repository.updateOrderDeliveredAt(orderId);

      if (taskId) {
        await this.repository.updateTaskCurrentStatus(taskId, 'Delivered');
      }
    } else {
      // User selected nothing -> return to Standby
      await this.repository.updateOrderAfterSelection(orderId, 'Standby', null);
      if (taskId) {
        await this.repository.updateTaskCurrentStatus(taskId, 'Standby');
      }
    }

    return { selectedExecutions, rejectedExecutions };
  }
}
