'use client';

import { Card, Skeleton, Typography } from 'antd';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

const { Title, Text } = Typography;

/**
 * Usage Page - One-API Account Management
 *
 * This page displays one-api account information:
 * - Balance display
 * - Top-up functionality
 * - Usage statistics (from one-api)
 * - Consumption history
 * - Feature management
 *
 * TODO: Implement the following components:
 * - BalanceCard: Display current balance from one-api
 * - TopupPanel: Top-up functionality
 * - UsageChart: Usage statistics from one-api logs
 * - HistoryTable: Consumption history from one-api
 * - FeatureManager: Feature subscription management
 */

export interface UsagePageProps {
  mobile?: boolean;
}

const Client = memo<UsagePageProps>(({ mobile }) => {
  useTranslation('auth');

  return (
    <Flexbox gap={mobile ? 16 : 24} style={{ padding: mobile ? 16 : 0 }}>
      {/* Balance Card - TODO: Connect to one-api */}
      <Card>
        <Flexbox gap={8}>
          <Title level={5}>账户余额</Title>
          <Flexbox align="baseline" gap={4} horizontal>
            <Text style={{ fontSize: 32, fontWeight: 600 }}>--</Text>
            <Text type="secondary">元</Text>
          </Flexbox>
          <Text type="secondary">
            数据来源：one-api（待接入）
          </Text>
        </Flexbox>
      </Card>

      {/* Quick Actions */}
      <Card>
        <Flexbox gap={16}>
          <Title level={5}>快捷操作</Title>
          <Flexbox gap={12} horizontal wrap="wrap">
            <Card size="small" style={{ cursor: 'pointer', minWidth: 120 }}>
              <Flexbox align="center" gap={4}>
                <Text>💰</Text>
                <Text>充值</Text>
              </Flexbox>
            </Card>
            <Card size="small" style={{ cursor: 'pointer', minWidth: 120 }}>
              <Flexbox align="center" gap={4}>
                <Text>📊</Text>
                <Text>统计</Text>
              </Flexbox>
            </Card>
            <Card size="small" style={{ cursor: 'pointer', minWidth: 120 }}>
              <Flexbox align="center" gap={4}>
                <Text>📋</Text>
                <Text>记录</Text>
              </Flexbox>
            </Card>
          </Flexbox>
        </Flexbox>
      </Card>

      {/* Usage Statistics - TODO: Connect to one-api */}
      <Card>
        <Flexbox gap={16}>
          <Title level={5}>使用统计</Title>
          <Flexbox gap={16} horizontal wrap="wrap">
            <Card size="small" style={{ flex: 1, minWidth: 150 }}>
              <Flexbox gap={4}>
                <Text type="secondary">本月调用</Text>
                <Text style={{ fontSize: 24, fontWeight: 500 }}>--</Text>
                <Text type="secondary">次</Text>
              </Flexbox>
            </Card>
            <Card size="small" style={{ flex: 1, minWidth: 150 }}>
              <Flexbox gap={4}>
                <Text type="secondary">本月消费</Text>
                <Text style={{ fontSize: 24, fontWeight: 500 }}>--</Text>
                <Text type="secondary">元</Text>
              </Flexbox>
            </Card>
            <Card size="small" style={{ flex: 1, minWidth: 150 }}>
              <Flexbox gap={4}>
                <Text type="secondary">平均消费</Text>
                <Text style={{ fontSize: 24, fontWeight: 500 }}>--</Text>
                <Text type="secondary">元/次</Text>
              </Flexbox>
            </Card>
          </Flexbox>
          <Text type="secondary">
            统计数据来源：one-api（待接入）
          </Text>
        </Flexbox>
      </Card>

      {/* Consumption History - TODO: Connect to one-api */}
      <Card>
        <Flexbox gap={16}>
          <Title level={5}>消费记录</Title>
          <Skeleton active paragraph={{ rows: 4 }} />
          <Text type="secondary">
            消费记录来源：one-api（待接入）
          </Text>
        </Flexbox>
      </Card>

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
