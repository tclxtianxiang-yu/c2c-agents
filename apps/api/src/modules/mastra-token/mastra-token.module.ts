import { Module } from '@nestjs/common';
import { MastraTokenController } from './mastra-token.controller';
import { MastraTokenRepository } from './mastra-token.repository';
import { MastraTokenService } from './mastra-token.service';

@Module({
  controllers: [MastraTokenController],
  providers: [MastraTokenService, MastraTokenRepository],
  exports: [MastraTokenService],
})
export class MastraTokenModule {}
