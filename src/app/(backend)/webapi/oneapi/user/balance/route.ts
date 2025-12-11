import { sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { enableBetterAuth, enableNextAuth } from '@/const/auth';
import { getServerDB } from '@/database/core/db-adaptor';

/**
 * Get one-api user ID for a user
 */
async function getOneAPIUserIdForUser(userId: string): Promise<number | null> {
  try {
    const serverDB = await getServerDB();

    const result = await serverDB.execute(sql`
      SELECT oneapi_user_id FROM users WHERE id = ${userId}
    `);

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as { oneapi_user_id: number | null };
    return row.oneapi_user_id;
  } catch (error) {
    console.error('Error getting one-api user ID:', error);
    return null;
  }
}

/**
 * Get user info from one-api using admin API
 */
async function getOneAPIUserInfoViaAdmin(oneapiUserId: number): Promise<{
  quota: number;
  used_quota: number;
  request_count: number;
} | null> {
  try {
    const adminToken = process.env.ONEAPI_ADMIN_TOKEN;
    if (!adminToken) {
      console.error('ONEAPI_ADMIN_TOKEN not configured');
      return null;
    }

    const response = await fetch(
      `${process.env.ONEAPI_BASE_URL || 'http://one-api:3000'}/api/user/${oneapiUserId}`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('Failed to get user info from one-api:', response.status);
      return null;
    }

    const result = await response.json();
    if (!result.success || !result.data) {
      console.error('Invalid response from one-api:', result.message);
      return null;
    }

    return {
      quota: result.data.quota || 0,
      used_quota: result.data.used_quota || 0,
      request_count: result.data.request_count || 0,
    };
  } catch (error) {
    console.error('Error getting user info from one-api:', error);
    return null;
  }
}


/**
 * GET /webapi/oneapi/user/balance
 *
 * Fetches user balance from one-api
 * Requires authentication (currently using next-auth)
 *
 * Requirements: 2.1, 2.3
 */
export async function GET(request: NextRequest) {
  try {
    // Get user session based on auth method
    // Note: Current system uses next-auth (as of 2024-11-28)
    let userId: string | undefined;

    if (enableNextAuth) {
      // Primary auth method: next-auth
      const { default: NextAuth } = await import('@/libs/next-auth');
      const session = await NextAuth.auth();
      userId = session?.user?.id;
    } else if (enableBetterAuth) {
      // Fallback: better-auth (for future compatibility)
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

    // Get user's one-api user ID from database
    const oneapiUserId = await getOneAPIUserIdForUser(userId);

    if (!oneapiUserId) {
      return NextResponse.json(
        { success: false, message: 'one-api 账号未关联，请联系管理员' },
        { status: 400 }
      );
    }

    // Fetch user info from one-api using admin API
    const userInfo = await getOneAPIUserInfoViaAdmin(oneapiUserId);

    if (!userInfo) {
      return NextResponse.json(
        { success: false, message: '获取用户信息失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        quota: userInfo.quota,
        used_quota: userInfo.used_quota,
        request_count: userInfo.request_count,
      },
    });
  } catch (error) {
    console.error('Error fetching balance from one-api:', error);

    const errorMessage = error instanceof Error ? error.message : '获取余额失败';

    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}
