'use client';

import { Button, Modal, Radio, Typography } from 'antd';
import type { RadioChangeEvent } from 'antd';
import { createStyles } from 'antd-style';
import { memo, useCallback, useMemo, useState } from 'react';
import { Flexbox } from 'react-layout-kit';

import type { Feature, SubscriptionPeriod, SubscribeModalProps } from './types';

const { Text, Title } = Typography;

const useStyles = createStyles(({ css, token }) => ({
  confirmButton: css`
    width: 100%;
    height: 44px;
    font-size: 16px;
  `,
  featureDescription: css`
    color: ${token.colorTextSecondary};
    font-size: 13px;
    margin-top: 4px;
  `,
  featureIcon: css`
    font-size: 40px;
    line-height: 1;
  `,
  featureInfo: css`
    margin-bottom: 24px;
    padding: 16px;
    background: ${token.colorFillQuaternary};
    border-radius: ${token.borderRadiusLG}px;
  `,
  featureName: css`
    margin: 0 !important;
    font-size: 18px;
  `,
  freeText: css`
    font-size: 24px;
    font-weight: 600;
    color: ${token.colorSuccess};
  `,
  modalContent: css`
    padding: 8px 0;
  `,
  periodLabel: css`
    font-size: 15px;
    font-weight: 500;
  `,
  periodOption: css`
    display: flex;
    flex-direction: column;
    padding: 12px 16px;
    border: 1px solid ${token.colorBorder};
    border-radius: ${token.borderRadius}px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: ${token.colorPrimary};
    }
  `,
  periodOptionSelected: css`
    border-color: ${token.colorPrimary};
    background: ${token.colorPrimaryBg};
  `,
  periodPrice: css`
    font-size: 18px;
    font-weight: 600;
    color: ${token.colorPrimary};
  `,
  periodSaving: css`
    font-size: 12px;
    color: ${token.colorSuccess};
    margin-left: 8px;
  `,
  periodSection: css`
    margin-bottom: 24px;
  `,
  periodUnit: css`
    font-size: 12px;
    color: ${token.colorTextSecondary};
    margin-left: 4px;
  `,
  sectionTitle: css`
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 12px;
  `,
  totalLabel: css`
    font-size: 14px;
    color: ${token.colorTextSecondary};
  `,
  totalPrice: css`
    font-size: 24px;
    font-weight: 600;
    color: ${token.colorPrimary};
  `,
  totalSection: css`
    padding: 16px;
    background: ${token.colorFillQuaternary};
    border-radius: ${token.borderRadiusLG}px;
    margin-bottom: 16px;
  `,
}));

/**
 * Period option configuration
 */
interface PeriodOption {
  value: SubscriptionPeriod;
  label: string;
  priceKey: keyof Feature['pricing'];
  unit: string;
}

const PERIOD_OPTIONS: PeriodOption[] = [
  { value: 'weekly', label: '周付', priceKey: 'weekly', unit: '/周' },
  { value: 'monthly', label: '月付', priceKey: 'monthly', unit: '/月' },
  { value: 'yearly', label: '年付', priceKey: 'yearly', unit: '/年' },
];

/**
 * SubscribeModal Component
 * Dialog for selecting subscription period and confirming activation
 *
 * Features:
 * - Shows feature information
 * - Subscription period options (weekly, monthly, yearly)
 * - Calculates cost based on selected period
 * - Confirm button to activate
 *
 * Requirements: 7.1, 7.2
 * Property 16: Subscription cost calculation
 */
const SubscribeModal = memo<SubscribeModalProps>(({
  feature,
  visible,
  loading = false,
  onClose,
  onSubscribe,
}) => {
  const { styles, cx } = useStyles();
  const [selectedPeriod, setSelectedPeriod] = useState<SubscriptionPeriod>('monthly');

  /**
   * Handle period selection change
   */
  const handlePeriodChange = useCallback((e: RadioChangeEvent) => {
    setSelectedPeriod(e.target.value);
  }, []);

  /**
   * Calculate cost based on selected period
   * Requirements: 7.2
   * Property 16: Subscription cost calculation
   */
  const selectedCost = useMemo(() => {
    if (!feature) return 0;
    if (feature.isFree) return 0;
    return feature.pricing[selectedPeriod];
  }, [feature, selectedPeriod]);

  /**
   * Calculate savings for yearly subscription
   */
  const yearlySavings = useMemo(() => {
    if (!feature || feature.isFree) return 0;
    const monthlyTotal = feature.pricing.monthly * 12;
    const yearlyPrice = feature.pricing.yearly;
    return monthlyTotal - yearlyPrice;
  }, [feature]);

  /**
   * Handle confirm button click
   */
  const handleConfirm = useCallback(() => {
    onSubscribe(selectedPeriod);
  }, [onSubscribe, selectedPeriod]);

  if (!feature) return null;

  const isFree = feature.isFree;

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      title="开通功能"
      width={420}
      destroyOnClose
    >
      <Flexbox className={styles.modalContent} gap={0}>
        {/* Feature info */}
        <Flexbox className={styles.featureInfo} gap={8} horizontal>
          <span className={styles.featureIcon}>{feature.icon || '📦'}</span>
          <Flexbox gap={4}>
            <Title className={styles.featureName} level={5}>
              {feature.name}
            </Title>
            <Text className={styles.featureDescription}>
              {feature.description || '暂无描述'}
            </Text>
          </Flexbox>
        </Flexbox>

        {/* Period selection - only show for paid features */}
        {!isFree && (
          <Flexbox className={styles.periodSection}>
            <Text className={styles.sectionTitle}>选择订阅周期</Text>
            <Radio.Group
              value={selectedPeriod}
              onChange={handlePeriodChange}
              style={{ width: '100%' }}
            >
              {PERIOD_OPTIONS.map((option) => {
                const price = feature.pricing[option.priceKey];
                const isSelected = selectedPeriod === option.value;
                const showSaving = option.value === 'yearly' && yearlySavings > 0;

                return (
                  <Flexbox
                    key={option.value}
                    className={cx(
                      styles.periodOption,
                      isSelected && styles.periodOptionSelected
                    )}
                    horizontal
                    justify="space-between"
                    align="center"
                    onClick={() => setSelectedPeriod(option.value)}
                  >
                    <Flexbox horizontal align="center" gap={8}>
                      <Radio value={option.value} />
                      <Text className={styles.periodLabel}>{option.label}</Text>
                      {showSaving && (
                        <Text className={styles.periodSaving}>
                          省 ¥{yearlySavings.toFixed(0)}
                        </Text>
                      )}
                    </Flexbox>
                    <Flexbox horizontal align="baseline">
                      <Text className={styles.periodPrice}>¥{price}</Text>
                      <Text className={styles.periodUnit}>{option.unit}</Text>
                    </Flexbox>
                  </Flexbox>
                );
              })}
            </Radio.Group>
          </Flexbox>
        )}

        {/* Total cost */}
        <Flexbox className={styles.totalSection} horizontal justify="space-between" align="center">
          <Text className={styles.totalLabel}>
            {isFree ? '费用' : '应付金额'}
          </Text>
          {isFree ? (
            <Text className={styles.freeText}>免费</Text>
          ) : (
            <Text className={styles.totalPrice}>¥{selectedCost.toFixed(2)}</Text>
          )}
        </Flexbox>

        {/* Confirm button */}
        <Button
          className={styles.confirmButton}
          type="primary"
          size="large"
          loading={loading}
          onClick={handleConfirm}
        >
          {isFree ? '确认开通' : `确认支付 ¥${selectedCost.toFixed(2)}`}
        </Button>
      </Flexbox>
    </Modal>
  );
});

SubscribeModal.displayName = 'SubscribeModal';

export default SubscribeModal;
