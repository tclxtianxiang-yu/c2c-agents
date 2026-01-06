import { Injectable, type NestMiddleware } from '@nestjs/common';

@Injectable()
export class AuthPlaceholderMiddleware implements NestMiddleware {
  use(_req: unknown, _res: unknown, next: () => void): void {
    next();
  }
}
