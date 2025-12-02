/**
 * OneAPI Sync Service
 * 用于在用户创建时同步到 one-api 系统
 */

import { LobeChatDatabase } from '@lobechat/database';
import { sql } from 'drizzle-orm';
import * as crypto from 'node:crypto';

import { pino } from '@/libs/logger';
import { OneAPIService } from '@/services/oneapi';

// 加密密钥
const getEncryptionKey = (): Buffer => {
  const key = process.env.ONEAPI_TOKEN_ENCRYPTION_KEY || 'default-dev-key-32-chars-long!!';
  return crypto.scryptSync(key, 'salt', 32);
};

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function encryptToken(token: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')]);
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
   * 2. 保存 one-api 凭证到 lobe-chat 用户记录
   * 3. 创建 ai_chat 功能订阅
   */
  async syncUserToOneAPI(userId: string, userData: SyncUserData): Promise<void> {
    const { username, email } = userData;

    // 生成随机密码用于 one-api 账号
    const randomPassword = this.generateRandomPassword();

    // 确保用户名符合 one-api 要求 (max 12 chars)
    const oneApiUsername = this.sanitizeUsername(username, userId);

    try {
      // 1. 在 one-api 创建用户
      pino.info({ username: oneApiUsername }, 'Creating user in one-api');

      const registerResult = await this.oneAPIService.register({
        username: oneApiUsername,
        password: randomPassword,
        email: email,
        display_name: username,
      });

      if (!registerResult.success) {
        throw new Error(registerResult.message || 'Failed to create one-api user');
      }

      const oneApiUserId = registerResult.data?.id;
      let oneApiToken = registerResult.data?.token;

      // 2. 如果注册没有返回 token，尝试登录获取
      if (!oneApiToken && oneApiUserId) {
        pino.info({ username: oneApiUsername }, 'Token not returned, attempting login');
        const loginResult = await this.oneAPIService.login(oneApiUsername, randomPassword);
        if (loginResult.success && loginResult.data?.token) {
          oneApiToken = loginResult.data.token;
        }
      }

      // 3. 保存凭证到 lobe-chat 用户记录（使用原生 SQL，因为这些字段在 init-db.sql 中添加）
      const encryptedToken = oneApiToken ? encryptToken(oneApiToken) : null;

      await this.db.execute(sql`
        UPDATE users
        SET oneapi_user_id = ${oneApiUserId},
            oneapi_token_encrypted = ${encryptedToken}
        WHERE id = ${userId}
      `);

      pino.info({ userId, oneApiUserId }, 'OneAPI credentials saved');

      // 4. 创建 ai_chat 功能订阅
      await this.createAIChatSubscription(userId);

    } catch (error) {
      pino.error({ error, userId, username: oneApiUsername }, 'Failed to sync user to one-api');
      throw error;
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
    // 确保包含大写、小写和数字
    return password + 'Aa1';
  }

  /**
   * 清理用户名以符合 one-api 要求
   * one-api 用户名最多 12 个字符
   */
  private sanitizeUsername(username: string, fallbackId: string): string {
    // 移除特殊字符，只保留字母数字
    let sanitized = username.replace(/[^a-zA-Z0-9]/g, '');

    // 如果为空，使用 fallback
    if (!sanitized) {
      sanitized = fallbackId.replace(/[^a-zA-Z0-9]/g, '');
    }

    // 截断到 12 个字符
    if (sanitized.length > 12) {
      sanitized = sanitized.substring(0, 12);
    }

    // 如果太短，添加随机后缀
    if (sanitized.length < 3) {
      sanitized = 'u' + Date.now().toString(36).substring(0, 8);
    }

    return sanitized;
  }
}
