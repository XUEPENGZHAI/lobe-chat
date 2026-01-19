const ONEAPI_BASE_URL = process.env.ONEAPI_BASE_URL || 'http://one-api:3000';

export interface OneAPIUserInfo {
  id: number;
  username: string;
  quota: number;
  used_quota: number;
  request_count: number;
}

/**
 * Fetch one-api user info via admin token
 */
export async function fetchOneAPIUserInfoViaAdmin(
  oneapiUserId: number,
): Promise<OneAPIUserInfo | null> {
  try {
    const adminToken = process.env.ONEAPI_ADMIN_TOKEN;
    if (!adminToken) {
      console.error('ONEAPI_ADMIN_TOKEN not configured');
      return null;
    }

    const response = await fetch(`${ONEAPI_BASE_URL}/api/user/${oneapiUserId}`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('Failed to get user info from one-api:', response.status);
      return null;
    }

    const result = await response.json();
    if (!result.success || !result.data) {
      console.error('Invalid response from one-api:', result.message);
      return null;
    }

    return {
      id: result.data.id,
      username: result.data.username,
      quota: result.data.quota || 0,
      used_quota: result.data.used_quota || 0,
      request_count: result.data.request_count || 0,
    };
  } catch (error) {
    console.error('Error getting user info from one-api:', error);
    return null;
  }
}

export { ONEAPI_BASE_URL };
