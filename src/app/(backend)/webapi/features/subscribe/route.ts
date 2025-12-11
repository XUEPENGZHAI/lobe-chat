import { sql } from 'drizzle-orm';
import * as crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { enableBetterAuth, enableNextAuth } from '@/const/auth';
import { getServerDB } from '@/database/core/db-adaptor';
import {
  createErrorResponse,
  getErrorStatusCode,
  OneAPIError,
  OneAPIErrorCode,
  OneAPIService,
  withTransaction,
} from '@/services/oneapi';

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
 * Subscription period type
 */
type SubscriptionPeriod = 'weekly' | 'monthly' | 'yearly';

/**
 * Feature type definition
 */
interface Feature {
  code: string;
  name: string;
  price_weekly: string | null;
  price_monthly: string | null;
  price_yearly: string | null;
  is_free: boolean;
  is_enabled: boolean;
}

/**
 * Calculate subscription cost based on period
 * Requirements: 7.2
 * Property 16: Subscription cost calculation
 */
function calculateSubscriptionCost(feature: Feature, period: SubscriptionPeriod): number {
  if (feature.is_free) {
    return 0;
  }

  switch (period) {
    case 'weekly':
      return parseFloat(feature.price_weekly || '0');
    case 'monthly':
      return parseFloat(feature.price_monthly || '0');
    case 'yearly':
      return parseFloat(feature.price_yearly || '0');
    default:
      return 0;
  }
}

/**
 * Calculate expiration date based on period
 */
function calculateExpirationDate(period: SubscriptionPeriod): Date {
  const now = new Date();
  switch (period) {
    case 'weekly':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case 'monthly':
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    case 'yearly':
      return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
}

/**
 * Convert yuan to one-api quota units
 * one-api default: 500000 quota = 1 yuan
 */
function yuanToQuota(yuan: number): number {
  const quotaPerUnit = parseInt(process.env.ONEAPI_QUOTA_PER_UNIT || '500000', 10);
  return Math.round(yuan * quotaPerUnit);
}

/**
 * POST /webapi/features/subscribe
 *
 * Creates a subscription for a feature
 * Requires authentication
 *
 * Request body:
 * - featureCode: string (feature code to subscribe)
 * - period: 'weekly' | 'monthly' | 'yearly' (subscription period)
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 * Property 16: Subscription cost calculation
 * Property 17: Balance check before activation
 * Property 18: Subscription creation on sufficient balance
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
    const { featureCode, period } = body as { featureCode: string; period: SubscriptionPeriod };

    // Validate input
    if (!featureCode) {
      return NextResponse.json(
        { success: false, message: '功能代码不能为空' },
        { status: 400 }
      );
    }

    if (!['weekly', 'monthly', 'yearly'].includes(period)) {
      return NextResponse.json(
        { success: false, message: '无效的订阅周期' },
        { status: 400 }
      );
    }

    const serverDB = await getServerDB();

    // Get feature details
    const featureResult = await serverDB.execute(sql`
      SELECT code, name, price_weekly, price_monthly, price_yearly, is_free, is_enabled
      FROM features
      WHERE code = ${featureCode}
    `);

    if (!featureResult.rows || featureResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: '功能不存在' },
        { status: 404 }
      );
    }

    const feature = featureResult.rows[0] as unknown as Feature;

    if (!feature.is_enabled) {
      return NextResponse.json(
        { success: false, message: '该功能暂不可用' },
        { status: 400 }
      );
    }

    // Check if user already has an active subscription
    const existingSubResult = await serverDB.execute(sql`
      SELECT id, status, expires_at
      FROM feature_subscriptions
      WHERE user_id = ${userId} AND feature_code = ${featureCode}
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (existingSubResult.rows && existingSubResult.rows.length > 0) {
      const existingSub = existingSubResult.rows[0] as {
        id: number;
        status: string;
        expires_at: Date | null
      };

      // Check if subscription is still active
      if (existingSub.status === 'active') {
        if (existingSub.expires_at === null) {
          // Permanent subscription (free feature)
          return NextResponse.json(
            { success: false, message: '您已开通此功能' },
            { status: 400 }
          );
        }

        if (new Date(existingSub.expires_at) > new Date()) {
          return NextResponse.json(
            { success: false, message: '您已开通此功能，订阅尚未到期' },
            { status: 400 }
          );
        }
      }
    }

    // Calculate subscription cost (Requirement 7.2)
    const cost = calculateSubscriptionCost(feature, period);

    // For free features, create subscription directly within a transaction (Requirements: 10.2)
    if (feature.is_free || cost === 0) {
      await withTransaction(
        async (ctx) => {
          await ctx.execute(sql`
            INSERT INTO feature_subscriptions (user_id, feature_code, status, started_at, expires_at)
            VALUES (${userId}, ${featureCode}, 'active', NOW(), NULL)
          `);
        },
        { operationName: 'createFreeSubscription' },
      );

      return NextResponse.json({
        success: true,
        message: '功能开通成功',
        data: {
          featureCode,
          period: null,
          cost: 0,
          expiresAt: null,
        },
      });
    }

    // For paid features, check balance (Requirement 7.3)
    const oneapiToken = await getOneAPITokenForUser(userId);

    if (!oneapiToken) {
      return NextResponse.json(
        { success: false, message: 'one-api 账号未关联，请联系管理员' },
        { status: 400 }
      );
    }

    const oneAPIService = new OneAPIService();
    const userInfo = await oneAPIService.getUserInfo(oneapiToken);

    const costInQuota = yuanToQuota(cost);

    // Check if user has sufficient balance (Requirement 7.3)
    if (userInfo.quota < costInQuota) {
      return NextResponse.json(
        {
          success: false,
          message: '余额不足，请先充值',
          data: {
            required: cost,
            current: userInfo.quota / yuanToQuota(1),
          }
        },
        { status: 400 }
      );
    }

    // Calculate expiration date
    const expiresAt = calculateExpirationDate(period);

    // Create subscription record within a transaction (Requirements: 10.2)
    // Property 24: Transaction rollback on database failure
    await withTransaction(
      async (ctx) => {
        // Create subscription record (Requirement 7.4)
        await ctx.execute(sql`
          INSERT INTO feature_subscriptions (user_id, feature_code, status, started_at, expires_at)
          VALUES (${userId}, ${featureCode}, 'active', NOW(), ${expiresAt.toISOString()})
        `);

        // TODO: Deduct balance from one-api
        // Note: one-api doesn't have a direct API to deduct balance
        // This would typically be done through a payment/topup system
        // For now, we'll create the subscription and log the deduction
        // In production, this should integrate with a proper payment system

        console.log(`Subscription created: user=${userId}, feature=${featureCode}, cost=${cost}, period=${period}`);
      },
      { operationName: 'createSubscription' },
    );

    return NextResponse.json({
      success: true,
      message: '功能开通成功',
      data: {
        featureCode,
        featureName: feature.name,
        period,
        cost,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    // Use centralized error handling (Requirements: 10.1)
    const errorResponse = createErrorResponse(error, {
      operation: 'createSubscription',
      endpoint: '/webapi/features/subscribe',
    });

    return NextResponse.json(errorResponse, {
      status: getErrorStatusCode(error),
    });
  }
}
