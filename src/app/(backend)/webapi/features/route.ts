import { sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { enableBetterAuth, enableNextAuth } from '@/const/auth';
import { getServerDB } from '@/database/core/db-adaptor';
import { createErrorResponse, getErrorStatusCode } from '@/services/oneapi';

/**
 * Feature type definition
 */
interface Feature {
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  price_weekly: string | null;
  price_monthly: string | null;
  price_yearly: string | null;
  is_free: boolean;
  is_enabled: boolean;
  sort_order: number;
  created_at: Date;
}

/**
 * Subscription type definition
 */
interface Subscription {
  feature_code: string;
  status: string;
  expires_at: Date | null;
}

/**
 * GET /webapi/features
 *
 * Fetches all enabled features with user's subscription status
 * Requires authentication
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 * Property 12: Feature list completeness
 * Property 13: Free feature display
 * Property 14: Subscription badge display
 * Property 15: Feature sorting
 */
export async function GET(request: NextRequest) {
  try {
    // Get user session based on auth method
    let userId: string | undefined;

    if (enableNextAuth) {
      const { default: NextAuth } = await import('@/libs/next-auth');
      const session = await NextAuth.auth();
      userId = session?.user?.id;
    } else if (enableBetterAuth) {
      const { auth } = await import('@/auth');
      const session = await auth.api.getSession({
        headers: request.headers,
      });
      userId = session?.user?.id;
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, message: '未登录，请先登录' },
        { status: 401 }
      );
    }

    const serverDB = await getServerDB();

    // Query all enabled features, sorted by sort_order (Requirement 6.5)
    const featuresResult = await serverDB.execute(sql`
      SELECT code, name, description, icon, price_weekly, price_monthly, price_yearly,
             is_free, is_enabled, sort_order, created_at
      FROM features
      WHERE is_enabled = true
      ORDER BY sort_order ASC
    `);

    // Query user's subscriptions
    const subscriptionsResult = await serverDB.execute(sql`
      SELECT feature_code, status, expires_at
      FROM feature_subscriptions
      WHERE user_id = ${userId}
    `);

    const features = (featuresResult.rows || []) as unknown as Feature[];
    const subscriptions = (subscriptionsResult.rows || []) as unknown as Subscription[];

    // Create a map of subscriptions for quick lookup
    const subscriptionMap = new Map<string, Subscription>();
    for (const sub of subscriptions) {
      subscriptionMap.set(sub.feature_code, sub);
    }

    // Transform features with subscription status
    const transformedFeatures = features.map(feature => {
      const subscription = subscriptionMap.get(feature.code);
      const now = new Date();

      // Determine subscription status
      let subscriptionStatus: 'active' | 'expired' | 'expiring_soon' | 'none' = 'none';
      let expiresAt: string | null = null;

      if (subscription) {
        expiresAt = subscription.expires_at ? subscription.expires_at.toISOString() : null;

        if (subscription.status === 'active') {
          if (subscription.expires_at === null) {
            // Free feature with no expiration
            subscriptionStatus = 'active';
          } else if (new Date(subscription.expires_at) < now) {
            // Expired
            subscriptionStatus = 'expired';
          } else {
            // Check if expiring within 7 days (Requirement 8.3)
            const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            if (new Date(subscription.expires_at) <= sevenDaysFromNow) {
              subscriptionStatus = 'expiring_soon';
            } else {
              subscriptionStatus = 'active';
            }
          }
        } else if (subscription.status === 'expired') {
          subscriptionStatus = 'expired';
        }
      }

      return {
        code: feature.code,
        name: feature.name,
        description: feature.description,
        icon: feature.icon,
        // Pricing (Requirement 6.2, 6.3)
        pricing: {
          weekly: feature.is_free ? 0 : parseFloat(feature.price_weekly || '0'),
          monthly: feature.is_free ? 0 : parseFloat(feature.price_monthly || '0'),
          yearly: feature.is_free ? 0 : parseFloat(feature.price_yearly || '0'),
        },
        isFree: feature.is_free,
        sortOrder: feature.sort_order,
        // Subscription status (Requirement 6.4, 8.2, 8.3, 8.4)
        subscription: {
          status: subscriptionStatus,
          expiresAt,
          isSubscribed: subscriptionStatus === 'active' || subscriptionStatus === 'expiring_soon',
        },
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        features: transformedFeatures,
        total: transformedFeatures.length,
      },
    });
  } catch (error) {
    // Use centralized error handling (Requirements: 10.1)
    const errorResponse = createErrorResponse(error, {
      operation: 'fetchFeatures',
      endpoint: '/webapi/features',
    });

    return NextResponse.json(errorResponse, {
      status: getErrorStatusCode(error),
    });
  }
}
