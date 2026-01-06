import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { validateApiEnv } from './config/env';

async function bootstrap() {
  validateApiEnv();
  const app = await NestFactory.create(AppModule);
  await app.listen(3001);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
