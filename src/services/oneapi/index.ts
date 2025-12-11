import { pino } from '@/libs/logger';

import { logError, OneAPIError, OneAPIErrorCode, parseError } from './errors';
import { RetryOptions, withRetry } from './retry';
import type {
  LoginResult,
  LogsResult,
  RegisterData,
  RegisterResult,
  Statistics,
  TopupHistoryResult,
  TopupOrder,
  UserInfo,
} from './types';

// Create a child logger for OneAPI service
const logger = pino.child({ module: 'oneapi-service' });

/**
 * OneAPI Service Configuration
 */
export interface OneAPIServiceConfig {
  /** Base URL for one-api (default: from env or http://one-api:3000) */
  baseURL?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Maximum retry attempts for retryable errors (default: 3) */
  maxRetries?: number;
  /** Initial retry delay in milliseconds (default: 1000) */
  initialRetryDelay?: number;
  /** Whether to enable retry logic (default: true) */
  enableRetry?: boolean;
}

/**
 * OneAPI Service
 * 封装所有 one-api API 调用
 *
 * Features:
 * - Automatic error handling and logging (Requirements: 10.1)
 * - Retry with exponential backoff (Requirements: 10.3)
 * - User-friendly error messages
 */
export class OneAPIService {
  private baseURL: string;
  private timeout: number;
  private maxRetries: number;
  private initialRetryDelay: number;
  private enableRetry: boolean;

  constructor(config: OneAPIServiceConfig = {}) {
    // 从环境变量获取 one-api 地址，默认使用 docker-compose 内部地址
    // 在服务端使用环境变量，客户端使用传入的 baseURL
    const defaultURL =
      typeof window === 'undefined'
        ? ((globalThis as any).process?.env?.ONEAPI_BASE_URL as string | undefined) ||
          'http://one-api:3000'
        : 'http://localhost:3000';

    this.baseURL = config.baseURL || defaultURL;
    this.timeout = config.timeout ?? 30000;
    this.maxRetries = config.maxRetries ?? 3;
    this.initialRetryDelay = config.initialRetryDelay ?? 1000;
    this.enableRetry = config.enableRetry ?? true;
  }

  /**
   * Get retry options for requests
   */
  private getRetryOptions(operationName: string): RetryOptions {
    return {
      maxRetries: this.maxRetries,
      initialDelay: this.initialRetryDelay,
      onRetry: (error, attempt, delay) => {
        logger.warn(
          {
            operation: operationName,
            code: error.code,
            attempt,
            delay,
          },
          `Retrying ${operationName} (attempt ${attempt})`,
        );
      },
    };
  }

  /**
   * 通用请求方法 (内部使用，不带重试)
   */
  private async requestInternal<T>(
    endpoint: string,
    options: Record<string, any> = {},
    token?: string,
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      logger.debug(
        { endpoint, method: options.method || 'GET' },
        `OneAPI request: ${options.method || 'GET'} ${endpoint}`,
      );

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        // Parse HTTP error to OneAPIError
        const errorMessage = data.message || `HTTP ${response.status}: ${response.statusText}`;

        // Map HTTP status codes to error codes
        let errorCode: OneAPIErrorCode;
        switch (response.status) {
          case 401:
            errorCode = OneAPIErrorCode.UNAUTHORIZED;
            break;
          case 403:
            errorCode = OneAPIErrorCode.TOKEN_EXPIRED;
            break;
          case 404:
            errorCode = OneAPIErrorCode.USER_NOT_FOUND;
            break;
          case 409:
            errorCode = OneAPIErrorCode.DUPLICATE_USER;
            break;
          case 503:
            errorCode = OneAPIErrorCode.SERVICE_UNAVAILABLE;
            break;
          default:
            errorCode = response.status >= 500
              ? OneAPIErrorCode.SERVER_ERROR
              : OneAPIErrorCode.UNKNOWN;
        }

        throw new OneAPIError(errorCode, errorMessage, undefined, response.status);
      }

      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      // Already an OneAPIError, re-throw
      if (error instanceof OneAPIError) {
        throw error;
      }

      // Parse other errors
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new OneAPIError(OneAPIErrorCode.TIMEOUT, '请求超时', error, 408);
        }

        // Network errors
        if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
          throw new OneAPIError(OneAPIErrorCode.CONNECTION_REFUSED, undefined, error, 503);
        }

        throw parseError(error);
      }

      throw new OneAPIError(OneAPIErrorCode.UNKNOWN, '未知错误', undefined, 500);
    }
  }

  /**
   * 通用请求方法 (带重试逻辑)
   *
   * Requirements: 10.1, 10.3
   * Property 25: Retry on network timeout
   */
  private async request<T>(
    endpoint: string,
    options: Record<string, any> = {},
    token?: string,
    operationName: string = 'request',
  ): Promise<T> {
    const requestFn = () => this.requestInternal<T>(endpoint, options, token);

    if (!this.enableRetry) {
      return requestFn();
    }

    try {
      return await withRetry(requestFn, this.getRetryOptions(operationName));
    } catch (error) {
      // Log the final error
      const oneapiError = error instanceof OneAPIError ? error : parseError(error);
      logError(oneapiError, { operation: operationName, endpoint });
      throw oneapiError;
    }
  }

  /**
   * 用户注册
   * @param data 注册数据
   * @returns 注册结果
   */
  async register(data: RegisterData): Promise<RegisterResult> {
    return this.request<RegisterResult>(
      '/api/user/register',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      undefined,
      'register',
    );
  }

  /**
   * 用户登录
   * @param username 用户名
   * @param password 密码
   * @returns 登录结果（包含 token）
   */
  async login(username: string, password: string): Promise<LoginResult> {
    return this.request<LoginResult>(
      '/api/user/login',
      {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      },
      undefined,
      'login',
    );
  }

  /**
   * 获取用户信息（包含余额）
   * @param token OneAPI Token
   * @returns 用户信息
   */
  async getUserInfo(token: string): Promise<UserInfo> {
    return this.request<UserInfo>(
      '/api/user/self',
      {
        method: 'GET',
      },
      token,
      'getUserInfo',
    );
  }

  /**
   * 创建充值订单
   * @param token OneAPI Token
   * @param amount 充值金额（元）
   * @returns 充值订单信息
   */
  async createTopup(token: string, amount: number): Promise<TopupOrder> {
    return this.request<TopupOrder>(
      '/api/topup',
      {
        method: 'POST',
        body: JSON.stringify({ amount: Math.round(amount * 1000) }), // 转换为分
      },
      token,
      'createTopup',
    );
  }

  /**
   * 获取充值历史
   * @param token OneAPI Token
   * @param page 页码（从0开始）
   * @param pageSize 每页数量
   * @returns 充值历史
   */
  async getTopupHistory(
    token: string,
    page: number = 0,
    pageSize: number = 20,
  ): Promise<TopupHistoryResult> {
    return this.request<TopupHistoryResult>(
      `/api/topup?p=${page}&page_size=${pageSize}`,
      {
        method: 'GET',
      },
      token,
      'getTopupHistory',
    );
  }

  /**
   * 获取使用日志
   * @param token OneAPI Token
   * @param page 页码（从0开始）
   * @param pageSize 每页数量
   * @returns 使用日志
   */
  async getLogs(token: string, page: number = 0, pageSize: number = 20): Promise<LogsResult> {
    return this.request<LogsResult>(
      `/api/log?p=${page}&page_size=${pageSize}`,
      {
        method: 'GET',
      },
      token,
      'getLogs',
    );
  }

  /**
   * 获取统计数据
   * @param token OneAPI Token
   * @param startTime 开始时间戳（秒）
   * @param endTime 结束时间戳（秒）
   * @returns 统计数据
   */
  async getStatistics(token: string, startTime: number, endTime: number): Promise<Statistics> {
    return this.request<Statistics>(
      `/api/log/stat?start_timestamp=${startTime}&end_timestamp=${endTime}`,
      {
        method: 'GET',
      },
      token,
      'getStatistics',
    );
  }
}

// 导出单例实例
export const oneAPIService = new OneAPIService();

// Re-export error handling utilities
export {
  createErrorResponse,
  ERROR_MESSAGES,
  getErrorStatusCode,
  logError,
  OneAPIError,
  OneAPIErrorCode,
  parseError,
} from './errors';

// Re-export retry utilities
export { createRetryable, createRetryWrapper, withRetry } from './retry';
export type { RetryOptions } from './retry';

// Re-export transaction utilities
export {
  executeAtomically,
  TransactionRollbackHelper,
  withRollback,
  withTransaction,
} from './transaction';
export type { TransactionContext, TransactionOptions } from './transaction';
