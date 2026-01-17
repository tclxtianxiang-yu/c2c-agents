import { Module } from '@nestjs/common';
import { MatchingController } from './matching.controller';
import { MatchingRepository } from './matching.repository';
import { MatchingService } from './matching.service';

@Module({
  controllers: [MatchingController],
  providers: [MatchingService, MatchingRepository],
})
export class MatchingModule {}
