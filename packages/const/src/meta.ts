import { MetaData } from '@lobechat/types';

import { BRANDING_LOGO_URL } from './branding';

const DEFAULT_BRAND_AVATAR = BRANDING_LOGO_URL || '/icons/cyberistor-logo.png';
const DEFAULT_IMAGE_AVATAR = '/icons/cyberistor-avatar.svg';

export const DEFAULT_AVATAR = DEFAULT_BRAND_AVATAR;
export const DEFAULT_USER_AVATAR = '😀';
export const DEFAULT_SUPERVISOR_AVATAR = '🎙️';
export const DEFAULT_SUPERVISOR_ID = 'supervisor';
export const DEFAULT_BACKGROUND_COLOR = 'rgba(0,0,0,0)';
export const DEFAULT_AGENT_META: MetaData = {};
export const DEFAULT_INBOX_AVATAR = DEFAULT_BRAND_AVATAR;
export const DEFAULT_USER_AVATAR_URL = DEFAULT_IMAGE_AVATAR;
