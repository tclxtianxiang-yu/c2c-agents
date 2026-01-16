import { ValidationError } from '@c2c-agents/shared';
import { Controller, Delete, Get, Headers, Inject, Param } from '@nestjs/common';
import { QueueService } from './queue.service';

@Controller('queue')
export class QueueController {
  constructor(@Inject(QueueService) private readonly queueService: QueueService) {}

  // GET /queue/agents/:agentId/status — 获取 Agent 队列状态（Public）
  @Get('agents/:agentId/status')
  async getQueueStatus(@Param('agentId') agentId: string) {
    return this.queueService.getQueueStatus(agentId);
  }

  // GET /queue/orders/:orderId/position — 获取订单在队列中的位置（A/B）
  // 注意：需要 agentId 参数，通过 query 传递
  @Get('orders/:orderId/position')
  async getQueuePosition(
    @Param('orderId') orderId: string,
    @Headers('x-agent-id') agentId: string | undefined
  ) {
    if (!agentId) {
      throw new ValidationError('x-agent-id header is required');
    }

    const position = await this.queueService.getQueuePosition(agentId, orderId);

    return {
      orderId,
      agentId,
      position,
      inQueue: position !== null,
    };
  }

  // DELETE /queue/agents/:agentId/orders/:orderId — 取消排队（A only）
  @Delete('agents/:agentId/orders/:orderId')
  async cancelQueue(
    @Headers('x-user-id') userId: string | undefined,
    @Param('agentId') agentId: string,
    @Param('orderId') orderId: string
  ) {
    if (!userId) {
      throw new ValidationError('x-user-id header is required');
    }

    // TODO: 验证 userId 是订单的创建者（需要查询 Order 表）
    // 暂时允许任何人取消，因为 Order 表可能还不可用

    await this.queueService.cancel(agentId, orderId);

    return {
      success: true,
      message: 'Queue item canceled',
    };
  }
}
