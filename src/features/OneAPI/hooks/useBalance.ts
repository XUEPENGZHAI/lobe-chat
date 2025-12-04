'use client';

import { useCallback, useEffect, useState } from 'react';

import { QUOTA_PER_UNIT } from '../utils/formatters';

export interface BalanceData {
  quota: number;
  used_quota: number;
  request_count: number;
}

export interface UseBalanceOptions {
  /** Auto refresh interval in milliseconds (default: 600000ms = 10 minutes) */
  autoRefreshInterval?: number;
  /** Whether to fetch balance on mount */
  fetchOnMount?: boolean;
}

export interface UseBalanceReturn {
  /** Balance data from one-api */
  balance: BalanceData | null;
  /** Balance in yuan (元) */
  balanceYuan: number;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Last updated timestamp */
  lastUpdated: Date | null;
  /** Manually refresh balance */
  refresh: () => Promise<void>;
}

/**
 * useBalance Hook
 * Fetches and manages user balance from one-api
 *
 * Features:
 * - Fetches balance from one-api
 * - Auto-refreshes at configurable interval
 * - Provides manual refresh function
 * - Converts quota to yuan
 *
 * Requirements: 2.1, 2.3, 2.4, 3.5
 */
export function useBalance(options: UseBalanceOptions = {}): UseBalanceReturn {
  const {
    autoRefreshInterval = 10 * 60 * 1000, // 10 minutes default
    fetchOnMount = true,
  } = options;

  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  /**
   * Fetch balance from one-api
   */
  const fetchBalance = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/webapi/oneapi/user/balance');

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success && typeof data.data?.quota === 'number') {
        setBalance({
          quota: data.data.quota,
          used_quota: data.data.used_quota || 0,
          request_count: data.data.request_count || 0,
        });
        setLastUpdated(new Date());
      } else {
        throw new Error(data.message || '获取余额失败');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取余额失败，请稍后重试';
      setError(errorMessage);
      setBalance(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    if (fetchOnMount) {
      fetchBalance();
    }
  }, [fetchOnMount, fetchBalance]);

  // Auto-refresh interval
  useEffect(() => {
    if (autoRefreshInterval > 0) {
      const intervalId = setInterval(fetchBalance, autoRefreshInterval);
      return () => clearInterval(intervalId);
    }
  }, [autoRefreshInterval, fetchBalance]);

  // Calculate balance in yuan
  const balanceYuan = balance ? balance.quota / QUOTA_PER_UNIT : 0;

  return {
    balance,
    balanceYuan,
    loading,
    error,
    lastUpdated,
    refresh: fetchBalance,
  };
}

export default useBalance;
