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
 * GET /webapi/oneapi/stats
 *
 * Fetches usage statistics from one-api
 * Requires authentication
 *
 * Query params:
 * - days: number (number of days to fetch, default 30)
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4
 * Property 9: Statistics display completeness
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
    const days = parseInt(searchParams.get('days') || '30', 10);

    // Calculate time range
    const now = Math.floor(Date.now() / 1000);
    const startTime = now - days * 24 * 60 * 60;

    // Get user's one-api user ID from database
    const oneapiUserId = await getOneAPIUserIdForUser(userId);

    if (!oneapiUserId) {
      return NextResponse.json(
        { success: false, message: 'one-api 账号未关联，请联系管理员' },
        { status: 400 }
      );
    }

    // Fetch statistics from one-api using admin API
    const adminToken = process.env.ONEAPI_ADMIN_TOKEN;
    if (!adminToken) {
      return NextResponse.json(
        { success: false, message: '管理员 token 未配置' },
        { status: 500 }
      );
    }

    const response = await fetch(
      `${process.env.ONEAPI_BASE_URL || 'http://one-api:3000'}/api/log/stat?start_timestamp=${startTime}&end_timestamp=${now}&username=`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: `获取统计数据失败: ${response.status}` },
        { status: 400 }
      );
    }

    const result = await response.json();
    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message || '获取统计数据失败' },
        { status: 400 }
      );
    }

    // one-api /api/log/stat returns {quota: number} object, not an array
    const statData = result.data || { quota: 0 };
    const totalQuota = statData.quota || 0;

    // For detailed stats, we need to query logs and aggregate
    // For now, return the summary from stat API
    return NextResponse.json({
      success: true,
      data: {
        // Summary statistics
        summary: {
          totalCalls: 0, // Not available from stat API
          totalQuota,
          averageQuota: 0,
        },
        // Daily trend data (empty for now, would need separate API)
        trend: [],
      },
    });
  } catch (error) {
    console.error('Error fetching statistics from one-api:', error);

    const errorMessage = error instanceof Error ? error.message : '获取统计数据失败';

    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}
