/**
 * FeatureManager Types
 * Type definitions for feature management components
 */

/**
 * Subscription period options
 */
export type SubscriptionPeriod = 'weekly' | 'monthly' | 'yearly';

/**
 * Subscription status
 */
export type SubscriptionStatus = 'active' | 'expired' | 'expiring_soon' | 'none';

/**
 * Feature pricing information
 */
export interface FeaturePricing {
  weekly: number;
  monthly: number;
  yearly: number;
}

/**
 * Feature subscription information
 */
export interface FeatureSubscription {
  status: SubscriptionStatus;
  expiresAt: string | null;
  isSubscribed: boolean;
}

/**
 * Feature data from API
 */
export interface Feature {
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  pricing: FeaturePricing;
  isFree: boolean;
  sortOrder: number;
  subscription: FeatureSubscription;
}

/**
 * Features API response
 */
export interface FeaturesResponse {
  success: boolean;
  message?: string;
  data?: {
    features: Feature[];
    total: number;
  };
}

/**
 * Subscribe API request
 */
export interface SubscribeRequest {
  featureCode: string;
  period: SubscriptionPeriod;
}

/**
 * Subscribe API response
 */
export interface SubscribeResponse {
  success: boolean;
  message: string;
  data?: {
    featureCode: string;
    featureName?: string;
    period: SubscriptionPeriod | null;
    cost: number;
    expiresAt: string | null;
  };
}

/**
 * Subscription with feature details (from subscriptions API)
 */
export interface SubscriptionWithFeature {
  id: number;
  featureCode: string;
  featureName: string;
  featureDescription: string | null;
  featureIcon: string | null;
  isFree: boolean;
  status: SubscriptionStatus;
  dbStatus: string;
  startedAt: string;
  expiresAt: string | null;
  createdAt: string;
  daysUntilExpiration: number | null;
  isPermanent: boolean;
}

/**
 * Subscriptions summary
 */
export interface SubscriptionsSummary {
  total: number;
  active: number;
  expiringSoon: number;
  expired: number;
  permanent: number;
}

/**
 * Subscriptions API response
 */
export interface SubscriptionsResponse {
  success: boolean;
  message?: string;
  data?: {
    subscriptions: SubscriptionWithFeature[];
    summary: SubscriptionsSummary;
  };
}


/**
 * FeatureCard component props
 */
export interface FeatureCardProps {
  feature: Feature;
  onActivate?: (feature: Feature) => void;
}

/**
 * SubscribeModal component props
 */
export interface SubscribeModalProps {
  feature: Feature | null;
  visible: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubscribe: (period: SubscriptionPeriod) => void;
}

/**
 * FeatureManager component props
 */
export interface FeatureManagerProps {
  /** Title to display */
  title?: string;
  /** Callback when a feature is activated */
  onFeatureActivated?: (featureCode: string) => void;
}
