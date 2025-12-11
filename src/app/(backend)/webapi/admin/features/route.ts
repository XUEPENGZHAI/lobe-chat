import { sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { enableBetterAuth, enableNextAuth } from '@/const/auth';
import { getServerDB } from '@/database/core/db-adaptor';
import { createErrorResponse, getErrorStatusCode, logError } from '@/services/oneapi';

/**
 * Feature input type for creating/updating features
 */
interface FeatureInput {
  code: string;
  name: string;
  description?: string;
  icon?: string;
  price_weekly?: number;
  price_monthly?: number;
  price_yearly?: number;
  is_free?: boolean;
  is_enabled?: boolean;
  sort_order?: number;
}

/**
 * Check if user is admin
 * For now, we check if user has 'admin' role in rbac_user_roles
 */
async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    const serverDB = await getServerDB();

    const result = await serverDB.execute(sql`
      SELECT ur.user_id
      FROM rbac_user_roles ur
      JOIN rbac_roles r ON ur.role_id = r.id
      WHERE ur.user_id = ${userId}
        AND r.name = 'admin'
        AND r.is_active = true
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    `);

    return result.rows && result.rows.length > 0;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Get authenticated user ID
 */
async function getAuthenticatedUserId(request: NextRequest): Promise<string | undefined> {
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

  return userId;
}


/**
 * GET /webapi/admin/features
 *
 * Fetches all features (including disabled ones) for admin management
 * Requires admin authentication
 *
 * Requirements: 9.1, 9.2
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);

    if (!userId) {
      return NextResponse.json(
        { success: false, message: '未登录，请先登录' },
        { status: 401 }
      );
    }

    // Check admin permission
    const isAdmin = await isUserAdmin(userId);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: '无权限访问，需要管理员权限' },
        { status: 403 }
      );
    }

    const serverDB = await getServerDB();

    // Query all features (including disabled ones)
    const featuresResult = await serverDB.execute(sql`
      SELECT code, name, description, icon, price_weekly, price_monthly, price_yearly,
             is_free, is_enabled, sort_order, created_at
      FROM features
      ORDER BY sort_order ASC, created_at DESC
    `);

    // Get subscription counts for each feature
    const subscriptionCountsResult = await serverDB.execute(sql`
      SELECT feature_code, COUNT(*) as subscription_count
      FROM feature_subscriptions
      WHERE status = 'active'
      GROUP BY feature_code
    `);

    const subscriptionCounts = new Map<string, number>();
    for (const row of (subscriptionCountsResult.rows || []) as { feature_code: string; subscription_count: string }[]) {
      subscriptionCounts.set(row.feature_code, parseInt(row.subscription_count, 10));
    }

    const features = (featuresResult.rows || []).map((feature: any) => ({
      code: feature.code,
      name: feature.name,
      description: feature.description,
      icon: feature.icon,
      pricing: {
        weekly: parseFloat(feature.price_weekly || '0'),
        monthly: parseFloat(feature.price_monthly || '0'),
        yearly: parseFloat(feature.price_yearly || '0'),
      },
      isFree: feature.is_free,
      isEnabled: feature.is_enabled,
      sortOrder: feature.sort_order,
      createdAt: feature.created_at,
      subscriptionCount: subscriptionCounts.get(feature.code) || 0,
    }));

    return NextResponse.json({
      success: true,
      data: {
        features,
        total: features.length,
      },
    });
  } catch (error) {
    // Use centralized error handling (Requirements: 10.1)
    const errorResponse = createErrorResponse(error, {
      operation: 'fetchAdminFeatures',
      endpoint: '/webapi/admin/features',
    });

    return NextResponse.json(errorResponse, {
      status: getErrorStatusCode(error),
    });
  }
}


/**
 * POST /webapi/admin/features
 *
 * Creates a new feature
 * Requires admin authentication
 *
 * Request body:
 * - code: string (unique feature code)
 * - name: string (feature name)
 * - description?: string (feature description)
 * - icon?: string (feature icon)
 * - price_weekly?: number (weekly price)
 * - price_monthly?: number (monthly price)
 * - price_yearly?: number (yearly price)
 * - is_free?: boolean (whether feature is free)
 * - is_enabled?: boolean (whether feature is enabled)
 * - sort_order?: number (display order)
 *
 * Requirements: 9.1
 * Property 22: New feature visibility
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);

    if (!userId) {
      return NextResponse.json(
        { success: false, message: '未登录，请先登录' },
        { status: 401 }
      );
    }

    // Check admin permission
    const isAdmin = await isUserAdmin(userId);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: '无权限访问，需要管理员权限' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json() as FeatureInput;

    // Validate required fields
    if (!body.code || !body.code.trim()) {
      return NextResponse.json(
        { success: false, message: '功能代码不能为空' },
        { status: 400 }
      );
    }

    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { success: false, message: '功能名称不能为空' },
        { status: 400 }
      );
    }

    // Validate code format (alphanumeric and underscore only)
    if (!/^[a-z][a-z0-9_]*$/.test(body.code)) {
      return NextResponse.json(
        { success: false, message: '功能代码格式无效，只能包含小写字母、数字和下划线，且必须以字母开头' },
        { status: 400 }
      );
    }

    const serverDB = await getServerDB();

    // Check if feature code already exists
    const existingResult = await serverDB.execute(sql`
      SELECT code FROM features WHERE code = ${body.code}
    `);

    if (existingResult.rows && existingResult.rows.length > 0) {
      return NextResponse.json(
        { success: false, message: '功能代码已存在' },
        { status: 400 }
      );
    }

    // Set default values
    const priceWeekly = body.price_weekly ?? 0;
    const priceMonthly = body.price_monthly ?? 0;
    const priceYearly = body.price_yearly ?? 0;
    const isFree = body.is_free ?? false;
    const isEnabled = body.is_enabled ?? true;
    const sortOrder = body.sort_order ?? 0;

    // Insert new feature
    await serverDB.execute(sql`
      INSERT INTO features (code, name, description, icon, price_weekly, price_monthly, price_yearly, is_free, is_enabled, sort_order)
      VALUES (${body.code}, ${body.name}, ${body.description || null}, ${body.icon || null},
              ${priceWeekly}, ${priceMonthly}, ${priceYearly}, ${isFree}, ${isEnabled}, ${sortOrder})
    `);

    console.log(`Admin ${userId} created feature: ${body.code}`);

    return NextResponse.json({
      success: true,
      message: '功能创建成功',
      data: {
        code: body.code,
        name: body.name,
        description: body.description || null,
        icon: body.icon || null,
        pricing: {
          weekly: priceWeekly,
          monthly: priceMonthly,
          yearly: priceYearly,
        },
        isFree,
        isEnabled,
        sortOrder,
      },
    });
  } catch (error) {
    // Use centralized error handling (Requirements: 10.1)
    const errorResponse = createErrorResponse(error, {
      operation: 'createFeature',
      endpoint: '/webapi/admin/features',
    });

    return NextResponse.json(errorResponse, {
      status: getErrorStatusCode(error),
    });
  }
}
