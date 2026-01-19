import * as crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { enableBetterAuth, enableNextAuth } from '@/const/auth';
import { OneAPIService } from '@/services/oneapi';
import { ensureOneAPIToken } from '@/server/services/oneapiSync/credentials';

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

  // encrypted 已经是原始字节，直接解密
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Validate top-up amount
 * Amount must be greater than zero
 *
 * Requirements: 3.2
 * Property 6: Top-up amount validation
 */
function validateTopupAmount(amount: unknown): amount is number {
  return typeof amount === 'number' && !isNaN(amount) && amount > 0;
}

/**
 * POST /webapi/oneapi/topup
 *
 * Creates a top-up order in one-api
 * Requires authentication
 *
 * Request body:
 * - amount: number (top-up amount in yuan, must be > 0)
 *
 * Requirements: 3.2, 3.3, 3.4
 * Property 6: Top-up amount validation
 * Property 7: Top-up creates payment order
 */
export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();
    const { amount } = body;

    // Validate amount (Requirement 3.2)
    if (!validateTopupAmount(amount)) {
      return NextResponse.json(
        { success: false, message: '充值金额必须大于零' },
        { status: 400 }
      );
    }

    // Get user's one-api token from database
    const encryptedToken = await ensureOneAPIToken(userId);
    const oneapiToken = encryptedToken ? decryptToken(encryptedToken) : null;

    if (!oneapiToken) {
      return NextResponse.json(
        { success: false, message: 'one-api 账号未关联，请联系管理员' },
        { status: 400 }
      );
    }

    // Create top-up order in one-api (Requirement 3.3)
    const oneAPIService = new OneAPIService();
    const topupOrder = await oneAPIService.createTopup(oneapiToken, amount);

    if (!topupOrder.success) {
      return NextResponse.json(
        { success: false, message: topupOrder.message || '创建充值订单失败' },
        { status: 400 }
      );
    }

    // Return payment URL (Requirement 3.4)
    return NextResponse.json({
      success: true,
      message: '充值订单创建成功',
      data: {
        trade_no: topupOrder.data?.trade_no,
        payment_url: topupOrder.data?.payment_url,
        amount: topupOrder.data?.amount,
      },
    });
  } catch (error) {
    console.error('Error creating top-up order:', error);

    const errorMessage = error instanceof Error ? error.message : '创建充值订单失败';

    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET /webapi/oneapi/topup
 *
 * Gets top-up history from one-api
 * Requires authentication
 *
 * Query params:
 * - page: number (page number, default 0)
 * - pageSize: number (items per page, default 20)
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
    const page = parseInt(searchParams.get('page') || '0', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

    // Get user's one-api token from database
    const encryptedToken = await ensureOneAPIToken(userId);
    const oneapiToken = encryptedToken ? decryptToken(encryptedToken) : null;

    if (!oneapiToken) {
      return NextResponse.json(
        { success: false, message: 'one-api 账号未关联，请联系管理员' },
        { status: 400 }
      );
    }

    // Get top-up history from one-api
    const oneAPIService = new OneAPIService();
    const history = await oneAPIService.getTopupHistory(oneapiToken, page, pageSize);

    return NextResponse.json({
      success: true,
      data: history.data,
      total: history.total,
    });
  } catch (error) {
    console.error('Error fetching top-up history:', error);

    const errorMessage = error instanceof Error ? error.message : '获取充值记录失败';

    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}
