import { ValidationError } from '@c2c-agents/shared';
import { Body, Controller, Get, Headers, Inject, Post, Query } from '@nestjs/common';
import type { AutoMatchDto } from './dtos/auto-match.dto';
import type { ManualMatchDto } from './dtos/manual-match.dto';
import { MatchingService } from './matching.service';

@Controller('matching')
export class MatchingController {
  constructor(@Inject(MatchingService) private readonly matchingService: MatchingService) {}

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
}
