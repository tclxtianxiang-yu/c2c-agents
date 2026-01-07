import {
  ContractInteractionError,
  ErrorCode,
  IdempotencyViolationError,
  toApiError,
  ValidationError,
} from '@c2c-agents/shared';
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<{
      status: (code: number) => { json: (body: unknown) => void };
    }>();
    const request = ctx.getRequest<{
      headers?: Record<string, string | string[] | undefined>;
      requestId?: string;
    }>();

    const apiError = toApiError(exception);
    let statusCode = apiError.statusCode;
    let code = apiError.code;
    let message = apiError.message;

    if (exception instanceof ValidationError) {
      statusCode = 400;
    } else if (exception instanceof IdempotencyViolationError) {
      statusCode = 409;
    } else if (exception instanceof ContractInteractionError) {
      statusCode = 500;
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const response = exception.getResponse();
      if (response && typeof response === 'object' && 'code' in response && 'message' in response) {
        const payload = response as { code: string; message: string };
        code = payload.code;
        message = payload.message;
      } else {
        message = exception.message;
        code = ErrorCode.VALIDATION_FAILED;
      }
    }

    response.status(statusCode).json({
      code,
      message,
      requestId: request.requestId ?? request.headers?.['x-request-id'],
    });
  }
}
