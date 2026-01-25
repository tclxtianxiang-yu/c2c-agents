import { Module } from '@nestjs/common';
import { MatchingController } from './matching.controller';
import { MatchingRepository } from './matching.repository';
import { MatchingService } from './matching.service';
import { PairingService } from './pairing.service';
import { QueueService } from './queue.service';

@Module({
  controllers: [MatchingController],
  providers: [MatchingService, MatchingRepository, PairingService, QueueService],
  exports: [MatchingService, PairingService, QueueService],
})
export class MatchingModule {}
