'use client';

import { Button, Card, Input, InputNumber, message, Modal, Typography } from 'antd';
import { createStyles } from 'antd-style';
import { memo, useCallback, useState } from 'react';
import { Flexbox } from 'react-layout-kit';

import { validateTopupAmount } from '../utils/formatters';

const { Text, Title } = Typography;

const useStyles = createStyles(({ css, token }) => ({
  topupCard: css`
    border-radius: ${token.borderRadiusLG}px;
  `,
  quickAmountButton: css`
    min-width: 80px;
  `,
  quickAmountButtonSelected: css`
    min-width: 80px;
    border-color: ${token.colorPrimary};
    color: ${token.colorPrimary};
  `,
  inputWrapper: css`
    margin-top: 16px;
  `,
  amountInput: css`
    width: 100%;
    font-size: 18px;
  `,
  topupButton: css`
    width: 100%;
    height: 44px;
    font-size: 16px;
    margin-top: 16px;
  `,
  errorText: css`
    color: ${token.colorError};
    font-size: 12px;
    margin-top: 4px;
  `,
  hint: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
    margin-top: 8px;
  `,
}));

// Quick amount options in yuan
const QUICK_AMOUNTS = [10, 50, 100, 200, 500, 1000];

export interface TopupPanelProps {
  /** Callback when top-up is successful */
  onSuccess?: () => void;
  /** Whether to show as a modal */
  asModal?: boolean;
  /** Modal visibility (only used when asModal is true) */
  visible?: boolean;
  /** Callback when modal is closed */
  onClose?: () => void;
}

/**
 * TopupPanel Component
 * Allows users to top up their account balance
 *
 * Features:
 * - Amount input field
 * - Quick amount buttons (10, 50, 100, 200, 500, 1000 yuan)
 * - Top-up button that creates payment order
 * - Amount validation (must be > 0)
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */
const TopupPanel = memo<TopupPanelProps>(({
  onSuccess,
  asModal = false,
  visible = false,
  onClose,
}) => {
  const { styles } = useStyles();
  const [amount, setAmount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle quick amount button click
   */
  const handleQuickAmountClick = useCallback((value: number) => {
    setAmount(value);
    setError(null);
  }, []);

  /**
   * Handle amount input change
   */
  const handleAmountChange = useCallback((value: number | null) => {
    setAmount(value);
    setError(null);
  }, []);

  /**
   * Validate amount before submission
   * Requirements: 3.2
   * Property 6: Top-up amount validation
   */
  const validateAmount = useCallback((): boolean => {
    if (amount === null || amount === undefined) {
      setError('请输入充值金额');
      return false;
    }

    if (!validateTopupAmount(amount)) {
      setError('充值金额必须大于零');
      return false;
    }

    setError(null);
    return true;
  }, [amount]);

  /**
   * Handle top-up submission
   * Requirements: 3.3, 3.4
   * Property 7: Top-up creates payment order
   */
  const handleTopup = useCallback(async () => {
    if (!validateAmount()) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Call the API route to create top-up order
      const response = await fetch('/webapi/oneapi/topup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || '创建充值订单失败');
      }

      // Open payment URL in new window (Requirement 3.4)
      if (data.data?.payment_url) {
        window.open(data.data.payment_url, '_blank');
        message.success('充值订单已创建，请在新窗口完成支付');

        // Call success callback (Requirement 3.5)
        onSuccess?.();

        // Close modal if in modal mode
        if (asModal) {
          onClose?.();
        }

        // Reset form
        setAmount(null);
      } else {
        throw new Error('未获取到支付链接');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '充值失败，请稍后重试';
      setError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [amount, validateAmount, onSuccess, asModal, onClose]);

  const content = (
    <Flexbox gap={16}>
      <Title level={5} style={{ margin: 0 }}>账户充值</Title>

      {/* Quick amount buttons */}
      <Flexbox gap={8}>
        <Text type="secondary">快捷金额</Text>
        <Flexbox gap={8} horizontal wrap="wrap">
          {QUICK_AMOUNTS.map((quickAmount) => (
            <Button
              key={quickAmount}
              className={
                amount === quickAmount
                  ? styles.quickAmountButtonSelected
                  : styles.quickAmountButton
              }
              onClick={() => handleQuickAmountClick(quickAmount)}
              type={amount === quickAmount ? 'primary' : 'default'}
              ghost={amount === quickAmount}
            >
              ¥{quickAmount}
            </Button>
          ))}
        </Flexbox>
      </Flexbox>

      {/* Amount input */}
      <Flexbox className={styles.inputWrapper} gap={4}>
        <Text type="secondary">自定义金额（元）</Text>
        <InputNumber
          className={styles.amountInput}
          min={0.01}
          max={100000}
          precision={2}
          placeholder="请输入充值金额"
          prefix="¥"
          value={amount}
          onChange={handleAmountChange}
          size="large"
          status={error ? 'error' : undefined}
        />
        {error && <Text className={styles.errorText}>{error}</Text>}
      </Flexbox>

      {/* Top-up button */}
      <Button
        className={styles.topupButton}
        type="primary"
        size="large"
        loading={loading}
        onClick={handleTopup}
        disabled={!amount || amount <= 0}
      >
        立即充值 {amount && amount > 0 ? `¥${amount.toFixed(2)}` : ''}
      </Button>

      <Text className={styles.hint}>
        充值后余额将在支付完成后自动更新
      </Text>
    </Flexbox>
  );

  // Render as modal or card based on props
  if (asModal) {
    return (
      <Modal
        open={visible}
        onCancel={onClose}
        footer={null}
        title={null}
        width={400}
        destroyOnClose
      >
        {content}
      </Modal>
    );
  }

  return (
    <Card className={styles.topupCard}>
      {content}
    </Card>
  );
});

TopupPanel.displayName = 'TopupPanel';

export default TopupPanel;
