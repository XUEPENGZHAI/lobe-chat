'use client';

import { useCallback, useEffect, useState } from 'react';

import { formatCost, formatTimestamp } from '../utils/formatters';

export interface LogEntry {
  /** Log ID */
  id: number;
  /** Unix timestamp in seconds */
  timestamp: number;
  /** Model name */
  model: string;
  /** Prompt tokens */
  promptTokens: number;
  /** Completion tokens */
  completionTokens: number;
  /** Total tokens */
  totalTokens: number;
  /** Quota consumed (one-api units) */
  quota: number;
  /** Token name */
  tokenName: string;
  /** Channel */
  channel: string;
}

export interface FormattedLogEntry extends LogEntry {
  /** Formatted timestamp string */
  formattedTime: string;
  /** Formatted cost in yuan (4 decimal places) */
  formattedCost: string;
}

export interface HistoryData {
  logs: LogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface UseHistoryOptions {
  /** Page size (default: 20) */
  pageSize?: number;
  /** Whether to fetch on mount */
  fetchOnMount?: boolean;
}

export interface UseHistoryReturn {
  /** History data */
  data: HistoryData | null;
  /** Formatted logs for display */
  formattedLogs: FormattedLogEntry[];
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Whether there is no data */
  isEmpty: boolean;
  /** Current page (0-indexed) */
  currentPage: number;
  /** Total pages */
  totalPages: number;
  /** Go to specific page */
  goToPage: (page: number) => Promise<void>;
  /** Go to next page */
  nextPage: () => Promise<void>;
  /** Go to previous page */
  prevPage: () => Promise<void>;
  /** Whether can go to next page */
  hasNextPage: boolean;
  /** Whether can go to previous page */
  hasPrevPage: boolean;
  /** Manually refresh history */
  refresh: () => Promise<void>;
}


/**
 * useHistory Hook
 * Fetches and manages consumption history from one-api
 *
 * Features:
 * - Fetches logs from one-api with pagination
 * - Provides formatted data for display
 * - Handles pagination navigation
 * - Handles empty data state
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4
 * Property 10: History pagination
 * Property 11: Cost display formatting
 */
export function useHistory(options: UseHistoryOptions = {}): UseHistoryReturn {
  const { pageSize = 20, fetchOnMount = true } = options;

  const [data, setData] = useState<HistoryData | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch history from one-api
   */
  const fetchHistory = useCallback(async (page: number) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/webapi/oneapi/logs?page=${page}&pageSize=${pageSize}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        setData(result.data);
        setCurrentPage(page);
      } else {
        throw new Error(result.message || '获取消费记录失败');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取消费记录失败，请稍后重试';
      setError(errorMessage);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  // Initial fetch
  useEffect(() => {
    if (fetchOnMount) {
      fetchHistory(0);
    }
  }, [fetchOnMount, fetchHistory]);

  /**
   * Format logs for display
   * Requirements: 5.4 - Cost formatted with 4 decimal places
   */
  const formattedLogs: FormattedLogEntry[] = data?.logs.map((log: LogEntry) => ({
    ...log,
    formattedTime: formatTimestamp(log.timestamp),
    formattedCost: formatCost(log.quota),
  })) || [];

  // Check if data is empty (Requirement 5.1)
  const isEmpty = !data || data.logs.length === 0;

  // Pagination helpers
  const totalPages = data?.totalPages || 0;
  const hasNextPage = currentPage < totalPages - 1;
  const hasPrevPage = currentPage > 0;

  const goToPage = useCallback(async (page: number) => {
    if (page >= 0 && page < totalPages) {
      await fetchHistory(page);
    }
  }, [fetchHistory, totalPages]);

  const nextPage = useCallback(async () => {
    if (hasNextPage) {
      await fetchHistory(currentPage + 1);
    }
  }, [fetchHistory, currentPage, hasNextPage]);

  const prevPage = useCallback(async () => {
    if (hasPrevPage) {
      await fetchHistory(currentPage - 1);
    }
  }, [fetchHistory, currentPage, hasPrevPage]);

  const refresh = useCallback(async () => {
    await fetchHistory(currentPage);
  }, [fetchHistory, currentPage]);

  return {
    data,
    formattedLogs,
    loading,
    error,
    isEmpty,
    currentPage,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    hasNextPage,
    hasPrevPage,
    refresh,
  };
}

export default useHistory;
