import { describe, expect, it } from 'vitest';
import {
  AppError,
  ContractInteractionError,
  ErrorCode,
  IdempotencyViolationError,
  InsufficientBalanceError,
  InvalidTransitionError,
  PaymentVerificationError,
  toApiError,
  ValidationError,
} from './index';

describe('错误码枚举', () => {
  it('应该定义所有错误码', () => {
    expect(ErrorCode.AUTH_UNAUTHORIZED).toBe('AUTH_UNAUTHORIZED');
    expect(ErrorCode.VALIDATION_FAILED).toBe('VALIDATION_FAILED');
    expect(ErrorCode.PAYMENT_VERIFICATION_FAILED).toBe('PAYMENT_VERIFICATION_FAILED');
    expect(ErrorCode.CONTRACT_CALL_FAILED).toBe('CONTRACT_CALL_FAILED');
    expect(ErrorCode.BUSINESS_IDEMPOTENCY_VIOLATION).toBe('BUSINESS_IDEMPOTENCY_VIOLATION');
    expect(ErrorCode.SYSTEM_INTERNAL_ERROR).toBe('SYSTEM_INTERNAL_ERROR');
  });

  it('应该按类别组织错误码', () => {
    // AUTH
    expect(ErrorCode.AUTH_UNAUTHORIZED).toContain('AUTH_');
    expect(ErrorCode.AUTH_FORBIDDEN).toContain('AUTH_');

    // PAYMENT
    expect(ErrorCode.PAYMENT_VERIFICATION_FAILED).toContain('PAYMENT_');
    expect(ErrorCode.PAYMENT_INSUFFICIENT_BALANCE).toContain('PAYMENT_');

    // CONTRACT
    expect(ErrorCode.CONTRACT_CALL_FAILED).toContain('CONTRACT_');
    expect(ErrorCode.CONTRACT_REVERT).toContain('CONTRACT_');

    // BUSINESS
    expect(ErrorCode.BUSINESS_IDEMPOTENCY_VIOLATION).toContain('BUSINESS_');
    expect(ErrorCode.BUSINESS_RESOURCE_NOT_FOUND).toContain('BUSINESS_');

    // SYSTEM
    expect(ErrorCode.SYSTEM_INTERNAL_ERROR).toContain('SYSTEM_');
  });
});

describe('AppError 基类', () => {
  // 创建具体子类用于测试
  class TestError extends AppError {
    constructor(message: string, details?: unknown) {
      super(message, ErrorCode.VALIDATION_FAILED, 400, details);
    }
  }

  it('应该正确设置 code 和 statusCode', () => {
    const error = new TestError('test message');
    expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('test message');
  });

  it('应该正确设置 details', () => {
    const details = { field: 'email', reason: 'invalid' };
    const error = new TestError('test', details);
    expect(error.details).toEqual(details);
  });

  it('应该正确设置 name 为类名', () => {
    const error = new TestError('test');
    expect(error.name).toBe('TestError');
  });

  it('应该是 Error 的实例', () => {
    const error = new TestError('test');
    expect(error instanceof Error).toBe(true);
    expect(error instanceof AppError).toBe(true);
  });

  it('应该保持正确的原型链', () => {
    const error = new TestError('test');
    expect(Object.getPrototypeOf(error)).toBe(TestError.prototype);
  });
});

describe('InvalidTransitionError', () => {
  it('应该正确格式化错误消息', () => {
    const error = new InvalidTransitionError('Pending', 'Completed');
    expect(error.message).toBe('Invalid transition: Pending -> Completed');
  });

  it('应该设置正确的错误码和状态码', () => {
    const error = new InvalidTransitionError('A', 'B');
    expect(error.code).toBe(ErrorCode.VALIDATION_INVALID_TRANSITION);
    expect(error.statusCode).toBe(400);
  });

  it('应该包含 from/to 在 details 中', () => {
    const error = new InvalidTransitionError('StateA', 'StateB');
    expect(error.details).toEqual({ from: 'StateA', to: 'StateB' });
  });

  it('应该是 AppError 的实例', () => {
    const error = new InvalidTransitionError('A', 'B');
    expect(error instanceof AppError).toBe(true);
  });
});

describe('ValidationError', () => {
  it('应该正确设置错误消息', () => {
    const error = new ValidationError('Invalid input');
    expect(error.message).toBe('Invalid input');
  });

  it('应该设置正确的错误码和状态码', () => {
    const error = new ValidationError('test');
    expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(error.statusCode).toBe(400);
  });

  it('应该支持可选的 details', () => {
    const details = { field: 'email' };
    const error = new ValidationError('test', details);
    expect(error.details).toEqual(details);
  });
});

describe('PaymentVerificationError', () => {
  it('应该设置正确的错误码和状态码', () => {
    const error = new PaymentVerificationError('Payment verification failed');
    expect(error.code).toBe(ErrorCode.PAYMENT_VERIFICATION_FAILED);
    expect(error.statusCode).toBe(400);
  });

  it('应该支持 details', () => {
    const details = { txHash: '0x123', expectedAmount: '1000000' };
    const error = new PaymentVerificationError('Amount mismatch', details);
    expect(error.details).toEqual(details);
  });
});

describe('InsufficientBalanceError', () => {
  it('应该设置正确的错误码和状态码', () => {
    const error = new InsufficientBalanceError('Insufficient balance');
    expect(error.code).toBe(ErrorCode.PAYMENT_INSUFFICIENT_BALANCE);
    expect(error.statusCode).toBe(400);
  });

  it('应该支持 details', () => {
    const details = { required: '1000000', available: '500000' };
    const error = new InsufficientBalanceError('Not enough funds', details);
    expect(error.details).toEqual(details);
  });
});

describe('ContractInteractionError', () => {
  it('应该设置正确的错误码和状态码', () => {
    const error = new ContractInteractionError('Contract call failed');
    expect(error.code).toBe(ErrorCode.CONTRACT_CALL_FAILED);
    expect(error.statusCode).toBe(500);
  });

  it('应该支持 details', () => {
    const details = { method: 'payout', reason: 'revert' };
    const error = new ContractInteractionError('Revert', details);
    expect(error.details).toEqual(details);
  });
});

describe('IdempotencyViolationError', () => {
  it('应该设置正确的错误码和状态码', () => {
    const error = new IdempotencyViolationError('Duplicate operation');
    expect(error.code).toBe(ErrorCode.BUSINESS_IDEMPOTENCY_VIOLATION);
    expect(error.statusCode).toBe(409);
  });

  it('应该支持 details', () => {
    const details = { txHash: '0xabc', orderId: 'uuid-123' };
    const error = new IdempotencyViolationError('Already processed', details);
    expect(error.details).toEqual(details);
  });
});

describe('toApiError', () => {
  it('应该转换 AppError 为 API 响应', () => {
    const error = new ValidationError('Invalid input', { field: 'email' });
    const apiError = toApiError(error);

    expect(apiError.statusCode).toBe(400);
    expect(apiError.error.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(apiError.error.message).toBe('Invalid input');
    expect(apiError.error.details).toEqual({ field: 'email' });
  });

  it('应该转换标准 Error 为 API 响应', () => {
    const error = new Error('Something went wrong');
    const apiError = toApiError(error);

    expect(apiError.statusCode).toBe(500);
    expect(apiError.error.code).toBe(ErrorCode.SYSTEM_INTERNAL_ERROR);
    expect(apiError.error.message).toBe('Something went wrong');
    expect(apiError.error.details).toBeUndefined();
  });

  it('应该转换未知错误为 API 响应（默认不包含 details）', () => {
    const error = { unexpected: 'error object' };
    const apiError = toApiError(error);

    expect(apiError.statusCode).toBe(500);
    expect(apiError.error.code).toBe(ErrorCode.SYSTEM_INTERNAL_ERROR);
    expect(apiError.error.message).toBe('An unknown error occurred');
    expect(apiError.error.details).toBeUndefined();
  });

  it('应该在 includeUnknownDetails=true 时包含未知错误 details', () => {
    const error = { unexpected: 'error object', stack: 'sensitive info' };
    const apiError = toApiError(error, { includeUnknownDetails: true });

    expect(apiError.statusCode).toBe(500);
    expect(apiError.error.details).toEqual(error);
  });

  it('应该不包含 stack（避免泄露敏感信息）', () => {
    const error = new Error('Test error');
    const apiError = toApiError(error);

    expect(apiError.error).not.toHaveProperty('stack');
  });

  it('应该处理字符串错误', () => {
    const error = 'String error';
    const apiError = toApiError(error);

    expect(apiError.statusCode).toBe(500);
    expect(apiError.error.code).toBe(ErrorCode.SYSTEM_INTERNAL_ERROR);
    expect(apiError.error.message).toBe('An unknown error occurred');
  });

  it('应该处理 null/undefined 错误', () => {
    const apiError1 = toApiError(null);
    expect(apiError1.statusCode).toBe(500);

    const apiError2 = toApiError(undefined);
    expect(apiError2.statusCode).toBe(500);
  });

  it('应该保留 AppError 的所有字段', () => {
    const error = new PaymentVerificationError('TX not found', {
      txHash: '0x123',
      expectedAmount: '1000000',
    });
    const apiError = toApiError(error);

    expect(apiError.statusCode).toBe(400);
    expect(apiError.error.code).toBe(ErrorCode.PAYMENT_VERIFICATION_FAILED);
    expect(apiError.error.message).toBe('TX not found');
    expect(apiError.error.details).toEqual({
      txHash: '0x123',
      expectedAmount: '1000000',
    });
  });
});
