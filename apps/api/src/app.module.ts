import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthPlaceholderMiddleware } from './common/middleware/auth-placeholder.middleware';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { DatabaseModule } from './database/database.module';
import { AgentModule } from './modules/agent/agent.module';
import { AuthModule } from './modules/auth/auth.module';
import { CoreModule } from './modules/core/core.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { MastraTokenModule } from './modules/mastra-token/mastra-token.module';
import { MatchingModule } from './modules/matching/matching.module';
import { QueueModule } from './modules/queue/queue.module';
import { SettlementModule } from './modules/settlement/settlement.module';
import { TaskModule } from './modules/task/task.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // 默认加载 apps/api/.env 文件
    }),
    DatabaseModule,
    AgentModule,
    AuthModule,
    CoreModule,
    MastraTokenModule,
    DeliveryModule,
    MatchingModule,
    QueueModule,
    SettlementModule,
    TaskModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware, AuthPlaceholderMiddleware).forRoutes('*');
  }
}
