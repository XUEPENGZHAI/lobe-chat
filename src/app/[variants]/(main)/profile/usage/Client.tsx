'use client';

import { Card, Typography } from 'antd';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

import { AccountBalance, HistoryTable, UsageChart } from '@/features/OneAPI';

const { Title, Text } = Typography;

/**
 * Usage Page - One-API Account Management
 *
 * This page displays one-api account information:
 * - Balance display (AccountBalance - implemented)
 * - Top-up functionality (integrated in AccountBalance)
 * - Usage statistics (UsageChart - implemented)
 * - Consumption history (HistoryTable - implemented)
 * - Feature management
 *
 * TODO: Implement the following components:
 * - FeatureManager: Feature subscription management
 */

export interface UsagePageProps {
  mobile?: boolean;
}

const Client = memo<UsagePageProps>(({ mobile }) => {
  useTranslation('auth');

  return (
    <Flexbox gap={mobile ? 16 : 24} style={{ padding: mobile ? 16 : 0 }}>
      {/* Balance Card - Connected to one-api with integrated top-up */}
      <AccountBalance showTopupButton />

      {/* Usage Statistics - Connected to one-api (Requirements 4.1, 4.2, 4.3, 4.4) */}
      <UsageChart days={30} showTrendChart />

      {/* Consumption History - Connected to one-api (Requirements 5.1, 5.2, 5.3, 5.4) */}
      <HistoryTable pageSize={20} />

      {/* Feature Management - TODO: Implement */}
      <Card>
        <Flexbox gap={16}>
          <Title level={5}>功能管理</Title>
          <Flexbox gap={12} horizontal wrap="wrap">
            <Card size="small" style={{ minWidth: 200 }}>
              <Flexbox gap={4}>
                <Flexbox align="center" gap={8} horizontal>
                  <Text>💬</Text>
                  <Text strong>AI 对话</Text>
                  <Text style={{ color: '#52c41a' }}>已开通</Text>
                </Flexbox>
                <Text type="secondary">基础 AI 对话功能</Text>
              </Flexbox>
            </Card>
            <Card size="small" style={{ minWidth: 200 }}>
              <Flexbox gap={4}>
                <Flexbox align="center" gap={8} horizontal>
                  <Text>🐟</Text>
                  <Text strong>论坛引擎</Text>
                  <Text type="secondary">未开通</Text>
                </Flexbox>
                <Text type="secondary">社区论坛和内容管理</Text>
              </Flexbox>
            </Card>
            <Card size="small" style={{ minWidth: 200 }}>
              <Flexbox gap={4}>
                <Flexbox align="center" gap={8} horizontal>
                  <Text>📊</Text>
                  <Text strong>数据分析</Text>
                  <Text type="secondary">未开通</Text>
                </Flexbox>
                <Text type="secondary">深度数据分析和可视化</Text>
              </Flexbox>
            </Card>
          </Flexbox>
          <Text type="secondary">
            功能订阅管理（待接入）
          </Text>
        </Flexbox>
      </Card>
    </Flexbox>
  );
});

export default Client;
