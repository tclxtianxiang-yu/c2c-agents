import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { AgentEmbeddingModule } from '../agent-embedding/agent-embedding.module';
import { AgentRecommendationController } from './agent-recommendation.controller';
import { AgentRecommendationService } from './agent-recommendation.service';

@Module({
  imports: [AgentEmbeddingModule, AgentModule],
  controllers: [AgentRecommendationController],
  providers: [AgentRecommendationService],
  exports: [AgentRecommendationService],
})
export class AgentRecommendationModule {}
