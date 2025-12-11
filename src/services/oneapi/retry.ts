/**
 * Retry Mechanism with Exponential Backoff
 *
 * Implements retry logic for network operations with configurable
 * retry count and exponential backoff.
 *
 * Requirements: 10.3
 * Property 25: Retry on network timeout
 */

import { pino } from '@/libs/logger';

import { OneAPIError, OneAPIErrorCode, parseError } from './errors';

// Create a child logger for retry operations
const logger = pino.child({ module: 'oneapi-retry' });

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in milliseconds (default: 10000) */
  maxDelay?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Whether to add jitter to delays (default: true) */
  jitter?: boolean;
  /** Custom function to determine if error is retryable */
  isRetryable?: (error: OneAPIError) => boolean;
  /** Callback called before each retry */
  onRetry?: (error: OneAPIError, attempt: number, delay: number) => void;
}

/**
 * Default retry options
 */
const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'isRetryable' | 'onRetry'>> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Calculate delay with exponential backoff
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  backoffMultiplier: number,
  jitter: boolean,
): number {
  // Exponential backoff: initialDelay * (multiplier ^ attempt)
  let delay = initialDelay * Math.pow(backoffMultiplier, attempt);

  // Cap at maxDelay
  delay = Math.min(delay, maxDelay);

  // Add jitter (±25% randomization)
  if (jitter) {
    const jitterFactor = 0.75 + Math.random() * 0.5; // 0.75 to 1.25
    delay = Math.floor(delay * jitterFactor);
  }

  return delay;
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Default retryable check - uses the error's retryable property
 */
function defaultIsRetryable(error: OneAPIError): boolean {
  return error.retryable;
}

/**
 * Execute a function with retry logic
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns The result of the function
 * @throws OneAPIError if all retries fail
 *
 * Requirements: 10.3
 * Property 25: Retry on network timeout
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = DEFAULT_OPTIONS.maxRetries,
    initialDelay = DEFAULT_OPTIONS.initialDelay,
    maxDelay = DEFAULT_OPTIONS.maxDelay,
    backoffMultiplier = DEFAULT_OPTIONS.backoffMultiplier,
    jitter = DEFAULT_OPTIONS.jitter,
    isRetryable = defaultIsRetryable,
    onRetry,
  } = options;

  let lastError: OneAPIError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const oneapiError = parseError(error);
      lastError = oneapiError;

      // Check if we should retry
      const shouldRetry = attempt < maxRetries && isRetryable(oneapiError);

      if (!shouldRetry) {
        // Log final failure
        logger.error(
          {
            code: oneapiError.code,
            message: oneapiError.message,
            attempt: attempt + 1,
            maxRetries: maxRetries + 1,
            retryable: oneapiError.retryable,
          },
          'Operation failed after all retries',
        );
        throw oneapiError;
      }

      // Calculate delay for next retry
      const delay = calculateDelay(attempt, initialDelay, maxDelay, backoffMultiplier, jitter);

      // Log retry attempt
      logger.warn(
        {
          code: oneapiError.code,
          message: oneapiError.message,
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
          nextRetryIn: delay,
        },
        `Retry attempt ${attempt + 1}/${maxRetries + 1} after ${delay}ms`,
      );

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(oneapiError, attempt + 1, delay);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new OneAPIError(OneAPIErrorCode.UNKNOWN);
}

/**
 * Create a retryable version of an async function
 *
 * @param fn - The async function to wrap
 * @param options - Retry configuration options
 * @returns A new function that will retry on failure
 */
export function createRetryable<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions = {},
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => withRetry(() => fn(...args), options);
}

/**
 * Retry decorator options for class methods
 */
export interface RetryDecoratorOptions extends RetryOptions {
  /** Name of the operation for logging */
  operationName?: string;
}

/**
 * Create a retry wrapper for a specific operation
 *
 * @param operationName - Name of the operation for logging
 * @param options - Retry configuration options
 * @returns A function that wraps async operations with retry logic
 */
export function createRetryWrapper(
  operationName: string,
  options: RetryOptions = {},
): <T>(fn: () => Promise<T>) => Promise<T> {
  return <T>(fn: () => Promise<T>) =>
    withRetry(fn, {
      ...options,
      onRetry: (error, attempt, delay) => {
        logger.info(
          {
            operation: operationName,
            code: error.code,
            attempt,
            delay,
          },
          `Retrying ${operationName}`,
        );
        options.onRetry?.(error, attempt, delay);
      },
    });
}
