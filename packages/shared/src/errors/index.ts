// ============================================================
// 错误码枚举
// ============================================================

/**
 * 统一错误码枚举
 *
 * 命名规范：CATEGORY_SPECIFIC_REASON
 * - AUTH_*: 认证/授权错误
 * - VALIDATION_*: 参数校验错误
 * - PAYMENT_*: 支付相关错误
 * - CONTRACT_*: 合约交互错误
 * - BUSINESS_*: 业务逻辑错误
 * - SYSTEM_*: 系统错误
 */
export enum ErrorCode {
  // 认证/授权错误 (1000-1999)
  AUTH_UNAUTHORIZED = 'AUTH_UNAUTHORIZED',
  AUTH_FORBIDDEN = 'AUTH_FORBIDDEN',

  // 参数校验错误 (2000-2999)
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  VALIDATION_INVALID_TRANSITION = 'VALIDATION_INVALID_TRANSITION',

  // 支付相关错误 (3000-3999)
  PAYMENT_VERIFICATION_FAILED = 'PAYMENT_VERIFICATION_FAILED',
  PAYMENT_INSUFFICIENT_BALANCE = 'PAYMENT_INSUFFICIENT_BALANCE',
  PAYMENT_TX_NOT_FOUND = 'PAYMENT_TX_NOT_FOUND',
  PAYMENT_AMOUNT_MISMATCH = 'PAYMENT_AMOUNT_MISMATCH',

  // 合约交互错误 (4000-4999)
  CONTRACT_CALL_FAILED = 'CONTRACT_CALL_FAILED',
  CONTRACT_REVERT = 'CONTRACT_REVERT',
  CONTRACT_NETWORK_ERROR = 'CONTRACT_NETWORK_ERROR',

  // 业务逻辑错误 (5000-5999)
  BUSINESS_IDEMPOTENCY_VIOLATION = 'BUSINESS_IDEMPOTENCY_VIOLATION',
  BUSINESS_RESOURCE_NOT_FOUND = 'BUSINESS_RESOURCE_NOT_FOUND',
  BUSINESS_OPERATION_NOT_ALLOWED = 'BUSINESS_OPERATION_NOT_ALLOWED',

  // 系统错误 (9000-9999)
  SYSTEM_INTERNAL_ERROR = 'SYSTEM_INTERNAL_ERROR',
  SYSTEM_DATABASE_ERROR = 'SYSTEM_DATABASE_ERROR',
}

// ============================================================
// 基础错误类
// ============================================================

/**
 * 应用基础错误类
 *
 * 所有业务错误都应继承此类，以便统一处理
 */
export abstract class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, code: ErrorCode, statusCode: number, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // 保持正确的原型链（TypeScript 继承 Error 的常见问题）
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ============================================================
// 原有错误类（重构为 AppError 子类）
// ============================================================

/**
 * 状态机非法转换错误
 */
export class InvalidTransitionError extends AppError {
  constructor(from: string, to: string) {
    super(`Invalid transition: ${from} -> ${to}`, ErrorCode.VALIDATION_INVALID_TRANSITION, 400, {
      from,
      to,
    });
  }
}

/**
 * 参数校验错误
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.VALIDATION_FAILED, 400, details);
  }
}

// ============================================================
// 新增业务错误类
// ============================================================

/**
 * 支付校验失败错误
 *
 * 场景：
 * - 链上 tx 不存在
 * - tx 金额与订单不符
 * - tx 接收地址错误
 * - tx 未确认
 */
export class PaymentVerificationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.PAYMENT_VERIFICATION_FAILED, 400, details);
  }
}

/**
 * 余额不足错误
 *
 * 场景：
 * - 用户钱包余额不足
 * - Escrow 合约余额不足（用于 payout）
 */
export class InsufficientBalanceError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.PAYMENT_INSUFFICIENT_BALANCE, 400, details);
  }
}

/**
 * 合约调用失败错误
 *
 * 场景：
 * - 合约 revert
 * - 网络错误
 * - Gas 不足
 * - Nonce 错误
 */
export class ContractInteractionError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.CONTRACT_CALL_FAILED, 500, details);
  }
}

/**
 * 幂等性违规错误
 *
 * 场景：
 * - 重复提交相同 txHash
 * - 重复执行已完成的操作
 */
export class IdempotencyViolationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.BUSINESS_IDEMPOTENCY_VIOLATION, 409, details);
  }
}

// ============================================================
// 错误格式化工具
// ============================================================

/**
 * API 错误响应格式
 */
export interface ApiErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

/**
 * 将错误转换为 API 响应格式
 *
 * @param error - 原始错误对象
 * @param options - 可选配置
 * @param options.includeUnknownDetails - 是否在未知错误中包含 details（仅用于开发/调试环境）
 * @returns API 错误响应对象
 *
 * @example
 * ```typescript
 * try {
 *   // 业务逻辑
 * } catch (error) {
 *   const apiError = toApiError(error);
 *   return Response.json(apiError, { status: apiError.statusCode });
 * }
 * ```
 *
 * @example
 * ```typescript
 * // 开发环境启用详细错误信息
 * const isDev = process.env.NODE_ENV === 'development';
 * const apiError = toApiError(error, { includeUnknownDetails: isDev });
 * ```
 */
export function toApiError(
  error: unknown,
  options?: { includeUnknownDetails?: boolean }
): ApiErrorResponse & { statusCode: number } {
  // AppError 子类
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };
  }

  // 标准 Error
  if (error instanceof Error) {
    return {
      statusCode: 500,
      error: {
        code: ErrorCode.SYSTEM_INTERNAL_ERROR,
        message: error.message,
        // 不包含 stack，避免泄露内部实现细节
      },
    };
  }

  // 未知错误（生产环境不返回 details，避免泄露敏感信息）
  return {
    statusCode: 500,
    error: {
      code: ErrorCode.SYSTEM_INTERNAL_ERROR,
      message: 'An unknown error occurred',
      ...(options?.includeUnknownDetails && { details: error }),
    },
  };
}
