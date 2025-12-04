'use client';

import { useTheme } from 'antd-style';
import { memo, useMemo } from 'react';

import type { TrendDataPoint } from '../hooks/useStatistics';
import { QUOTA_PER_UNIT } from '../utils/formatters';

/**
 * Format date string for display
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Formatted date string
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export interface TrendChartProps {
  /** Trend data points */
  data: TrendDataPoint[];
}

/**
 * TrendChart Component
 * Displays a 30-day usage trend chart using simple CSS bars
 *
 * Features:
 * - Shows daily API calls as bars
 * - Responsive design
 * - Tooltip on hover
 *
 * Requirements: 4.2
 */
const TrendChart = memo<TrendChartProps>(({ data }) => {
  const theme = useTheme();

  // Process data for display
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Find max value for scaling
    const maxCalls = Math.max(...data.map(d => d.calls), 1);

    return data.map(item => ({
      ...item,
      // Calculate bar height percentage
      heightPercent: (item.calls / maxCalls) * 100,
      // Format cost in yuan
      costYuan: (item.quota / QUOTA_PER_UNIT).toFixed(4),
      // Format date for display
      displayDate: formatDate(item.date),
    }));
  }, [data]);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 2,
        height: '100%',
        padding: '8px 0',
      }}
    >
      {chartData.map((item, index) => (
        <div
          key={item.date}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            height: '100%',
            position: 'relative',
          }}
          title={`${item.displayDate}\n调用: ${item.calls} 次\n消费: ${item.costYuan} 元`}
        >
          {/* Bar */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'flex-end',
              width: '100%',
            }}
          >
            <div
              style={{
                width: '100%',
                height: `${Math.max(item.heightPercent, 2)}%`,
                backgroundColor: item.calls > 0 ? theme.colorPrimary : theme.colorFillSecondary,
                borderRadius: 2,
                minHeight: 2,
                transition: 'height 0.3s ease',
                cursor: 'pointer',
              }}
            />
          </div>
          {/* Date label - show every 5th day or first/last */}
          {(index === 0 || index === chartData.length - 1 || index % 5 === 0) && (
            <div
              style={{
                fontSize: 10,
                color: theme.colorTextTertiary,
                marginTop: 4,
                whiteSpace: 'nowrap',
              }}
            >
              {item.displayDate.slice(5)} {/* Show MM-DD */}
            </div>
          )}
        </div>
      ))}
    </div>
  );
});

TrendChart.displayName = 'TrendChart';

export default TrendChart;
