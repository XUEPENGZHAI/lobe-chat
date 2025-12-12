import type { SmsProvider, SmsSendParams } from './types';

export class MockSmsProvider implements SmsProvider {
  async send({ phoneNumber, code }: SmsSendParams): Promise<void> {
    // eslint-disable-next-line no-console
    console.info(`[SMS][MOCK] send code ${code} to ${phoneNumber}`);
  }
}
