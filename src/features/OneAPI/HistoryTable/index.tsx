'use client';

import { Button, Card, Empty, Skeleton, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { memo } from 'react';
import { Flexbox } from 'react-layout-kit';

import { useHistory, type FormattedLogEntry } from '../hooks';

const { Title, Text } = Typography;

export interface HistoryTableProps {
  /** Page size (default: 20) */
  pageSize?: number;
  /** Whether to show title */
  showTitle?: boolean;
  /** Custom title */
  title?: string;
}

/**
 * HistoryTable Component
 * Displays consumption history from one-api with pagination
 *
 * Features:
 * - Table display with timestamp, model, tokens, cost
 * - Pagination controls (20 records per page)
 * - Cost formatted with 4 decimal places
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4
 * Property 10: History pagination
 * Property 11: Cost display formatting
 */
const HistoryTable = memo<HistoryTableProps>(({
  pageSize = 20,
  showTitle = true,
  title = '消费记录',
}) => {
  const {
    formattedLogs,
    loading,
    error,
    isEmpty,
    currentPage,
    totalPages,
    data,
    nextPage,
    prevPage,
    hasNextPage,
    hasPrevPage,
    refresh,
  } = useHistory({ pageSize });

  // Table columns definition (Requirement 5.1)
  const columns: ColumnsType<FormattedLogEntry> = [
    {
      title: '时间',
      dataIndex: 'formattedTime',
      key: 'time',
      width: 180,
    },
    {
      title: '模型',
      dataIndex: 'model',
      key: 'model',
      width: 150,
      ellipsis: true,
    },
    {
      title: 'Token',
      key: 'tokens',
      width: 180,
      render: (_: unknown, record: FormattedLogEntry) => (
        <Space direction="vertical" size={0}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            输入: {record.promptTokens.toLocaleString()}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            输出: {record.completionTokens.toLocaleString()}
          </Text>
          <Text strong>
            总计: {record.totalTokens.toLocaleString()}
          </Text>
        </Space>
      ),
    },
    {
      title: '消费 (元)',
      dataIndex: 'formattedCost',
      key: 'cost',
      width: 120,
      align: 'right',
      render: (cost: string) => (
        <Text strong style={{ color: '#f5222d' }}>
          ¥{cost}
        </Text>
      ),
    },
  ];


  // Loading state
  if (loading && !data) {
    return (
      <Card>
        <Flexbox gap={16}>
          {showTitle && <Title level={5}>{title}</Title>}
          <Skeleton active paragraph={{ rows: 6 }} />
        </Flexbox>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <Flexbox gap={16}>
          {showTitle && <Title level={5}>{title}</Title>}
          <Empty
            description={
              <Flexbox align="center" gap={8}>
                <Text type="danger">{error}</Text>
                <Button onClick={refresh} size="small">
                  重试
                </Button>
              </Flexbox>
            }
          />
        </Flexbox>
      </Card>
    );
  }

  // Empty state (Requirement 5.1)
  if (isEmpty) {
    return (
      <Card>
        <Flexbox gap={16}>
          {showTitle && <Title level={5}>{title}</Title>}
          <Empty description="暂无消费记录" />
        </Flexbox>
      </Card>
    );
  }

  return (
    <Card>
      <Flexbox gap={16}>
        {showTitle && (
          <Flexbox align="center" horizontal justify="space-between">
            <Title level={5} style={{ margin: 0 }}>{title}</Title>
            <Text type="secondary">
              共 {data?.total || 0} 条记录
            </Text>
          </Flexbox>
        )}

        {/* Table (Requirement 5.1) */}
        <Table
          columns={columns}
          dataSource={formattedLogs}
          loading={loading}
          pagination={false}
          rowKey="id"
          scroll={{ x: 630 }}
          size="small"
        />

        {/* Pagination controls (Requirements 5.2, 5.3) */}
        {totalPages > 1 && (
          <Flexbox align="center" horizontal justify="space-between">
            <Text type="secondary">
              第 {currentPage + 1} / {totalPages} 页
            </Text>
            <Space>
              <Button
                disabled={!hasPrevPage || loading}
                onClick={prevPage}
                size="small"
              >
                上一页
              </Button>
              <Button
                disabled={!hasNextPage || loading}
                onClick={nextPage}
                size="small"
              >
                下一页
              </Button>
            </Space>
          </Flexbox>
        )}

        <Text type="secondary" style={{ fontSize: 12 }}>
          消费记录来源：one-api
        </Text>
      </Flexbox>
    </Card>
  );
});

HistoryTable.displayName = 'HistoryTable';

export default HistoryTable;
