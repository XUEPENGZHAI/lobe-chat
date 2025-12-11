import { sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { enableBetterAuth, enableNextAuth } from '@/const/auth';
import { getServerDB } from '@/database/core/db-adaptor';
import { createErrorResponse, getErrorStatusCode } from '@/services/oneapi';

/**
 * Subscription with feature details
 */
interface SubscriptionWithFeature {
  id: number;
  user_id: string;
  feature_code: string;
  status: string;
  started_at: Date;
  expires_at: Date | null;
  created_at: Date;
  feature_name: string;
  feature_description: string | null;
  feature_icon: string | null;
  is_free: boolean;
}

/**
 * GET /webapi/features/subscriptions
 *
 * Fetches all subscriptions for the current user
 * Requires authentication
 *
 * Query params:
 * - status: string (optional, filter by status: 'active', 'expired', 'all')
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 * Property 19: Expiration warning display
 * Property 20: Expired subscription status
 * Property 21: Free feature permanent access
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

    // Parse query params
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || 'all';

    const serverDB = await getServerDB();

    // Query subscriptions with feature details
    const subscriptionsResult = await serverDB.execute(sql`
      SELECT
        fs.id,
        fs.user_id,
        fs.feature_code,
        fs.status,
        fs.started_at,
        fs.expires_at,
        fs.created_at,
        f.name as feature_name,
        f.description as feature_description,
        f.icon as feature_icon,
        f.is_free
      FROM feature_subscriptions fs
      JOIN features f ON fs.feature_code = f.code
      WHERE fs.user_id = ${userId}
      ORDER BY fs.created_at DESC
    `);

    const subscriptions = (subscriptionsResult.rows || []) as unknown as SubscriptionWithFeature[];
    const now = new Date();

    // Transform and calculate status
    const transformedSubscriptions = subscriptions.map(sub => {
      let computedStatus: 'active' | 'expired' | 'expiring_soon' = 'active';
      let daysUntilExpiration: number | null = null;

      if (sub.expires_at === null) {
        // Free feature with permanent access (Requirement 8.5)
        computedStatus = 'active';
        daysUntilExpiration = null;
      } else {
        const expiresAt = new Date(sub.expires_at);
        const timeDiff = expiresAt.getTime() - now.getTime();
        daysUntilExpiration = Math.ceil(timeDiff / (24 * 60 * 60 * 1000));

        if (timeDiff < 0) {
          // Expired (Requirement 8.4)
          computedStatus = 'expired';
        } else if (daysUntilExpiration <= 7) {
          // Expiring soon - within 7 days (Requirement 8.3)
          computedStatus = 'expiring_soon';
        } else {
          computedStatus = 'active';
        }
      }

      return {
        createdAt: sub.created_at,
        daysUntilExpiration,
        dbStatus: sub.status, // Original status from database
        expiresAt: sub.expires_at,
        featureCode: sub.feature_code,
        featureDescription: sub.feature_description,
        featureIcon: sub.feature_icon,
        featureName: sub.feature_name,
        id: sub.id,
        isFree: sub.is_free,
        isPermanent: sub.expires_at === null,
        startedAt: sub.started_at,
        status: computedStatus,
      };
    });

    // Filter by status if requested
    let filteredSubscriptions = transformedSubscriptions;
    if (statusFilter === 'active') {
      filteredSubscriptions = transformedSubscriptions.filter(
        sub => sub.status === 'active' || sub.status === 'expiring_soon'
      );
    } else if (statusFilter === 'expired') {
      filteredSubscriptions = transformedSubscriptions.filter(
        sub => sub.status === 'expired'
      );
    }

    // Calculate summary
    const summary = {
      total: transformedSubscriptions.length,
      active: transformedSubscriptions.filter(s => s.status === 'active').length,
      expiringSoon: transformedSubscriptions.filter(s => s.status === 'expiring_soon').length,
      expired: transformedSubscriptions.filter(s => s.status === 'expired').length,
      permanent: transformedSubscriptions.filter(s => s.isPermanent).length,
    };

    return NextResponse.json({
      success: true,
      data: {
        subscriptions: filteredSubscriptions,
        summary,
      },
    });
  } catch (error) {
    // Use centralized error handling (Requirements: 10.1)
    const errorResponse = createErrorResponse(error, {
      operation: 'fetchSubscriptions',
      endpoint: '/webapi/features/subscriptions',
    });

    return NextResponse.json(errorResponse, {
      status: getErrorStatusCode(error),
    });
  }
}
