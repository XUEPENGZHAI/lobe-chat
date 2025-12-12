export type SmsSendParams = {
  phoneNumber: string;
  code: string;
  signName?: string;
  templateCode?: string;
};

export interface SmsProvider {
  /**
   * Send a verification code SMS.
   */
  send(params: SmsSendParams): Promise<void>;
}
