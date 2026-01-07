import { randomUUID } from 'node:crypto';
import { Injectable, type NestMiddleware } from '@nestjs/common';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(
    req: {
      header?: (name: string) => string | undefined;
      headers?: Record<string, string | string[] | undefined>;
      requestId?: string;
    },
    res: { setHeader: (name: string, value: string) => void },
    next: () => void
  ): void {
    const headerId = req.header?.('x-request-id') ?? null;
    const requestId = headerId?.trim() ? headerId : randomUUID();

    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  }
}
