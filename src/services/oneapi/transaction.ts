/**
 * Database Transaction Utilities
 *
 * Provides transaction management with automatic rollback on errors.
 *
 * Requirements: 10.2, 10.4
 * Property 24: Transaction rollback on database failure
 * Property 26: Registration atomicity
 */

import { sql } from 'drizzle-orm';

import { getServerDB } from '@/database/core/db-adaptor';
import { pino } from '@/libs/logger';

import { OneAPIError, OneAPIErrorCode, logError, parseError } from './errors';

// Create a child logger for transaction operations
const logger = pino.child({ module: 'oneapi-transaction' });

/**
 * Transaction context passed to transaction callbacks
 */
export interface TransactionContext {
  /** Execute a SQL query within the transaction */
  execute: <T>(query: ReturnType<typeof sql>) => Promise<{ rows: T[] }>;
  /** Mark the transaction for rollback */
  markForRollback: () => void;
  /** Check if transaction is marked for rollback */
  isMarkedForRollback: () => boolean;
}

/**
 * Transaction options
 */
export interface TransactionOptions {
  /** Name of the operation for logging */
  operationName?: string;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Whether to log transaction events (default: true) */
  logging?: boolean;
}

/**
 * Execute a function within a database transaction
 *
 * This function ensures that all database operations within the callback
 * are executed atomically. If any operation fails, all changes are rolled back.
 *
 * @param callback - The function to execute within the transaction
 * @param options - Transaction options
 * @returns The result of the callback function
 * @throws OneAPIError if the transaction fails
 *
 * Requirements: 10.2
 * Property 24: Transaction rollback on database failure
 */
export async function withTransaction<T>(
  callback: (ctx: TransactionContext) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  const { operationName = 'transaction', logging = true } = options;

  const serverDB = await getServerDB();
  let shouldRollback = false;

  // Create transaction context
  const ctx: TransactionContext = {
    execute: async <R>(query: ReturnType<typeof sql>) => {
      const result = await serverDB.execute(query);
      return { rows: (result.rows || []) as R[] };
    },
    markForRollback: () => {
      shouldRollback = true;
    },
    isMarkedForRollback: () => shouldRollback,
  };

  if (logging) {
    logger.info({ operation: operationName }, `Starting transaction: ${operationName}`);
  }

  try {
    // Begin transaction
    await serverDB.execute(sql`BEGIN`);

    // Execute the callback
    const result = await callback(ctx);

    // Check if marked for rollback
    if (shouldRollback) {
      await serverDB.execute(sql`ROLLBACK`);
      if (logging) {
        logger.warn({ operation: operationName }, `Transaction rolled back (marked): ${operationName}`);
      }
      throw new OneAPIError(
        OneAPIErrorCode.TRANSACTION_FAILED,
        '操作已取消',
        undefined,
        400,
      );
    }

    // Commit transaction
    await serverDB.execute(sql`COMMIT`);

    if (logging) {
      logger.info({ operation: operationName }, `Transaction committed: ${operationName}`);
    }

    return result;
  } catch (error) {
    // Rollback on any error
    try {
      await serverDB.execute(sql`ROLLBACK`);
      if (logging) {
        logger.warn({ operation: operationName }, `Transaction rolled back (error): ${operationName}`);
      }
    } catch (rollbackError) {
      // Log rollback failure but don't mask the original error
      logger.error(
        { operation: operationName, error: rollbackError },
        `Failed to rollback transaction: ${operationName}`,
      );
    }

    // Convert to OneAPIError if needed
    const oneapiError = error instanceof OneAPIError ? error : parseError(error);

    // Log the error
    logError(oneapiError, { operation: operationName });

    // Re-throw as database error if it's not already an OneAPIError
    if (!(error instanceof OneAPIError)) {
      throw new OneAPIError(
        OneAPIErrorCode.DATABASE_ERROR,
        undefined,
        error instanceof Error ? error : undefined,
        500,
      );
    }

    throw oneapiError;
  }
}

/**
 * Execute multiple operations atomically
 *
 * If any operation fails, all previous operations are rolled back.
 * This is useful for multi-step processes like user registration.
 *
 * @param operations - Array of operations to execute
 * @param options - Transaction options
 * @returns Array of results from each operation
 *
 * Requirements: 10.4
 * Property 26: Registration atomicity
 */
export async function executeAtomically<T extends unknown[]>(
  operations: { [K in keyof T]: () => Promise<T[K]> },
  options: TransactionOptions = {},
): Promise<T> {
  const { operationName = 'atomic-operations', logging = true } = options;

  return withTransaction(
    async () => {
      const results: unknown[] = [];

      for (let i = 0; i < operations.length; i++) {
        if (logging) {
          logger.debug(
            { operation: operationName, step: i + 1, total: operations.length },
            `Executing step ${i + 1}/${operations.length}`,
          );
        }

        const result = await operations[i]();
        results.push(result);
      }

      return results as T;
    },
    { ...options, operationName },
  );
}

/**
 * Rollback helper for manual transaction management
 *
 * This is useful when you need to perform cleanup operations
 * that should be rolled back if subsequent operations fail.
 */
export class TransactionRollbackHelper {
  private rollbackActions: Array<() => Promise<void>> = [];
  private committed = false;

  /**
   * Register a rollback action
   *
   * @param action - The action to execute on rollback
   */
  addRollbackAction(action: () => Promise<void>): void {
    if (this.committed) {
      throw new Error('Cannot add rollback action after commit');
    }
    this.rollbackActions.push(action);
  }

  /**
   * Execute all rollback actions in reverse order
   */
  async rollback(): Promise<void> {
    if (this.committed) {
      return;
    }

    // Execute rollback actions in reverse order
    for (let i = this.rollbackActions.length - 1; i >= 0; i--) {
      try {
        await this.rollbackActions[i]();
      } catch (error) {
        // Log but continue with other rollback actions
        logger.error({ error, step: i }, 'Rollback action failed');
      }
    }
  }

  /**
   * Mark the transaction as committed (no rollback needed)
   */
  commit(): void {
    this.committed = true;
    this.rollbackActions = [];
  }
}

/**
 * Execute a function with automatic rollback on failure
 *
 * This is useful for operations that span multiple systems
 * (e.g., creating a user in both lobe-chat and one-api).
 *
 * @param callback - The function to execute
 * @returns The result of the callback
 *
 * Requirements: 10.4
 * Property 26: Registration atomicity
 */
export async function withRollback<T>(
  callback: (helper: TransactionRollbackHelper) => Promise<T>,
): Promise<T> {
  const helper = new TransactionRollbackHelper();

  try {
    const result = await callback(helper);
    helper.commit();
    return result;
  } catch (error) {
    await helper.rollback();
    throw error;
  }
}
