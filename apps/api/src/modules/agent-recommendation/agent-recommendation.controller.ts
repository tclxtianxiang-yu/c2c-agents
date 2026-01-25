import { Body, Controller, Inject, Post } from '@nestjs/common';
import { AgentRecommendationService } from './agent-recommendation.service';
import type { RecommendAgentsDto } from './dtos/recommend-agents.dto';

@Controller('agents')
export class AgentRecommendationController {
  constructor(
    @Inject(AgentRecommendationService)
    private readonly recommendationService: AgentRecommendationService
  ) {}

  /**
   * POST /agents/recommend
   * 基于 Task 信息推荐最优 Agent
   */
  @Post('recommend')
  async recommendAgents(@Body() dto: RecommendAgentsDto) {
    const result = await this.recommendationService.recommendAgentsForTask({
      title: dto.title,
      description: dto.description,
      type: dto.type,
      tags: dto.tags ?? [],
      expectedReward: dto.expectedReward,
    });

    return {
      candidates: result.candidates.map((c) => ({
        agent: c.agent,
        similarity: c.similarity,
        score: c.score,
      })),
      recommended: result.recommended.map((r) => ({
        agent: r.agent,
        similarity: r.similarity,
        score: r.score,
      })),
    };
  }
}
