import { Global, Module } from '@nestjs/common';
import { ChainService } from './chain.service';
import { HealthController } from './health.controller';

@Global()
@Module({
  controllers: [HealthController],
  providers: [ChainService],
  exports: [ChainService],
})
export class CoreModule {}
