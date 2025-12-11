'use client';

import { Button, Card, Tag, Typography } from 'antd';
import { createStyles } from 'antd-style';
import { memo } from 'react';
import { Flexbox } from 'react-layout-kit';

import type { FeatureCardProps } from './types';

const { Text, Title, Paragraph } = Typography;

/**
 * Format expiration date to Chinese locale
 */
const formatExpirationDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const useStyles = createStyles(({ css, token }) => ({
  actionButton: css`
    width: 100%;
    margin-top: 12px;
  `,
  cardContent: css`
    height: 100%;
    display: flex;
    flex-direction: column;
  `,
  description: css`
    color: ${token.colorTextSecondary};
    font-size: 13px;
    margin-bottom: 12px;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  `,
  expiredBadge: css`
    background-color: ${token.colorErrorBg};
    color: ${token.colorError};
    border: 1px solid ${token.colorErrorBorder};
  `,
  expirationExpired: css`
    font-size: 12px;
    color: ${token.colorError};
    margin-top: 4px;
  `,
  expirationInfo: css`
    font-size: 12px;
    color: ${token.colorTextSecondary};
    margin-top: 4px;
  `,
  expirationWarning: css`
    font-size: 12px;
    color: ${token.colorWarning};
    margin-top: 4px;
  `,
  expiringSoonBadge: css`
    background-color: ${token.colorWarningBg};
    color: ${token.colorWarning};
    border: 1px solid ${token.colorWarningBorder};
  `,
  featureCard: css`
    border-radius: ${token.borderRadiusLG}px;
    height: 100%;
    transition: all 0.3s ease;

    &:hover {
      box-shadow: ${token.boxShadowSecondary};
    }
  `,
  featureName: css`
    margin: 0 !important;
    font-size: 16px;
  `,
  freeText: css`
    font-size: 18px;
    font-weight: 600;
    color: ${token.colorSuccess};
  `,
  iconWrapper: css`
    font-size: 32px;
    line-height: 1;
    margin-bottom: 8px;
  `,
  priceSection: css`
    margin-top: auto;
  `,
  priceText: css`
    font-size: 18px;
    font-weight: 600;
    color: ${token.colorPrimary};
  `,
  priceUnit: css`
    font-size: 12px;
    color: ${token.colorTextSecondary};
    margin-left: 2px;
  `,
  subscribedBadge: css`
    background-color: ${token.colorSuccessBg};
    color: ${token.colorSuccess};
    border: 1px solid ${token.colorSuccessBorder};
  `,
}));

/**
 * FeatureCard Component
 * Displays a single feature with its information and subscription status
 *
 * Requirements: 6.2, 6.3, 6.4
 * Property 13: Free feature display
 * Property 14: Subscription badge display
 */
const FeatureCard = memo<FeatureCardProps>(({ feature, onActivate }) => {
  const { styles } = useStyles();

  const { subscription, isFree, pricing } = feature;
  const isSubscribed = subscription.isSubscribed;
  const isExpiringSoon = subscription.status === 'expiring_soon';
  const isExpired = subscription.status === 'expired';

  /**
   * Get subscription status badge
   * Requirements: 6.4, 8.3, 8.4
   */
  const renderStatusBadge = () => {
    if (isSubscribed && !isExpiringSoon) {
      return (
        <Tag className={styles.subscribedBadge} bordered={false}>
          已开通
        </Tag>
      );
    }
    if (isExpiringSoon) {
      return (
        <Tag className={styles.expiringSoonBadge} bordered={false}>
          即将到期
        </Tag>
      );
    }
    if (isExpired) {
      return (
        <Tag className={styles.expiredBadge} bordered={false}>
          已过期
        </Tag>
      );
    }
    return null;
  };

  /**
   * Render price display
   * Requirements: 6.2, 6.3
   * Property 13: Free feature display
   */
  const renderPrice = () => {
    if (isFree) {
      return <Text className={styles.freeText}>免费</Text>;
    }

    // Show monthly price as default
    return (
      <Flexbox align="baseline" horizontal>
        <Text className={styles.priceText}>¥{pricing.monthly}</Text>
        <Text className={styles.priceUnit}>/月</Text>
      </Flexbox>
    );
  };

  /**
   * Render expiration info
   * Requirements: 8.2, 8.3, 8.4
   * Property 19: Expiration warning display
   * Property 20: Expired subscription status
   */
  const renderExpirationInfo = () => {
    // Don't show for non-subscribed or free permanent features
    if (!subscription.isSubscribed && !isExpired) return null;
    if (subscription.expiresAt === null && isSubscribed) {
      return <Text className={styles.expirationInfo}>永久有效</Text>;
    }

    if (!subscription.expiresAt) return null;

    const expirationDate = formatExpirationDate(subscription.expiresAt);

    if (isExpired) {
      return (
        <Text className={styles.expirationExpired}>
          已于 {expirationDate} 过期
        </Text>
      );
    }

    if (isExpiringSoon) {
      return (
        <Text className={styles.expirationWarning}>
          将于 {expirationDate} 到期
        </Text>
      );
    }

    if (isSubscribed) {
      return (
        <Text className={styles.expirationInfo}>
          有效期至 {expirationDate}
        </Text>
      );
    }

    return null;
  };

  /**
   * Render action button
   */
  const renderActionButton = () => {
    if (isSubscribed && !isExpiringSoon && !isExpired) {
      return (
        <Button className={styles.actionButton} disabled>
          已开通
        </Button>
      );
    }

    if (isFree && !isSubscribed) {
      return (
        <Button
          className={styles.actionButton}
          type="primary"
          onClick={() => onActivate?.(feature)}
        >
          免费开通
        </Button>
      );
    }

    if (isExpiringSoon) {
      return (
        <Button
          className={styles.actionButton}
          type="primary"
          onClick={() => onActivate?.(feature)}
        >
          续费
        </Button>
      );
    }

    if (isExpired) {
      return (
        <Button
          className={styles.actionButton}
          type="primary"
          onClick={() => onActivate?.(feature)}
        >
          重新开通
        </Button>
      );
    }

    return (
      <Button
        className={styles.actionButton}
        type="primary"
        onClick={() => onActivate?.(feature)}
      >
        立即开通
      </Button>
    );
  };

  return (
    <Card className={styles.featureCard} hoverable>
      <Flexbox className={styles.cardContent} gap={8}>
        <Flexbox align="flex-start" horizontal justify="space-between">
          <span className={styles.iconWrapper}>{feature.icon || '📦'}</span>
          {renderStatusBadge()}
        </Flexbox>

        <Title className={styles.featureName} level={5}>
          {feature.name}
        </Title>

        <Paragraph className={styles.description} ellipsis={{ rows: 2 }}>
          {feature.description || '暂无描述'}
        </Paragraph>

        <Flexbox className={styles.priceSection} gap={4}>
          {renderPrice()}
          {renderExpirationInfo()}
          {renderActionButton()}
        </Flexbox>
      </Flexbox>
    </Card>
  );
});

FeatureCard.displayName = 'FeatureCard';

export default FeatureCard;
