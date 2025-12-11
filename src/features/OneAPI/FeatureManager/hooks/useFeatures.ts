'use client';

import { useCallback, useEffect, useState } from 'react';

import type { Feature, FeaturesResponse } from '../types';

export interface UseFeaturesResult {
  features: Feature[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch features list
 *
 * Requirements: 6.1, 6.2, 6.5
 * Property 12: Feature list completeness
 * Property 15: Feature sorting
 */
export function useFeatures(): UseFeaturesResult {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeatures = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/webapi/features');
      const data: FeaturesResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || '获取功能列表失败');
      }

      // Features are already sorted by sort_order from the API
      setFeatures(data.data?.features || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取功能列表失败';
      setError(errorMessage);
      setFeatures([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  return {
    features,
    loading,
    error,
    refetch: fetchFeatures,
  };
}
