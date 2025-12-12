import crypto from 'node:crypto';

import { serverDB } from '@lobechat/database';
import { eq } from 'drizzle-orm';

import { verification } from '@/database/schemas/betterAuth';
import { users } from '@/database/schemas/user';
import { smsEnv } from '@/envs/sms';
import { getSmsProvider } from '@/libs/sms';

const hashCode = (phone: string, code: string) =>
  crypto.createHash('sha256').update(`${phone}:${code}`).digest('hex');

const randomCode = (length: number) =>
  Array.from({ length })
    .map(() => Math.floor(Math.random() * 10))
    .join('');

export class SmsOtpService {
  async sendCode(phone: string) {
    const code = randomCode(smsEnv.SMS_CODE_LENGTH);
    const expiresAt = new Date(Date.now() + smsEnv.SMS_CODE_TTL_SECONDS * 1000);
    const value = hashCode(phone, code);

    await serverDB.delete(verification).where(eq(verification.identifier, phone));
    await serverDB.insert(verification).values({
      id: crypto.randomUUID(),
      identifier: phone,
      value,
      expiresAt,
    });

    const provider = getSmsProvider();
    await provider.send({ phoneNumber: phone, code });
  }

  async verifyCode(phone: string, code: string) {
    if (smsEnv.SMS_ALLOW_DEBUG_BYPASS && code === smsEnv.SMS_DEBUG_CODE) {
      return true;
    }

    const now = new Date();
    const record = await serverDB.query.verification.findFirst({
      where: (fields, { and, eq: equals, gt: greater }) =>
        and(equals(fields.identifier, phone), greater(fields.expiresAt, now)),
      orderBy: (fields, { desc }) => desc(fields.expiresAt),
    });

    if (!record) return false;

    const expected = hashCode(phone, code);
    return expected === record.value && record.expiresAt > now;
  }

  /**
   * Create or update a user bound to the phone number.
   * This does not create a session; caller should attach auth cookie via Better Auth.
   */
  async upsertUserByPhone(phone: string) {
    const existing = await serverDB.query.users.findFirst({
      where: eq(users.phone, phone),
    });

    if (existing) {
      await serverDB
        .update(users)
        .set({ phoneVerified: true })
        .where(eq(users.id, existing.id));
      return existing.id;
    }

    const id = crypto.randomUUID();
    await serverDB.insert(users).values({
      id,
      phone,
      phoneVerified: true,
      username: phone,
      email: `${phone}@sms.local`,
      fullName: phone,
    });
    return id;
  }
}
