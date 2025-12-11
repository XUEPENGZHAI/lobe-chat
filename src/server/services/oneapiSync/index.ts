/**
 * OneAPI Sync Service
 * 用于在用户创建时同步到 one-api 系统
 *
 * 架构说明：
 * - 每个用户在 one-api 中有独立账号和 API token
 * - lobe-chat 调用 AI 模型时使用用户自己的 API token（按用户计费）
 * - 用量查询通过管理员 API + oneapi_user_id 查询
 * - 存储 oneapi_user_id 和 oneapi_token_encrypted
 */

import { LobeChatDatabase } from '@lobechat/database';
import { sql } from 'drizzle-orm';
import * as crypto from 'node:crypto';
import { Pool } from 'pg';

import { pino } from '@/libs/logger';
import { OneAPIService } from '@/services/oneapi';

// 加密配置
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ONEAPI_TOKEN_ENCRYPTION_KEY || 'default-dev-key-32-chars-long!!';
  return crypto.scryptSync(key, 'salt', 32);
}

function encryptToken(token: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(token, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

interface SyncUserData {
  username: string;
  email?: string;
}

export class OneAPISyncService {
  private db: LobeChatDatabase;
  private oneAPIService: OneAPIService;

  constructor(db: LobeChatDatabase) {
    this.db = db;
    this.oneAPIService = new OneAPIService();
  }

  /**
   * 同步用户到 one-api
   * 1. 在 one-api 创建用户
   * 2. 获取用户 ID
   * 3. 保存 oneapi_user_id 到 lobe-chat 用户记录
   * 4. 创建 ai_chat 功能订阅
   */
  async syncUserToOneAPI(userId: string, userData: SyncUserData): Promise<void> {
    const { username, email } = userData;

    // 生成随机密码用于 one-api 账号
    const randomPassword = this.generateRandomPassword();

    // 使用 userId hash 生成唯一用户名
    const oneApiUsername = this.generateOneApiUsername(userId);

    try {
      // 1. 尝试在 one-api 创建用户
      pino.info({ username: oneApiUsername }, 'Creating user in one-api');

      const registerResult = await this.oneAPIService.register({
        username: oneApiUsername,
        password: randomPassword,
        email: email,
        display_name: username,
      });

      let oneApiUserId: number | undefined;

      if (registerResult.success) {
        // 注册成功，登录获取用户 ID
        pino.info({ username: oneApiUsername }, 'Registration successful, logging in to get user ID');
        const loginResult = await this.oneAPIService.login(oneApiUsername, randomPassword);

        if (!loginResult.success || !loginResult.data?.id) {
          throw new Error(loginResult.message || 'Failed to login to one-api after registration');
        }

        oneApiUserId = loginResult.data.id;
      } else if (
        registerResult.message?.includes('duplicate') ||
        registerResult.message?.includes('已存在')
      ) {
        // 用户已存在，查找用户 ID
        pino.info({ username: oneApiUsername }, 'User already exists, finding user ID');

        const userResult = await this.findUserByUsername(oneApiUsername);
        if (!userResult.success || !userResult.userId) {
          throw new Error(`Failed to find existing user: ${userResult.message}`);
        }

        oneApiUserId = userResult.userId;
      } else {
        throw new Error(registerResult.message || 'Failed to create one-api user');
      }

      // 3. 获取用户的 default API token（用于调用 AI）
      pino.info({ oneApiUserId }, 'Getting default API token for user');
      const tokenResult = await this.getUserDefaultApiToken(oneApiUserId);
      if (!tokenResult.success || !tokenResult.token) {
        throw new Error(`Failed to get default API token: ${tokenResult.message}`);
      }

      pino.info({ userId, oneApiUserId, oneApiUsername }, 'One-api user synced successfully');

      // 4. 保存 oneapi_user_id 和加密的 API token
      const encryptedToken = encryptToken(tokenResult.token);
      await this.db.execute(sql`
        UPDATE users
        SET oneapi_user_id = ${oneApiUserId},
            oneapi_token_encrypted = ${encryptedToken}
        WHERE id = ${userId}
      `);

      pino.info({ userId, oneApiUserId }, 'OneAPI credentials saved');

      // 3. 创建 ai_chat 功能订阅
      await this.createAIChatSubscription(userId);
    } catch (error) {
      pino.error({ error, userId, username: oneApiUsername }, 'Failed to sync user to one-api');
      throw error;
    }
  }

  /**
   * 直接从 oneapi 数据库获取用户的 default API token
   * one-api 在用户注册时会自动创建一个 default API token（在 tokens 表）
   */
  private async getUserDefaultApiToken(
    userId: number
  ): Promise<{ success: boolean; token?: string; message?: string }> {
    const pool = new Pool({
      host: process.env.POSTGRES_HOST || 'postgresql',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.ONEAPI_DB_NAME || 'oneapi',
      user: process.env.ONEAPI_DB_USER || 'oneapi',
      password: process.env.ONEAPI_DB_PASSWORD || '',
    });

    try {
      const result = await pool.query(
        'SELECT key FROM tokens WHERE user_id = $1 AND name = $2 LIMIT 1',
        [userId, 'default']
      );

      if (result.rows.length === 0) {
        // 如果没有 default，尝试获取任意一个
        const anyResult = await pool.query(
          'SELECT key FROM tokens WHERE user_id = $1 LIMIT 1',
          [userId]
        );
        if (anyResult.rows.length === 0) {
          return { success: false, message: 'No tokens found for user' };
        }
        return { success: true, token: anyResult.rows[0].key.trim() };
      }

      pino.info({ userId }, 'Default API token retrieved successfully');
      return { success: true, token: result.rows[0].key.trim() };
    } catch (error) {
      pino.error({ error, userId }, 'Error getting default API token from database');
      return { success: false, message: String(error) };
    } finally {
      await pool.end();
    }
  }

  /**
   * 通过用户名查找用户
   */
  private async findUserByUsername(
    username: string
  ): Promise<{ success: boolean; userId?: number; message?: string }> {
    try {
      const adminToken = process.env.ONEAPI_ADMIN_TOKEN;
      if (!adminToken) {
        return { success: false, message: 'Admin token not configured' };
      }

      const response = await fetch(
        `${process.env.ONEAPI_BASE_URL || 'http://one-api:3000'}/api/user/?keyword=${username}`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        return { success: false, message: `Failed to search user: ${response.status}` };
      }

      const result = await response.json();
      if (!result.success || !result.data?.length) {
        return { success: false, message: 'User not found' };
      }

      const user = result.data.find((u: any) => u.username === username);
      if (!user) {
        return { success: false, message: 'User not found with exact username match' };
      }

      return { success: true, userId: user.id };
    } catch (error) {
      pino.error({ error, username }, 'Error finding user');
      return { success: false, message: String(error) };
    }
  }

  /**
   * 创建 AI 对话功能订阅（免费功能，永不过期）
   */
  private async createAIChatSubscription(userId: string): Promise<void> {
    try {
      // 检查是否已存在订阅
      const existing = await this.db.execute(sql`
        SELECT id FROM feature_subscriptions
        WHERE user_id = ${userId} AND feature_code = 'ai_chat'
        LIMIT 1
      `);

      if (existing.rows && existing.rows.length > 0) {
        pino.info({ userId }, 'AI chat subscription already exists');
        return;
      }

      // 创建订阅
      await this.db.execute(sql`
        INSERT INTO feature_subscriptions (user_id, feature_code, status, started_at, expires_at)
        VALUES (${userId}, 'ai_chat', 'active', NOW(), NULL)
      `);

      pino.info({ userId }, 'AI chat feature activated');
    } catch (error) {
      pino.error({ error, userId }, 'Failed to create AI chat subscription');
      // 不抛出错误，订阅创建失败不应该阻止用户创建
    }
  }

  /**
   * 生成随机密码
   */
  private generateRandomPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password + 'Aa1';
  }

  /**
   * 生成 one-api 用户名
   * 使用 lobe-chat userId 的 hash 确保唯一性和一致性
   */
  private generateOneApiUsername(userId: string): string {
    const hash = crypto.createHash('md5').update(userId).digest('hex');
    return 'lc_' + hash.substring(0, 8);
  }
}
