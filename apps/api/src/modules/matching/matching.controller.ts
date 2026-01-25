import { ValidationError } from '@c2c-agents/shared';
import { Body, Controller, Get, Headers, Inject, Param, Post, Query } from '@nestjs/common';
import type { AutoMatchDto } from './dtos/auto-match.dto';
import type { ManualMatchDto } from './dtos/manual-match.dto';
import type { CancelQueueDto, PairingActionDto } from './dtos/pairing.dto';
import { MatchingRepository } from './matching.repository';
import { MatchingService } from './matching.service';
import { PairingService } from './pairing.service';
import { QueueService } from './queue.service';

@Controller('matching')
export class MatchingController {
  constructor(
    @Inject(MatchingService) private readonly matchingService: MatchingService,
    @Inject(PairingService) private readonly pairingService: PairingService,
    @Inject(MatchingRepository) private readonly repository: MatchingRepository,
    @Inject(QueueService) private readonly queueService: QueueService
  ) {}

  @Post('auto')
  autoMatch(@Headers('x-user-id') userId: string | undefined, @Body() body: AutoMatchDto) {
    if (!userId) {
      throw new ValidationError('x-user-id header is required');
    }
    return this.matchingService.autoMatch(userId, body.taskId);
  }

  @Post('manual')
  manualMatch(@Headers('x-user-id') userId: string | undefined, @Body() body: ManualMatchDto) {
    if (!userId) {
      throw new ValidationError('x-user-id header is required');
    }
    return this.matchingService.manualSelect(userId, body.taskId, body.agentId);
  }

  @Get('candidates')
  listCandidates(
    @Headers('x-user-id') userId: string | undefined,
    @Query('taskId') taskId: string | undefined
  ) {
    if (!userId) {
      throw new ValidationError('x-user-id header is required');
    }
    if (!taskId) {
      throw new ValidationError('taskId is required');
    }
    return this.matchingService.listCandidates(userId, taskId);
  }

  /**
   * 同意 Pairing
   * POST /matching/pairing/accept
   *
   * @example
   * ```
   * POST /matching/pairing/accept
   * Headers: { "x-user-id": "user-uuid-or-wallet-address" }
   * Body: { "orderId": "order-uuid", "role": "A" }
   * ```
   */
  @Post('pairing/accept')
  acceptPairing(@Headers('x-user-id') userId: string | undefined, @Body() body: PairingActionDto) {
    if (!userId) {
      throw new ValidationError('x-user-id header is required');
    }
    return this.pairingService.acceptPairing(body.orderId, userId, body.role);
  }

  /**
   * 拒绝 Pairing
   * POST /matching/pairing/reject
   *
   * @example
   * ```
   * POST /matching/pairing/reject
   * Headers: { "x-user-id": "user-uuid-or-wallet-address" }
   * Body: { "orderId": "order-uuid", "role": "B" }
   * ```
   */
  @Post('pairing/reject')
  rejectPairing(@Headers('x-user-id') userId: string | undefined, @Body() body: PairingActionDto) {
    if (!userId) {
      throw new ValidationError('x-user-id header is required');
    }
    return this.pairingService.rejectPairing(body.orderId, userId, body.role);
  }

  /**
   * 取消排队
   * POST /matching/queue/cancel
   *
   * @example
   * ```
   * POST /matching/queue/cancel
   * Headers: { "x-user-id": "user-uuid-or-wallet-address" }
   * Body: { "orderId": "order-uuid" }
   * ```
   */
  @Post('queue/cancel')
  async cancelQueue(
    @Headers('x-user-id') userId: string | undefined,
    @Body() body: CancelQueueDto
  ) {
    if (!userId) {
      throw new ValidationError('x-user-id header is required');
    }

    // 校验 Order 归属
    const order = await this.repository.findOrderById(body.orderId);
    if (!order) {
      throw new ValidationError('Order not found');
    }

    if (order.creator_id !== userId) {
      throw new ValidationError('Order does not belong to current user');
    }

    // 取消所有该 Order 的排队项
    if (order.agent_id) {
      await this.repository.cancelQueueItem(order.agent_id, body.orderId);
    }

    return {
      orderId: body.orderId,
      status: 'canceled',
      message: 'Queue item canceled successfully',
    };
  }

  /**
   * 获取 Order 的 Pairing 信息
   * GET /matching/pairing/:orderId
   *
   * @example
   * ```
   * GET /matching/pairing/order-uuid
   * Headers: { "x-user-id": "user-uuid-or-wallet-address" }
   * ```
   */
  @Get('pairing/:orderId')
  async getPairingInfo(
    @Headers('x-user-id') userId: string | undefined,
    @Param('orderId') orderId: string
  ) {
    if (!userId) {
      throw new ValidationError('x-user-id header is required');
    }

    const order = await this.repository.findOrderById(orderId);
    if (!order) {
      throw new ValidationError('Order not found');
    }

    // 权限校验：只有 creator 或 provider 可以查看
    if (order.creator_id !== userId && order.provider_id !== userId) {
      throw new ValidationError('No permission to view this pairing');
    }

    // 如果不在 Pairing 状态，返回空
    if (order.status !== 'Pairing') {
      return {
        orderId,
        status: order.status,
        pairing: null,
      };
    }

    // 获取 Agent 信息
    let agent = null;
    if (order.agent_id) {
      agent = await this.repository.findAgentById(order.agent_id);
    }

    return {
      orderId,
      status: order.status,
      pairing: {
        agentId: order.agent_id,
        agentName: agent?.name,
        providerId: order.provider_id,
        pairingCreatedAt: order.pairing_created_at,
        // 计算过期时间
        expiresAt: order.pairing_created_at
          ? new Date(
              new Date(order.pairing_created_at).getTime() + 24 * 60 * 60 * 1000
            ).toISOString()
          : null,
      },
    };
  }

  /**
   * 消费队列中的下一个 Order
   * POST /matching/queue/consume-next/:agentId
   *
   * @example
   * ```
   * POST /matching/queue/consume-next/agent-uuid
   * Headers: { "x-user-id": "user-uuid-or-wallet-address" }
   * ```
   *
   * 注意：此端点主要由 Settlement 模块在订单完成后调用
   * 也可以由 Agent Owner 手动触发（如果需要的话）
   */
  @Post('queue/consume-next/:agentId')
  async consumeNext(
    @Headers('x-user-id') userId: string | undefined,
    @Param('agentId') agentId: string
  ) {
    if (!userId) {
      throw new ValidationError('x-user-id header is required');
    }

    // 校验 Agent 归属（可选：只有 Agent Owner 可以触发消费）
    const agent = await this.repository.findAgentById(agentId);
    if (!agent) {
      throw new ValidationError('Agent not found');
    }

    // 如果需要权限校验，可以取消注释以下代码
    // if (agent.owner_id !== userId) {
    //   throw new ValidationError('Only agent owner can trigger queue consumption');
    // }

    return this.queueService.consumeNext(agentId);
  }
}
