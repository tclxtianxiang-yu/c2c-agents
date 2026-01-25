import { type Execution, ValidationError } from '@c2c-agents/shared';
import { Body, Controller, Get, Headers, Inject, Param, Post } from '@nestjs/common';
import type { SelectExecutionsDto } from './dtos/select-executions.dto';
import type { ExecutionWithAgent } from './execution.repository';
import { ExecutionService } from './execution.service';

function requireUserId(userId: string | undefined): asserts userId is string {
  if (!userId) {
    throw new ValidationError('x-user-id header is required');
  }
}

@Controller('execution')
export class ExecutionController {
  constructor(@Inject(ExecutionService) private readonly service: ExecutionService) {}

  /**
   * GET /execution/order/:orderId
   * Get all executions for an order with agent info
   */
  @Get('order/:orderId')
  async getExecutionsByOrder(
    @Headers('x-user-id') userId: string | undefined,
    @Param('orderId') orderId: string
  ): Promise<ExecutionWithAgent[]> {
    requireUserId(userId);
    return this.service.getExecutionsByOrder(userId, orderId);
  }

  /**
   * GET /execution/:executionId/status
   * Refresh and get single execution status
   */
  @Get(':executionId/status')
  async refreshExecutionStatus(@Param('executionId') executionId: string): Promise<Execution> {
    return this.service.refreshExecutionStatus(executionId);
  }

  /**
   * POST /execution/select
   * User selects execution results (0-3 selections)
   */
  @Post('select')
  async selectExecutions(
    @Headers('x-user-id') userId: string | undefined,
    @Body() dto: SelectExecutionsDto
  ): Promise<{
    selectedExecutions: Execution[];
    rejectedExecutions: Execution[];
  }> {
    requireUserId(userId);
    return this.service.selectExecutions(userId, dto);
  }
}
