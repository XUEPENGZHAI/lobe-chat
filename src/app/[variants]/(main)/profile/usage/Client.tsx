'use client';

import { Card } from 'antd';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

import { AccountBalance, FeatureManager, HistoryTable, UsageChart } from '@/features/OneAPI';

/**
 * Usage Page - One-API Account Management
 *
 * This page displays one-api account information:
 * - Balance display with top-up button (AccountBalance)
 * - Usage statistics (UsageChart)
 * - Consumption history (HistoryTable)
 * - Feature management (FeatureManager)
 *
 * Requirements: 2.1, 3.1, 4.1, 5.1, 6.1
 */

export interface UsagePageProps {
  mobile?: boolean;
}

const Client = memo<UsagePageProps>(({ mobile }) => {
  useTranslation('auth');

  /**
   * Handle feature activation callback
   * Can be used to refresh balance or show notifications
   */
  const handleFeatureActivated = useCallback((featureCode: string) => {
    console.log(`Feature activated: ${featureCode}`);
    // Balance will auto-refresh via AccountBalance component
  }, []);

  return (
    <Flexbox gap={mobile ? 16 : 24} style={{ padding: mobile ? 16 : 0 }}>
      {/* Balance Card with Top-up Button (Requirements 2.1, 3.1) */}
      <AccountBalance showTopupButton />

      {/* Usage Statistics (Requirements 4.1, 4.2, 4.3, 4.4) */}
      <UsageChart days={30} showTrendChart />

      {/* Consumption History (Requirements 5.1, 5.2, 5.3, 5.4) */}
      <HistoryTable pageSize={20} />

      {/* Feature Management (Requirements 6.1, 6.2, 7.1) */}
      <Card>
        <FeatureManager
          title="功能管理"
          onFeatureActivated={handleFeatureActivated}
        />
      </Card>
    </Flexbox>
  );
});

export default Client;
