/**
 * OneAPI Error Handling Module
 *
 * Provides custom error classes and error handling utilities for one-api integration.
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { pino } from '@/libs/logger';

// Create a child logger for OneAPI errors
const logger = pino.child({ module: 'oneapi' });

/**
 * Error codes for OneAPI operations
 */
export enum OneAPIErrorCode {
  ALREADY_SUBSCRIBED = 'ALREADY_SUBSCRIBED',
  CONNECTION_REFUSED = 'CONNECTION_REFUSED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  DUPLICATE_USER = 'DUPLICATE_USER',
  FEATURE_NOT_FOUND = 'FEATURE_NOT_FOUND',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  UNKNOWN = 'UNKNOWN',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
}

/**
 * User-friendly error messages in Chinese
 */
export const ERROR_MESSAGES: Record<OneAPIErrorCode, string> = {
  [OneAPIErrorCode.NETWORK_ERROR]: '网络连接失败，请检查网络后重试',
  [OneAPIErrorCode.TIMEOUT]: '请求超时，请稍后重试',
  [OneAPIErrorCode.CONNECTION_REFUSED]: '服务暂时不可用，请稍后重试',
  [OneAPIErrorCode.UNAUTHORIZED]: '认证失败，请重新登录',
  [OneAPIErrorCode.TOKEN_EXPIRED]: '登录已过期，请重新登录',
  [OneAPIErrorCode.INVALID_CREDENTIALS]: '用户名或密码错误',
  [OneAPIErrorCode.INSUFFICIENT_BALANCE]: '余额不足，请先充值',
  [OneAPIErrorCode.USER_NOT_FOUND]: '用户不存在',
  [OneAPIErrorCode.DUPLICATE_USER]: '用户名或邮箱已存在',
  [OneAPIErrorCode.FEATURE_NOT_FOUND]: '功能不存在',
  [OneAPIErrorCode.ALREADY_SUBSCRIBED]: '您已开通此功能',
  [OneAPIErrorCode.SERVER_ERROR]: '服务器错误，请稍后重试',
  [OneAPIErrorCode.SERVICE_UNAVAILABLE]: '服务暂时不可用，请稍后重试',
  [OneAPIErrorCode.DATABASE_ERROR]: '数据库操作失败，请稍后重试',
  [OneAPIErrorCode.TRANSACTION_FAILED]: '操作失败，请稍后重试',
  [OneAPIErrorCode.UNKNOWN]: '未知错误，请稍后重试',
};

/**
 * Custom error class for OneAPI operations
 */
export class OneAPIError extends Error {
  public readonly code: OneAPIErrorCode;
  public readonly userMessage: string;
  public readonly originalError?: Error;
  public readonly statusCode: number;
  public readonly retryable: boolean;

  constructor(
    code: OneAPIErrorCode,
    message?: string,
    originalError?: Error,
    statusCode: number = 500,
  ) {
    const userMessage = message || ERROR_MESSAGES[code];
    super(userMessage);

    this.name = 'OneAPIError';
    this.code = code;
    this.userMessage = userMessage;
    this.originalError = originalError;
    this.statusCode = statusCode;
    this.retryable = this.isRetryable(code);

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, OneAPIError);
    }
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryable(code: OneAPIErrorCode): boolean {
    const retryableCodes = [
      OneAPIErrorCode.NETWORK_ERROR,
      OneAPIErrorCode.TIMEOUT,
      OneAPIErrorCode.CONNECTION_REFUSED,
      OneAPIErrorCode.SERVER_ERROR,
      OneAPIErrorCode.SERVICE_UNAVAILABLE,
    ];
    return retryableCodes.includes(code);
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.userMessage,
      },
    };
  }
}

/**
 * Parse error from various sources and convert to OneAPIError
 */
export function parseError(error: unknown): OneAPIError {
  // Already an OneAPIError
  if (error instanceof OneAPIError) {
    return error;
  }

  // Standard Error
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network errors
    if (message.includes('timeout') || message.includes('aborted')) {
      return new OneAPIError(OneAPIErrorCode.TIMEOUT, undefined, error, 408);
    }

    if (message.includes('econnrefused') || message.includes('connection refused')) {
      return new OneAPIError(OneAPIErrorCode.CONNECTION_REFUSED, undefined, error, 503);
    }

    if (message.includes('network') || message.includes('fetch failed')) {
      return new OneAPIError(OneAPIErrorCode.NETWORK_ERROR, undefined, error, 503);
    }

    // Authentication errors
    if (message.includes('unauthorized') || message.includes('401')) {
      return new OneAPIError(OneAPIErrorCode.UNAUTHORIZED, undefined, error, 401);
    }

    if (message.includes('token') && message.includes('expired')) {
      return new OneAPIError(OneAPIErrorCode.TOKEN_EXPIRED, undefined, error, 401);
    }

    // Business logic errors
    if (message.includes('insufficient') || message.includes('余额不足')) {
      return new OneAPIError(OneAPIErrorCode.INSUFFICIENT_BALANCE, undefined, error, 400);
    }

    if (message.includes('not found') || message.includes('不存在')) {
      return new OneAPIError(OneAPIErrorCode.USER_NOT_FOUND, undefined, error, 404);
    }

    if (message.includes('duplicate') || message.includes('已存在')) {
      return new OneAPIError(OneAPIErrorCode.DUPLICATE_USER, undefined, error, 409);
    }

    // Server errors
    if (message.includes('500') || message.includes('internal server')) {
      return new OneAPIError(OneAPIErrorCode.SERVER_ERROR, undefined, error, 500);
    }

    if (message.includes('503') || message.includes('unavailable')) {
      return new OneAPIError(OneAPIErrorCode.SERVICE_UNAVAILABLE, undefined, error, 503);
    }

    // Database errors
    if (message.includes('database') || message.includes('sql') || message.includes('postgres')) {
      return new OneAPIError(OneAPIErrorCode.DATABASE_ERROR, undefined, error, 500);
    }

    // Unknown error with original message
    return new OneAPIError(OneAPIErrorCode.UNKNOWN, error.message, error, 500);
  }

  // Unknown error type
  return new OneAPIError(OneAPIErrorCode.UNKNOWN, String(error), undefined, 500);
}

/**
 * Log error with context
 * Requirements: 10.1
 */
export function logError(
  error: OneAPIError | Error,
  context?: Record<string, unknown>,
): void {
  const oneapiError = error instanceof OneAPIError ? error : parseError(error);

  const logData: Record<string, unknown> = {
    code: oneapiError.code,
    message: oneapiError.message,
    retryable: oneapiError.retryable,
    statusCode: oneapiError.statusCode,
    userMessage: oneapiError.userMessage,
    ...context,
  };

  // Include original error stack if available
  if (oneapiError.originalError) {
    logData.originalStack = oneapiError.originalError.stack;
  }

  logger.error(logData, `OneAPI Error: ${oneapiError.code}`);
}

/**
 * Create a user-friendly error response for API endpoints
 */
export function createErrorResponse(
  error: unknown,
  context?: Record<string, unknown>,
): { success: false; message: string; code: OneAPIErrorCode } {
  const oneapiError = error instanceof OneAPIError ? error : parseError(error);

  // Log the error
  logError(oneapiError, context);

  return {
    success: false,
    message: oneapiError.userMessage,
    code: oneapiError.code,
  };
}

/**
 * Get HTTP status code for an error
 */
export function getErrorStatusCode(error: unknown): number {
  if (error instanceof OneAPIError) {
    return error.statusCode;
  }
  return 500;
}
