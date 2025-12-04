'use client';

import { Button, Card, Spin, Typography, message } from 'antd';
import { createStyles } from 'antd-style';
import { memo, useCallback, useState } from 'react';
import { Flexbox } from 'react-layout-kit';

import { useBalance } from '../hooks/useBalance';
import TopupPanel from '../TopupPanel';
import { formatBalance } from '../utils/formatters';

const { Text, Title } = Typography;

const useStyles = createStyles(({ css, token }) => ({
  card: css`
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
  topupButton: css`
    margin-top: 12px;
  `,
}));

export interface AccountBalanceProps {
  /** Show top-up button */
  showTopupButton?: boolean;
  /** Auto refresh interval in milliseconds */
  autoRefreshInterval?: number;
}

/**
 * AccountBalance Component
 * Displays user balance with integrated top-up functionality
 *
 * Features:
 * - Shows current balance from one-api
 * - Top-up button that opens TopupPanel modal
 * - Auto-refreshes balance after successful top-up
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.5
 */
const AccountBalance = memo<AccountBalanceProps>(({
  showTopupButton = true,
  autoRefreshInterval,
}) => {
  const { styles } = useStyles();
  const [topupModalVisible, setTopupModalVisible] = useState(false);

  const {
    balance,
    loading,
    error,
    lastUpdated,
    refresh,
  } = useBalance({ autoRefreshInterval });

  /**
   * Handle top-up success
   * Refreshes balance display (Requirement 3.5)
   */
  const handleTopupSuccess = useCallback(() => {
    // Show success message
    message.success('充值订单已创建，支付完成后余额将自动更新');

    // Refresh balance after a short delay to allow payment processing
    // The user will see updated balance on next auto-refresh or manual refresh
    setTimeout(() => {
      refresh();
    }, 2000);
  }, [refresh]);

  const openTopupModal = useCallback(() => {
    setTopupModalVisible(true);
  }, []);

  const closeTopupModal = useCallback(() => {
    setTopupModalVisible(false);
  }, []);

  return (
    <>
      <Card className={styles.card}>
        <Flexbox gap={8}>
          <Flexbox align="center" horizontal justify="space-between">
            <Title level={5} style={{ margin: 0 }}>账户余额</Title>
            {loading && <Spin size="small" />}
          </Flexbox>

          <Flexbox align="baseline" gap={4} horizontal>
            {error ? (
              <Text className={styles.errorText}>
                {formatBalance(0)}
              </Text>
            ) : (
              <Text className={styles.balanceValue}>
                {balance !== null ? formatBalance(balance.quota) : '--'}
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

          {showTopupButton && (
            <Button
              className={styles.topupButton}
              type="primary"
              onClick={openTopupModal}
            >
              充值
            </Button>
          )}
        </Flexbox>
      </Card>

      {/* Top-up Modal */}
      <TopupPanel
        asModal
        visible={topupModalVisible}
        onClose={closeTopupModal}
        onSuccess={handleTopupSuccess}
      />
    </>
  );
});

AccountBalance.displayName = 'AccountBalance';

export default AccountBalance;
