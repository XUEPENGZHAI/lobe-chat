import { NextRequest, NextResponse } from 'next/server';

import { enableBetterAuth, enableNextAuth } from '@/const/auth';
import { fetchOneAPIUserInfoViaAdmin } from '@/app/(backend)/webapi/oneapi/utils';
import { ensureOneAPIUserId } from '@/server/services/oneapiSync/credentials';

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
    const oneapiUserId = await ensureOneAPIUserId(userId);

    if (!oneapiUserId) {
      return NextResponse.json(
        { success: false, message: 'one-api 账号未关联，请联系管理员' },
        { status: 400 }
      );
    }

    // Fetch user info from one-api using admin API
    const userInfo = await fetchOneAPIUserInfoViaAdmin(oneapiUserId);

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
