'use client';

import { useCallback, useEffect, useState } from 'react';

import { QUOTA_PER_UNIT } from '../utils/formatters';

export interface StatisticsSummary {
  /** Total API calls */
  totalCalls: number;
  /** Total quota consumed (one-api units) */
  totalQuota: number;
  /** Average quota per call (one-api units) */
  averageQuota: number;
}

export interface TrendDataPoint {
  /** Date string (YYYY-MM-DD) */
  date: string;
  /** Number of API calls */
  calls: number;
  /** Quota consumed (one-api units) */
  quota: number;
}

export interface StatisticsData {
  summary: StatisticsSummary;
  trend: TrendDataPoint[];
}

export interface UseStatisticsOptions {
  /** Number of days to fetch (default: 30) */
  days?: number;
  /** Whether to fetch on mount */
  fetchOnMount?: boolean;
}

export interface UseStatisticsReturn {
  /** Statistics data */
  data: StatisticsData | null;
  /** Summary in yuan */
  summaryYuan: {
    totalCost: number;
    averageCost: number;
  } | null;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Whether there is no data */
  isEmpty: boolean;
  /** Manually refresh statistics */
  refresh: () => Promise<void>;
}

/**
 * useStatistics Hook
 * Fetches and manages usage statistics from one-api
 *
 * Features:
 * - Fetches statistics from one-api
 * - Provides summary (total calls, total cost, average cost)
 * - Provides trend data for charts
 * - Handles empty data state
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4
 * Property 9: Statistics display completeness
 */
export function useStatistics(options: UseStatisticsOptions = {}): UseStatisticsReturn {
  const { days = 30, fetchOnMount = true } = options;

  const [data, setData] = useState<StatisticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch statistics from one-api
   */
  const fetchStatistics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/webapi/oneapi/stats?days=${days}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        setData(result.data);
      } else {
        throw new Error(result.message || '获取统计数据失败');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取统计数据失败，请稍后重试';
      setError(errorMessage);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [days]);

  // Initial fetch
  useEffect(() => {
    if (fetchOnMount) {
      fetchStatistics();
    }
  }, [fetchOnMount, fetchStatistics]);

  // Calculate summary in yuan
  const summaryYuan = data?.summary
    ? {
        totalCost: data.summary.totalQuota / QUOTA_PER_UNIT,
        averageCost: data.summary.averageQuota / QUOTA_PER_UNIT,
      }
    : null;

  // Check if data is empty (Requirement 4.4)
  const isEmpty = !data || (data.trend.length === 0 && data.summary.totalCalls === 0);

  return {
    data,
    summaryYuan,
    loading,
    error,
    isEmpty,
    refresh: fetchStatistics,
  };
}

export default useStatistics;
