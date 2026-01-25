import { Module } from '@nestjs/common';
import { ExecutionModule } from '../execution/execution.module';
import { MastraModule } from '../mastra/mastra.module';
import { MatchingController } from './matching.controller';
import { MatchingRepository } from './matching.repository';
import { MatchingService } from './matching.service';
import { PairingService } from './pairing.service';
import { QueueService } from './queue.service';

@Module({
  imports: [ExecutionModule, MastraModule],
  controllers: [MatchingController],
  providers: [MatchingService, MatchingRepository, PairingService, QueueService],
  exports: [MatchingService, PairingService, QueueService],
})
export class MatchingModule {}
