import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { EmbeddingModule } from '../embedding/embedding.module';
import { AgentEmbeddingRepository } from './agent-embedding.repository';
import { AgentEmbeddingService } from './agent-embedding.service';

@Module({
  imports: [DatabaseModule, EmbeddingModule],
  providers: [AgentEmbeddingRepository, AgentEmbeddingService],
  exports: [AgentEmbeddingService],
})
export class AgentEmbeddingModule {}
