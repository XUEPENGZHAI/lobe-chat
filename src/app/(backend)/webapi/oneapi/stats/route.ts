import { sql } from 'drizzle-orm';
import * as crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { enableBetterAuth, enableNextAuth } from '@/const/auth';
import { getServerDB } from '@/database/core/db-adaptor';
import { OneAPIService } from '@/services/oneapi';

// Decryption constants (must match encryption in OneAPISyncService)
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get encryption key from environment
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ONEAPI_TOKEN_ENCRYPTION_KEY || 'default-dev-key-32-chars-long!!';
  return crypto.scryptSync(key, 'salt', 32);
}

/**
 * Decrypt one-api token
 */
function decryptToken(encryptedData: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedData, 'base64');

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Get one-api token for a user
 */
async function getOneAPITokenForUser(userId: string): Promise<string | null> {
  try {
    const serverDB = await getServerDB();

    const result = await serverDB.execute(sql`
      SELECT oneapi_token_encrypted FROM users WHERE id = ${userId}
    `);

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as { oneapi_token_encrypted: string | null };
    const encryptedToken = row.oneapi_token_encrypted;

    if (!encryptedToken) {
      return null;
    }

    return decryptToken(encryptedToken);
  } catch (error) {
    console.error('Error getting one-api token for user:', error);
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

    // Get user's one-api token from database
    const oneapiToken = await getOneAPITokenForUser(userId);

    if (!oneapiToken) {
      return NextResponse.json(
        { success: false, message: 'one-api 账号未关联，请联系管理员' },
        { status: 400 }
      );
    }

    // Fetch statistics from one-api
    const oneAPIService = new OneAPIService();
    const statistics = await oneAPIService.getStatistics(oneapiToken, startTime, now);

    if (!statistics.success) {
      return NextResponse.json(
        { success: false, message: statistics.message || '获取统计数据失败' },
        { status: 400 }
      );
    }

    // Calculate summary statistics (Requirement 4.1)
    const data = statistics.data || [];
    const totalCalls = data.reduce((sum, item) => sum + item.request_count, 0);
    const totalQuota = data.reduce((sum, item) => sum + item.quota, 0);
    const averageQuota = totalCalls > 0 ? totalQuota / totalCalls : 0;

    return NextResponse.json({
      success: true,
      data: {
        // Summary statistics
        summary: {
          totalCalls,
          totalQuota,
          averageQuota,
        },
        // Daily trend data for chart (Requirement 4.2)
        trend: data.map(item => ({
          date: item.date,
          calls: item.request_count,
          quota: item.quota,
        })),
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
