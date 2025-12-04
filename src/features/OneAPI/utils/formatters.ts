/**
 * OneAPI Formatters
 * Utility functions for formatting one-api data
 */

/**
 * one-api quota conversion ratio
 * Default: 500000 quota = 1 yuan/dollar
 * This value can be configured in one-api admin settings (QuotaPerUnit)
 */
export const QUOTA_PER_UNIT = 500000;

/**
 * Format balance value from one-api quota to yuan (元)
 * one-api stores quota in internal units (default: 500000 = 1 yuan)
 *
 * @param quota - The quota value from one-api
 * @param quotaPerUnit - Conversion ratio (default: 500000)
 * @returns Formatted string with exactly two decimal places
 *
 * Requirements: 2.2
 * Property 5: Balance display formatting
 */
export function formatBalance(quota: number, quotaPerUnit: number = QUOTA_PER_UNIT): string {
  // Convert from one-api quota units to yuan
  const yuan = quota / quotaPerUnit;
  // Format with exactly two decimal places
  return yuan.toFixed(2);
}

/**
 * Format cost value from one-api to yuan (元)
 * Used for consumption history display
 *
 * @param quota - The quota/cost value from one-api
 * @param quotaPerUnit - Conversion ratio (default: 500000)
 * @returns Formatted string with exactly four decimal places
 *
 * Requirements: 5.4
 * Property 11: Cost display formatting
 */
export function formatCost(quota: number, quotaPerUnit: number = QUOTA_PER_UNIT): string {
  // Convert from one-api quota units to yuan
  const yuan = quota / quotaPerUnit;
  // Format with exactly four decimal places
  return yuan.toFixed(4);
}

/**
 * Validate top-up amount
 * Amount must be greater than zero
 *
 * @param amount - The top-up amount in yuan
 * @returns true if valid, false otherwise
 *
 * Requirements: 3.2
 * Property 6: Top-up amount validation
 */
export function validateTopupAmount(amount: number): boolean {
  return typeof amount === 'number' && !isNaN(amount) && amount > 0;
}

/**
 * Format timestamp to localized date string
 *
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted date string
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
