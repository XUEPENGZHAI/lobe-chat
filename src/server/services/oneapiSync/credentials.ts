import { sql } from 'drizzle-orm';

import { getServerDB } from '@/database/core/db-adaptor';

import { OneAPISyncService } from './index';

type OneAPICredentialRow = {
  username: string | null;
  email: string | null;
  oneapi_user_id: number | null;
  oneapi_token_encrypted: string | null;
};

async function fetchUserRow(userId: string) {
  const db = await getServerDB();
  const result = await db.execute(sql`
    SELECT username, email, oneapi_user_id, oneapi_token_encrypted
    FROM users
    WHERE id = ${userId}
  `);

  const row = (result.rows?.[0] as OneAPICredentialRow | undefined) ?? null;
  return { row, db };
}

export async function ensureOneAPICredentials(
  userId: string,
  options: { requireToken?: boolean } = {},
) {
  const { requireToken = false } = options;
  const { row, db } = await fetchUserRow(userId);

  if (!row) return null;
  const hasUserId = !!row.oneapi_user_id;
  const hasToken = !!row.oneapi_token_encrypted;
  if (hasUserId && (!requireToken || hasToken)) return row;

  const syncService = new OneAPISyncService(db);
  const fallbackName =
    row.username || row.email?.split('@')[0] || userId.slice(0, 8) || userId;

  try {
    await syncService.syncUserToOneAPI(userId, {
      username: fallbackName,
      email: row.email ?? undefined,
    });
  } catch (error) {
    console.error('Failed to auto-sync one-api credentials', { userId, error });
    return row;
  }

  const refreshedResult = await fetchUserRow(userId);
  const refreshed = refreshedResult.row;
  return refreshed ?? row;
}

export async function ensureOneAPIUserId(userId: string) {
  const row = await ensureOneAPICredentials(userId);
  return row?.oneapi_user_id ?? null;
}

export async function ensureOneAPIToken(userId: string) {
  const row = await ensureOneAPICredentials(userId, { requireToken: true });
  return row?.oneapi_token_encrypted ?? null;
}
