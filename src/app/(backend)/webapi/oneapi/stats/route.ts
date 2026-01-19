import { NextRequest, NextResponse } from 'next/server';

import { enableBetterAuth, enableNextAuth } from '@/const/auth';
import { ONEAPI_BASE_URL, fetchOneAPIUserInfoViaAdmin } from '@/app/(backend)/webapi/oneapi/utils';
import { ensureOneAPIUserId } from '@/server/services/oneapiSync/credentials';

const ONEAPI_PAGE_SIZE = 10; // one-api uses server-side ItemsPerPage (default 10)
const MAX_PAGES = 200; // safety guard to avoid infinite loops

interface OneAPILogEntry {
  id: number;
  created_at: number;
  quota: number;
  model_name?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
}

function extractLogs(result: any): OneAPILogEntry[] {
  if (Array.isArray(result?.data?.logs)) return result.data.logs;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result)) return result;
  return [];
}

async function fetchUserConsumeLogs(
  username: string,
  startTimestamp: number,
  endTimestamp: number,
): Promise<OneAPILogEntry[]> {
  const adminToken = process.env.ONEAPI_ADMIN_TOKEN;
  if (!adminToken) {
    throw new Error('管理员 token 未配置');
  }

  const logs: OneAPILogEntry[] = [];
  let page = 0;

  while (page < MAX_PAGES) {
    const response = await fetch(
      `${ONEAPI_BASE_URL}/api/log/?p=${page}&type=2&username=${encodeURIComponent(username)}&start_timestamp=${startTimestamp}&end_timestamp=${endTimestamp}`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      throw new Error(`获取消费记录失败: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || '获取消费记录失败');
    }

    const pageLogs = extractLogs(result);
    logs.push(...pageLogs);

    if (pageLogs.length < ONEAPI_PAGE_SIZE) break;
    page += 1;
  }

  return logs;
}

/**
 * GET /webapi/oneapi/stats
 *
 * Fetches usage statistics from one-api
 * Requires authentication
 *
 * Query params:
 * - days: number (number of days to fetch, default 30)
 */
export async function GET(request: NextRequest) {
  try {
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
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const days = Math.max(parseInt(searchParams.get('days') || '30', 10), 1);

    const now = Math.floor(Date.now() / 1000);
    const startTime = now - days * 24 * 60 * 60;

    const oneapiUserId = await ensureOneAPIUserId(userId);

    if (!oneapiUserId) {
      return NextResponse.json(
        { success: false, message: 'one-api 账号未关联，请联系管理员' },
        { status: 400 },
      );
    }

    const userInfo = await fetchOneAPIUserInfoViaAdmin(oneapiUserId);
    if (!userInfo?.username) {
      return NextResponse.json(
        { success: false, message: '获取 one-api 用户信息失败' },
        { status: 500 },
      );
    }

    const consumeLogs = await fetchUserConsumeLogs(userInfo.username, startTime, now);

    const totalCalls = consumeLogs.length;
    const totalQuota = consumeLogs.reduce((sum, log) => sum + (log.quota || 0), 0);
    const averageQuota = totalCalls > 0 ? totalQuota / totalCalls : 0;

    const trendMap = new Map<string, { calls: number; quota: number }>();
    consumeLogs.forEach((log) => {
      const date = new Date((log.created_at || 0) * 1000).toISOString().slice(0, 10);
      const existing = trendMap.get(date) || { calls: 0, quota: 0 };
      trendMap.set(date, {
        calls: existing.calls + 1,
        quota: existing.quota + (log.quota || 0),
      });
    });

    const trend = Array.from(trendMap.entries())
      .map(([date, value]) => ({ date, calls: value.calls, quota: value.quota }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalCalls,
          totalQuota,
          averageQuota,
        },
        trend,
      },
    });
  } catch (error) {
    console.error('Error fetching statistics from one-api:', error);

    const errorMessage = error instanceof Error ? error.message : '获取统计数据失败';

    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 },
    );
  }
}
