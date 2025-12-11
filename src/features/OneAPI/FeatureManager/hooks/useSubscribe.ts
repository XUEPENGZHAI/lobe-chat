'use client';

import { message } from 'antd';
import { useCallback, useState } from 'react';

import type { SubscribeResponse, SubscriptionPeriod } from '../types';

export interface UseSubscribeResult {
  subscribe: (featureCode: string, period: SubscriptionPeriod) => Promise<boolean>;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to subscribe to a feature
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 * Property 16: Subscription cost calculation
 * Property 17: Balance check before activation
 * Property 18: Subscription creation on sufficient balance
 */
export function useSubscribe(): UseSubscribeResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subscribe = useCallback(async (featureCode: string, period: SubscriptionPeriod): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/webapi/features/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ featureCode, period }),
      });

      const data: SubscribeResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || '功能开通失败');
      }

      message.success(data.message || '功能开通成功');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '功能开通失败';
      setError(errorMessage);
      message.error(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    subscribe,
    loading,
    error,
  };
}
