import { sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { enableBetterAuth, enableNextAuth } from '@/const/auth';
import { getServerDB } from '@/database/core/db-adaptor';
import { createErrorResponse, getErrorStatusCode } from '@/services/oneapi';

/**
 * Feature update input type
 */
interface FeatureUpdateInput {
  name?: string;
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
 * GET /webapi/admin/features/[code]
 *
 * Fetches a single feature by code
 * Requires admin authentication
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
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

    const { code } = await params;

    const serverDB = await getServerDB();

    // Query feature
    const featureResult = await serverDB.execute(sql`
      SELECT code, name, description, icon, price_weekly, price_monthly, price_yearly,
             is_free, is_enabled, sort_order, created_at
      FROM features
      WHERE code = ${code}
    `);

    if (!featureResult.rows || featureResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: '功能不存在' },
        { status: 404 }
      );
    }

    const feature = featureResult.rows[0] as any;

    // Get subscription count
    const subscriptionCountResult = await serverDB.execute(sql`
      SELECT COUNT(*) as count
      FROM feature_subscriptions
      WHERE feature_code = ${code} AND status = 'active'
    `);

    const subscriptionCount = parseInt((subscriptionCountResult.rows?.[0] as any)?.count || '0', 10);

    return NextResponse.json({
      success: true,
      data: {
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
        subscriptionCount,
      },
    });
  } catch (error) {
    // Use centralized error handling (Requirements: 10.1)
    const errorResponse = createErrorResponse(error, {
      operation: 'fetchFeature',
      endpoint: '/webapi/admin/features/[code]',
    });

    return NextResponse.json(errorResponse, {
      status: getErrorStatusCode(error),
    });
  }
}


/**
 * PATCH /webapi/admin/features/[code]
 *
 * Updates a feature (enable/disable, pricing, etc.)
 * Requires admin authentication
 *
 * Request body (all fields optional):
 * - name?: string
 * - description?: string
 * - icon?: string
 * - price_weekly?: number
 * - price_monthly?: number
 * - price_yearly?: number
 * - is_free?: boolean
 * - is_enabled?: boolean
 * - sort_order?: number
 *
 * Requirements: 9.2, 9.3
 * Property 23: Disabled feature hiding
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
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

    const { code } = await params;
    const body = await request.json() as FeatureUpdateInput;

    const serverDB = await getServerDB();

    // Check if feature exists
    const existingResult = await serverDB.execute(sql`
      SELECT code, name, description, icon, price_weekly, price_monthly, price_yearly,
             is_free, is_enabled, sort_order
      FROM features
      WHERE code = ${code}
    `);

    if (!existingResult.rows || existingResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: '功能不存在' },
        { status: 404 }
      );
    }

    const existing = existingResult.rows[0] as any;

    // Build update fields
    const updates: string[] = [];
    const values: any[] = [];

    if (body.name !== undefined) {
      updates.push('name');
      values.push(body.name);
    }
    if (body.description !== undefined) {
      updates.push('description');
      values.push(body.description);
    }
    if (body.icon !== undefined) {
      updates.push('icon');
      values.push(body.icon);
    }
    if (body.price_weekly !== undefined) {
      updates.push('price_weekly');
      values.push(body.price_weekly);
    }
    if (body.price_monthly !== undefined) {
      updates.push('price_monthly');
      values.push(body.price_monthly);
    }
    if (body.price_yearly !== undefined) {
      updates.push('price_yearly');
      values.push(body.price_yearly);
    }
    if (body.is_free !== undefined) {
      updates.push('is_free');
      values.push(body.is_free);
    }
    if (body.is_enabled !== undefined) {
      updates.push('is_enabled');
      values.push(body.is_enabled);
    }
    if (body.sort_order !== undefined) {
      updates.push('sort_order');
      values.push(body.sort_order);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, message: '没有要更新的字段' },
        { status: 400 }
      );
    }

    // Build and execute update query
    // Using individual field updates for type safety
    const newName = body.name ?? existing.name;
    const newDescription = body.description ?? existing.description;
    const newIcon = body.icon ?? existing.icon;
    const newPriceWeekly = body.price_weekly ?? parseFloat(existing.price_weekly || '0');
    const newPriceMonthly = body.price_monthly ?? parseFloat(existing.price_monthly || '0');
    const newPriceYearly = body.price_yearly ?? parseFloat(existing.price_yearly || '0');
    const newIsFree = body.is_free ?? existing.is_free;
    const newIsEnabled = body.is_enabled ?? existing.is_enabled;
    const newSortOrder = body.sort_order ?? existing.sort_order;

    await serverDB.execute(sql`
      UPDATE features
      SET name = ${newName},
          description = ${newDescription},
          icon = ${newIcon},
          price_weekly = ${newPriceWeekly},
          price_monthly = ${newPriceMonthly},
          price_yearly = ${newPriceYearly},
          is_free = ${newIsFree},
          is_enabled = ${newIsEnabled},
          sort_order = ${newSortOrder}
      WHERE code = ${code}
    `);

    // Log the action
    const changedFields = updates.join(', ');
    console.log(`Admin ${userId} updated feature ${code}: ${changedFields}`);

    // Special logging for enable/disable (Requirement 9.2)
    if (body.is_enabled !== undefined) {
      console.log(`Admin ${userId} ${body.is_enabled ? 'enabled' : 'disabled'} feature: ${code}`);
    }

    // Special logging for price update (Requirement 9.3)
    if (body.price_weekly !== undefined || body.price_monthly !== undefined || body.price_yearly !== undefined) {
      console.log(`Admin ${userId} updated pricing for feature ${code}: weekly=${newPriceWeekly}, monthly=${newPriceMonthly}, yearly=${newPriceYearly}`);
    }

    return NextResponse.json({
      success: true,
      message: '功能更新成功',
      data: {
        code,
        name: newName,
        description: newDescription,
        icon: newIcon,
        pricing: {
          weekly: newPriceWeekly,
          monthly: newPriceMonthly,
          yearly: newPriceYearly,
        },
        isFree: newIsFree,
        isEnabled: newIsEnabled,
        sortOrder: newSortOrder,
        updatedFields: updates,
      },
    });
  } catch (error) {
    // Use centralized error handling (Requirements: 10.1)
    const errorResponse = createErrorResponse(error, {
      operation: 'updateFeature',
      endpoint: '/webapi/admin/features/[code]',
    });

    return NextResponse.json(errorResponse, {
      status: getErrorStatusCode(error),
    });
  }
}


/**
 * DELETE /webapi/admin/features/[code]
 *
 * Deletes a feature (soft delete by disabling, or hard delete if no subscriptions)
 * Requires admin authentication
 *
 * Query params:
 * - force: boolean (if true, hard delete even with subscriptions)
 *
 * Requirements: 9.4
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
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

    const { code } = await params;
    const { searchParams } = new URL(request.url);
    const forceDelete = searchParams.get('force') === 'true';

    const serverDB = await getServerDB();

    // Check if feature exists
    const existingResult = await serverDB.execute(sql`
      SELECT code, name FROM features WHERE code = ${code}
    `);

    if (!existingResult.rows || existingResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: '功能不存在' },
        { status: 404 }
      );
    }

    // Check for active subscriptions
    const subscriptionCountResult = await serverDB.execute(sql`
      SELECT COUNT(*) as count
      FROM feature_subscriptions
      WHERE feature_code = ${code} AND status = 'active'
    `);

    const activeSubscriptions = parseInt((subscriptionCountResult.rows?.[0] as any)?.count || '0', 10);

    if (activeSubscriptions > 0 && !forceDelete) {
      // Soft delete: just disable the feature (Requirement 9.4 - existing subscriptions remain valid)
      await serverDB.execute(sql`
        UPDATE features SET is_enabled = false WHERE code = ${code}
      `);

      console.log(`Admin ${userId} soft-deleted (disabled) feature ${code} with ${activeSubscriptions} active subscriptions`);

      return NextResponse.json({
        success: true,
        message: `功能已禁用（保留 ${activeSubscriptions} 个有效订阅）`,
        data: {
          code,
          action: 'disabled',
          activeSubscriptions,
        },
      });
    }

    // Hard delete: remove the feature and all subscriptions
    // First delete subscriptions (due to foreign key)
    await serverDB.execute(sql`
      DELETE FROM feature_subscriptions WHERE feature_code = ${code}
    `);

    // Then delete the feature
    await serverDB.execute(sql`
      DELETE FROM features WHERE code = ${code}
    `);

    console.log(`Admin ${userId} hard-deleted feature ${code}`);

    return NextResponse.json({
      success: true,
      message: '功能已删除',
      data: {
        code,
        action: 'deleted',
      },
    });
  } catch (error) {
    // Use centralized error handling (Requirements: 10.1)
    const errorResponse = createErrorResponse(error, {
      operation: 'deleteFeature',
      endpoint: '/webapi/admin/features/[code]',
    });

    return NextResponse.json(errorResponse, {
      status: getErrorStatusCode(error),
    });
  }
}
