import Dysmsapi20170525, { SendSmsRequest } from '@alicloud/dysmsapi20170525';
import * as $OpenApi from '@alicloud/openapi-client';

import { smsEnv } from '@/envs/sms';

import type { SmsProvider, SmsSendParams } from './types';

export class AliyunSmsProvider implements SmsProvider {
  private client: Dysmsapi20170525;

  constructor() {
    if (!smsEnv.ALIYUN_SMS_ACCESS_KEY_ID || !smsEnv.ALIYUN_SMS_ACCESS_KEY_SECRET) {
      throw new Error('[SMS] Missing Aliyun AccessKeyId or AccessKeySecret');
    }

    const config = new $OpenApi.Config({
      accessKeyId: smsEnv.ALIYUN_SMS_ACCESS_KEY_ID,
      accessKeySecret: smsEnv.ALIYUN_SMS_ACCESS_KEY_SECRET,
    });
    config.endpoint = smsEnv.ALIYUN_SMS_ENDPOINT;
    // regionId is required by some deployments; keep consistent with endpoint region
    config.regionId = smsEnv.ALIYUN_SMS_REGION_ID;

    this.client = new Dysmsapi20170525(config);
  }

  async send({ phoneNumber, code, signName, templateCode }: SmsSendParams): Promise<void> {
    const SignName = signName ?? smsEnv.ALIYUN_SMS_SIGN_NAME;
    const TemplateCode = templateCode ?? smsEnv.ALIYUN_SMS_TEMPLATE_CODE;

    if (!SignName || !TemplateCode) {
      throw new Error('[SMS] Missing Aliyun sign name or template code');
    }

    const request = new SendSmsRequest({
      phoneNumbers: phoneNumber,
      signName: SignName,
      templateCode: TemplateCode,
      templateParam: JSON.stringify({ code }),
    });

    await this.client.sendSms(request);
  }
}
