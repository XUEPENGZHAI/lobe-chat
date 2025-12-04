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
 * This retrieves the encrypted token from the user record and decrypts it
 */
async function getOneAPITokenForUser(userId: string): Promise<string | null> {
  try {
    const serverDB = await getServerDB();

    // Query user's one-api token using raw SQL (field added via init-db.sql)
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

    // Decrypt the token
    return decryptToken(encryptedToken);
  } catch (error) {
    console.error('Error getting one-api token for user:', error);
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

    // Get user's one-api token from database
    const oneapiToken = await getOneAPITokenForUser(userId);

    if (!oneapiToken) {
      return NextResponse.json(
        { success: false, message: 'one-api 账号未关联，请联系管理员' },
        { status: 400 }
      );
    }

    // Fetch user info from one-api
    const oneAPIService = new OneAPIService();
    const userInfo = await oneAPIService.getUserInfo(oneapiToken);

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
