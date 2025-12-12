import { smsEnv } from '@/envs/sms';

import { AliyunSmsProvider } from './providers/aliyun';
import { MockSmsProvider } from './providers/mock';
import type { SmsProvider } from './providers/types';

let provider: SmsProvider | null = null;

export const getSmsProvider = (): SmsProvider => {
  if (provider) return provider;

  if (!smsEnv.SMS_ENABLED && smsEnv.SMS_PROVIDER !== 'mock') {
    throw new Error('[SMS] SMS is disabled (set SMS_ENABLED=1 to enable).');
  }

  if (smsEnv.SMS_PROVIDER === 'aliyun') {
    provider = new AliyunSmsProvider();
  } else {
    provider = new MockSmsProvider();
  }

  return provider;
};
