'use client';

import { Card, Spin, Typography, message } from 'antd';
import { createStyles } from 'antd-style';
import { memo, useCallback, useEffect, useState } from 'react';
import { Flexbox } from 'react-layout-kit';

import { formatBalance } from '../utils/formatters';

const { Text, Title } = Typography;

const useStyles = createStyles(({ css, token }) => ({
  balanceCard: css`
    border-radius: ${token.borderRadiusLG}px;
  `,
  balanceValue: css`
    font-size: 32px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  errorText: css`
    color: ${token.colorError};
  `,
  refreshHint: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
  `,
  unit: css`
    font-size: 16px;
    color: ${token.colorTextSecondary};
    margin-left: 4px;
  `,
}));

// 10 minutes in milliseconds
const DEFAULT_REFRESH_INTERVAL = 10 * 60 * 1000;

export interface BalanceCardProps {
  /** Auto refresh interval in milliseconds (default: 600000ms = 10 minutes) */
  autoRefreshInterval?: number;
  /** Callback when balance is fetched */
  onBalanceChange?: (balance: number) => void;
}

/**
 * BalanceCard Component
 * Displays user's account balance from one-api
 *
 * Features:
 * - Fetches balance from one-api getUserInfo API
 * - Auto-refreshes every 10 minutes
 * - Formats balance in yuan (元) with two decimal places
 * - Handles API errors gracefully
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */
const BalanceCard = memo<BalanceCardProps>(({
  autoRefreshInterval = DEFAULT_REFRESH_INTERVAL,
  onBalanceChange,
}) => {
  const { styles } = useStyles();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  /**
   * Fetch balance from one-api
   */
  const fetchBalance = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Call the API route that proxies to one-api
      const response = await fetch('/webapi/oneapi/user/balance');

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success && typeof data.data?.quota === 'number') {
        const balanceValue = data.data.quota;
        setBalance(balanceValue);
        setLastUpdated(new Date());
        onBalanceChange?.(balanceValue);
      } else {
        throw new Error(data.message || '获取余额失败');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取余额失败，请稍后重试';
      setError(errorMessage);
      setBalance(0); // Show zero balance on error (Requirement 2.3)
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [onBalanceChange]);

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchBalance();

    // Set up auto-refresh interval (Requirement 2.4)
    const intervalId = setInterval(fetchBalance, autoRefreshInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [fetchBalance, autoRefreshInterval]);

  return (
    <Card className={styles.balanceCard}>
      <Flexbox gap={8}>
        <Flexbox align="center" horizontal justify="space-between">
          <Title level={5} style={{ margin: 0 }}>账户余额</Title>
          {loading && <Spin size="small" />}
        </Flexbox>

        <Flexbox align="baseline" gap={4} horizontal>
          {error ? (
            <Text className={styles.errorText}>
              {formatBalance(balance ?? 0)}
            </Text>
          ) : (
            <Text className={styles.balanceValue}>
              {balance !== null ? formatBalance(balance) : '--'}
            </Text>
          )}
          <Text className={styles.unit}>元</Text>
        </Flexbox>

        {error && (
          <Text type="danger" style={{ fontSize: 12 }}>
            {error}
          </Text>
        )}

        {lastUpdated && !error && (
          <Text className={styles.refreshHint}>
            上次更新: {lastUpdated.toLocaleTimeString()}
          </Text>
        )}
      </Flexbox>
    </Card>
  );
});

BalanceCard.displayName = 'BalanceCard';

export default BalanceCard;
