'use client';

import { Alert, Col, Empty, Row, Spin, Typography } from 'antd';
import { createStyles } from 'antd-style';
import { memo, useCallback, useState } from 'react';
import { Flexbox } from 'react-layout-kit';

import FeatureCard from './FeatureCard';
import SubscribeModal from './SubscribeModal';
import { useFeatures, useSubscribe } from './hooks';
import type { Feature, FeatureManagerProps, SubscriptionPeriod } from './types';

const { Title } = Typography;

const useStyles = createStyles(({ css }) => ({
  container: css`
    width: 100%;
  `,
  header: css`
    margin-bottom: 24px;
  `,
  title: css`
    margin: 0 !important;
  `,
  grid: css`
    width: 100%;
  `,
  loadingContainer: css`
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 200px;
  `,
  emptyContainer: css`
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 200px;
  `,
}));

/**
 * FeatureManager Component
 * Displays all available features in a grid layout with subscription management
 *
 * Features:
 * - Grid layout of feature cards
 * - Shows feature name, description, icon, and pricing
 * - Displays subscription status (已开通, 即将到期, 已过期)
 * - Opens subscription dialog on activate
 * - Sorted by sort_order
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 * Property 12: Feature list completeness
 * Property 13: Free feature display
 * Property 14: Subscription badge display
 * Property 15: Feature sorting
 */
const FeatureManager = memo<FeatureManagerProps>(({
  title = '功能管理',
  onFeatureActivated,
}) => {
  const { styles } = useStyles();
  const { features, loading, error, refetch } = useFeatures();
  const { subscribe, loading: subscribing } = useSubscribe();

  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  /**
   * Handle feature card activate click
   */
  const handleActivate = useCallback((feature: Feature) => {
    setSelectedFeature(feature);
    setModalVisible(true);
  }, []);

  /**
   * Handle modal close
   */
  const handleModalClose = useCallback(() => {
    setModalVisible(false);
    setSelectedFeature(null);
  }, []);

  /**
   * Handle subscription confirmation
   * Requirements: 7.1, 7.2, 7.3, 7.4
   */
  const handleSubscribe = useCallback(async (period: SubscriptionPeriod) => {
    if (!selectedFeature) return;

    const success = await subscribe(selectedFeature.code, period);
    if (success) {
      handleModalClose();
      // Refresh features list to update subscription status
      await refetch();
      onFeatureActivated?.(selectedFeature.code);
    }
  }, [selectedFeature, subscribe, handleModalClose, refetch, onFeatureActivated]);

  // Loading state
  if (loading) {
    return (
      <Flexbox className={styles.container}>
        <div className={styles.loadingContainer}>
          <Spin size="large" tip="加载功能列表..." />
        </div>
      </Flexbox>
    );
  }

  // Error state
  if (error) {
    return (
      <Flexbox className={styles.container}>
        <Alert
          message="加载失败"
          description={error}
          type="error"
          showIcon
          action={
            <a onClick={refetch}>重试</a>
          }
        />
      </Flexbox>
    );
  }

  // Empty state
  if (features.length === 0) {
    return (
      <Flexbox className={styles.container}>
        <div className={styles.emptyContainer}>
          <Empty description="暂无可用功能" />
        </div>
      </Flexbox>
    );
  }

  return (
    <Flexbox className={styles.container} gap={16}>
      <Flexbox className={styles.header}>
        <Title className={styles.title} level={4}>
          {title}
        </Title>
      </Flexbox>

      {/* Feature cards grid - sorted by sort_order (Requirement 6.5) */}
      <Row className={styles.grid} gutter={[16, 16]}>
        {features.map((feature) => (
          <Col key={feature.code} xs={24} sm={12} md={8} lg={6}>
            <FeatureCard
              feature={feature}
              onActivate={handleActivate}
            />
          </Col>
        ))}
      </Row>

      {/* Subscribe modal */}
      <SubscribeModal
        feature={selectedFeature}
        visible={modalVisible}
        loading={subscribing}
        onClose={handleModalClose}
        onSubscribe={handleSubscribe}
      />
    </Flexbox>
  );
});

FeatureManager.displayName = 'FeatureManager';

export default FeatureManager;

export { default as FeatureCard } from './FeatureCard';
export { default as SubscribeModal } from './SubscribeModal';
export * from './types';
export * from './hooks';
