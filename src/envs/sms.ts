import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const smsEnv = createEnv({
  clientPrefix: 'NEXT_PUBLIC_',
  client: {},
  server: {
    SMS_ENABLED: z.boolean().optional().default(false),
    SMS_PROVIDER: z.enum(['aliyun', 'mock']).optional().default('mock'),
    SMS_CODE_TTL_SECONDS: z.coerce.number().optional().default(300),
    SMS_CODE_LENGTH: z.coerce.number().optional().default(6),
    SMS_MAX_PER_HOUR: z.coerce.number().optional().default(5),
    SMS_ALLOW_DEBUG_BYPASS: z.boolean().optional().default(false),
    SMS_DEBUG_CODE: z.string().optional().default('000000'),
    // Aliyun SMS
    ALIYUN_SMS_ACCESS_KEY_ID: z.string().optional(),
    ALIYUN_SMS_ACCESS_KEY_SECRET: z.string().optional(),
    ALIYUN_SMS_ENDPOINT: z.string().optional().default('https://dysmsapi.ap-southeast-1.aliyuncs.com'),
    ALIYUN_SMS_REGION_ID: z.string().optional().default('ap-southeast-1'),
    ALIYUN_SMS_SIGN_NAME: z.string().optional(),
    ALIYUN_SMS_TEMPLATE_CODE: z.string().optional(),
  },
  runtimeEnv: {
    SMS_ENABLED: process.env.SMS_ENABLED === '1',
    SMS_PROVIDER: (process.env.SMS_PROVIDER as 'aliyun' | 'mock') || 'mock',
    SMS_CODE_TTL_SECONDS: process.env.SMS_CODE_TTL_SECONDS
      ? Number(process.env.SMS_CODE_TTL_SECONDS)
      : undefined,
    SMS_CODE_LENGTH: process.env.SMS_CODE_LENGTH ? Number(process.env.SMS_CODE_LENGTH) : undefined,
    SMS_MAX_PER_HOUR: process.env.SMS_MAX_PER_HOUR ? Number(process.env.SMS_MAX_PER_HOUR) : undefined,
    SMS_ALLOW_DEBUG_BYPASS: process.env.SMS_ALLOW_DEBUG_BYPASS === '1',
    SMS_DEBUG_CODE: process.env.SMS_DEBUG_CODE,
    ALIYUN_SMS_ACCESS_KEY_ID: process.env.ALIYUN_SMS_ACCESS_KEY_ID,
    ALIYUN_SMS_ACCESS_KEY_SECRET: process.env.ALIYUN_SMS_ACCESS_KEY_SECRET,
    ALIYUN_SMS_ENDPOINT: process.env.ALIYUN_SMS_ENDPOINT,
    ALIYUN_SMS_REGION_ID: process.env.ALIYUN_SMS_REGION_ID,
    ALIYUN_SMS_SIGN_NAME: process.env.ALIYUN_SMS_SIGN_NAME,
    ALIYUN_SMS_TEMPLATE_CODE: process.env.ALIYUN_SMS_TEMPLATE_CODE,
  },
});
