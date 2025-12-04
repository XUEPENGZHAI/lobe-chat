'use client';

import { Card, Empty, Spin, Statistic, Typography } from 'antd';
import { createStyles } from 'antd-style';
import { memo } from 'react';
import { Flexbox } from 'react-layout-kit';

import { useStatistics } from '../hooks/useStatistics';
import { QUOTA_PER_UNIT } from '../utils/formatters';

import TrendChart from './TrendChart';

const { Text, Title } = Typography;

const useStyles = createStyles(({ css, token }) => ({
  card: css`
    border-radius: ${token.borderRadiusLG}px;
  `,
  statCard: css`
    flex: 1;
    min-width: 150px;
    border-radius: ${token.borderRadius}px;
    background: ${token.colorFillQuaternary};
  `,
  chartContainer: css`
    width: 100%;
    height: 200px;
    margin-top: 16px;
  `,
  emptyContainer: css`
    padding: 40px 0;
  `,
}));

export interface UsageChartProps {
  /** Number of days to display (default: 30) */
  days?: number;
  /** Show trend chart */
  showTrendChart?: boolean;
  /** Card title */
  title?: string;
}

/**
 * UsageChart Component
 * Displays usage statistics from one-api
 *
 * Features:
 * - Shows total API calls, total cost, and average cost per call
 * - Shows 30-day usage trend chart
 * - Handles empty data state
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4
 * Property 9: Statistics display completeness
 */
const UsageChart = memo<UsageChartProps>(({
  days = 30,
  showTrendChart = true,
  title = '使用统计',
}) => {
  const { styles } = useStyles();

  const {
    data,
    summaryYuan,
    loading,
    error,
    isEmpty,
  } = useStatistics({ days });

  return (
    <Card className={styles.card}>
      <Flexbox gap={16}>
        <Flexbox align="center" horizontal justify="space-between">
          <Title level={5} style={{ margin: 0 }}>{title}</Title>
          {loading && <Spin size="small" />}
        </Flexbox>

        {error && (
          <Text type="danger">{error}</Text>
        )}

        {/* Summary Statistics (Requirement 4.1) */}
        {!error && (
          <Flexbox gap={16} horizontal wrap="wrap">
            {/* Total Calls */}
            <Card className={styles.statCard} size="small">
              <Statistic
                loading={loading}
                suffix="次"
                title="总调用"
                value={data?.summary.totalCalls ?? '--'}
                valueStyle={{ fontSize: 24, fontWeight: 500 }}
              />
            </Card>

            {/* Total Cost */}
            <Card className={styles.statCard} size="small">
              <Statistic
                loading={loading}
                precision={2}
                suffix="元"
                title="总消费"
                value={summaryYuan?.totalCost ?? '--'}
                valueStyle={{ fontSize: 24, fontWeight: 500 }}
              />
            </Card>

            {/* Average Cost */}
            <Card className={styles.statCard} size="small">
              <Statistic
                loading={loading}
                precision={4}
                suffix="元/次"
                title="平均消费"
                value={summaryYuan?.averageCost ?? '--'}
                valueStyle={{ fontSize: 24, fontWeight: 500 }}
              />
            </Card>
          </Flexbox>
        )}

        {/* Trend Chart (Requirement 4.2) */}
        {showTrendChart && !error && (
          <div className={styles.chartContainer}>
            {loading ? (
              <Flexbox align="center" justify="center" style={{ height: '100%' }}>
                <Spin />
              </Flexbox>
            ) : isEmpty ? (
              /* Empty State (Requirement 4.4) */
              <div className={styles.emptyContainer}>
                <Empty
                  description="暂无使用记录"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              </div>
            ) : (
              <TrendChart data={data?.trend || []} />
            )}
          </div>
        )}

        <Text type="secondary">
          统计数据来源：one-api（最近 {days} 天）
        </Text>
      </Flexbox>
    </Card>
  );
});

UsageChart.displayName = 'UsageChart';

export default UsageChart;
