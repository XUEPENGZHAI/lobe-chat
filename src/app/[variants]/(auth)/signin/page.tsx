'use client';

import { ActionIcon, Button } from '@lobehub/ui';
import { LobeHub } from '@lobehub/ui/brand';
import { Form, Input, type InputRef } from 'antd';
import { createStyles, useTheme } from 'antd-style';
import { ChevronLeft, ChevronRight, Hash, Lock, Mail, Phone } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

import { message } from '@/components/AntdStaticMethods';
import AuthIcons from '@/components/NextAuth/AuthIcons';
import { getAuthConfig } from '@/envs/auth';
import { requestPasswordReset, signIn } from '@/libs/better-auth/auth-client';
import { isBuiltinProvider, normalizeProviderId } from '@/libs/better-auth/utils/client';
import { useUserStore } from '@/store/user';

const postJson = async (url: string, body: Record<string, string | boolean>) => {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const messageText = (data as any)?.error?.message;
    throw new Error(messageText || response.statusText);
  }
  return data;
};

const useStyles = createStyles(({ css, token }) => ({
  backButton: css`
    cursor: pointer;
    font-size: 14px;
    color: ${token.colorPrimary};

    &:hover {
      color: ${token.colorPrimaryHover};
    }
  `,
  card: css`
    padding-block: 2.5rem;
    padding-inline: 2rem;
  `,
  container: css`
    width: 360px;
    border: 1px solid ${token.colorBorder};
    border-radius: ${token.borderRadiusLG}px;
  `,
  divider: css`
    flex: 1;
    height: 1px;
    background: ${token.colorBorder};
  `,
  dividerText: css`
    font-size: 14px;
    color: ${token.colorTextSecondary};
  `,
  emailDisplay: css`
    font-size: 14px;
    color: ${token.colorTextSecondary};
    text-align: center;
  `,
  footer: css`
    padding: 1rem;
    border-block-start: 1px solid ${token.colorBorder};

    font-size: 14px;
    color: ${token.colorTextDescription};
    text-align: center;

    background: ${token.colorBgElevated};
  `,
  subtitle: css`
    margin-block-start: 0.5rem;
    font-size: 14px;
    color: ${token.colorTextSecondary};
    text-align: center;
  `,
  title: css`
    margin-block-start: 1rem;

    font-size: 24px;
    font-weight: 600;
    color: ${token.colorTextHeading};
    text-align: center;
  `,
}));

type Step = 'email' | 'password';

interface SignInFormValues {
  email: string;
  password: string;
}

export default function SignInPage() {
  const { styles } = useStyles();
  const theme = useTheme();
  const { t: tAuth } = useTranslation('auth');
  const t = tAuth as (key: string, options?: any) => string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { NEXT_PUBLIC_ENABLE_MAGIC_LINK: enableMagicLink, NEXT_PUBLIC_ENABLE_PHONE_LOGIN: enablePhoneLogin } =
    getAuthConfig();
  const [form] = Form.useForm();
  const [phoneForm] = Form.useForm();
  const [otpForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneStep, setPhoneStep] = useState<'input' | 'otp'>('input');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const emailInputRef = useRef<InputRef>(null);
  const passwordInputRef = useRef<InputRef>(null);
  const oAuthSSOProviders = useUserStore((s) => s.oAuthSSOProviders || []);

  // Auto-focus input when step changes
  useEffect(() => {
    if (step === 'email') {
      emailInputRef.current?.focus();
    } else if (step === 'password') {
      passwordInputRef.current?.focus();
    }
  }, [step]);

  // Pre-fill email from URL params
  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      form.setFieldValue('email', emailParam);
    }
  }, [searchParams, form]);

  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setTimeout(() => setOtpCountdown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpCountdown]);

  const handleSendMagicLink = async (targetEmail?: string) => {
    try {
      const emailValue =
        targetEmail ||
        (await form
          .validateFields(['email'])
          .then((v) => v.email as string)
          .catch(() => null));

      if (!emailValue) {
        return;
      }

      const callbackUrl = searchParams.get('callbackUrl') || '/';
      const { error } = await signIn.magicLink({
        callbackURL: callbackUrl,
        email: emailValue,
      });

      if (error) {
        message.error(error.message || t('betterAuth.signin.magicLinkError'));
        return;
      }

      message.success(t('betterAuth.signin.magicLinkSent'));
    } catch (error) {
      // validation errors are surfaced by antd form; only log unexpected errors
      if (!(error as any)?.errorFields) {
        console.error('Magic link error:', error);
        message.error(t('betterAuth.signin.magicLinkError'));
      }
    } finally {
      // no-op
    }
  };

  const handleSendPhoneOtp = async (values: { phone: string }) => {
    if (!enablePhoneLogin) return;
    const normalizedPhone = values.phone.trim();
    if (!normalizedPhone) return;

    phoneForm.setFieldValue('phone', normalizedPhone);
    setPhoneLoading(true);
    try {
      await postJson('/api/auth/phone-number/send-otp', { phoneNumber: normalizedPhone });

      setPhoneNumber(normalizedPhone);
      setPhoneStep('otp');
      setOtpCountdown(60);
      otpForm.resetFields();

      message.success(t('betterAuth.signin.phoneCodeSent'));
    } catch (error) {
      console.error('Phone OTP send error:', error);
      message.error(t('betterAuth.signin.phoneCodeError'));
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async (values: { code: string }) => {
    if (!enablePhoneLogin || !phoneNumber) {
      message.error(t('betterAuth.signin.phoneVerifyError'));
      return;
    }

    setOtpLoading(true);
    try {
      await postJson('/api/auth/phone-number/verify', {
        code: values.code.trim(),
        phoneNumber,
      });
      const callbackUrl = searchParams.get('callbackUrl') || '/';
      router.push(callbackUrl);
    } catch (error) {
      console.error('Phone OTP verify error:', error);
      message.error(t('betterAuth.signin.phoneVerifyError'));
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    const phoneValue = phoneNumber || phoneForm.getFieldValue('phone');
    if (!phoneValue) {
      message.error(t('betterAuth.signin.phoneCodeError'));
      return;
    }
    await handleSendPhoneOtp({ phone: phoneValue });
  };

  const handleBackToPhoneInput = () => {
    setPhoneStep('input');
    setOtpCountdown(0);
    setPhoneNumber('');
    otpForm.resetFields();
  };

  // Check if user exists
  const handleCheckUser = async (values: Pick<SignInFormValues, 'email'>) => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/check-user', {
        body: JSON.stringify({ email: values.email }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });

      const data = await response.json();

      if (!data.exists) {
        // User not found, redirect to signup page with email pre-filled
        const callbackUrl = searchParams.get('callbackUrl') || '/';
        router.push(
          `/signup?email=${encodeURIComponent(values.email)}&callbackUrl=${encodeURIComponent(callbackUrl)}`,
        );
        return;
      }

      setEmail(values.email);

      if (enableMagicLink) {
        await handleSendMagicLink(values.email);
        return;
      }

      if (data.hasPassword) {
        setStep('password');
        return;
      }

      message.info(t('betterAuth.signin.socialOnlyHint'));
    } catch (error) {
      console.error('Error checking user:', error);
      message.error(t('betterAuth.signin.error'));
    } finally {
      setLoading(false);
    }
  };

  // Sign in with email and password
  const handleSignIn = async (values: SignInFormValues) => {
    setLoading(true);
    try {
      const callbackUrl = searchParams.get('callbackUrl') || '/';

      const result = await signIn.email(
        {
          callbackURL: callbackUrl,
          email: email,
          password: values.password,
        },
        {
          onError: (ctx) => {
            console.error('Sign in error:', ctx.error);
            // Check if error is due to unverified email (403 status)
            if (ctx.error.status === 403) {
              // Redirect to verify-email page instead of showing error
              router.push(
                `/verify-email?email=${encodeURIComponent(email)}&callbackUrl=${encodeURIComponent(callbackUrl)}`,
              );
              return;
            }
          },
          onSuccess: () => {
            router.push(callbackUrl);
          },
        },
      );

      // Only show error if not already handled in onError callback
      if (result.error && result.error.status !== 403) {
        message.error(result.error.message || t('betterAuth.signin.error'));
        return;
      }
    } catch (error) {
      console.error('Sign in error:', error);
      message.error(t('betterAuth.signin.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setStep('email');
    setEmail('');
  };

  const handleGoToSignup = () => {
    const currentEmail = form.getFieldValue('email');
    const callbackUrl = searchParams.get('callbackUrl') || '/';
    const params = new URLSearchParams();
    if (currentEmail) {
      params.set('email', currentEmail);
    }
    params.set('callbackUrl', callbackUrl);
    router.push(`/signup?${params.toString()}`);
  };

  const getProviderLabel = (provider: string) => {
    const normalized = normalizeProviderId(provider);
    const normalizedKey = normalized
      .replaceAll(/(^|[_-])([a-z])/g, (_, __, c) => c.toUpperCase())
      .replaceAll(/[^\dA-Za-z]/g, '');
    const key = `betterAuth.signin.continueWith${normalizedKey}`;
    return t(key, { defaultValue: `Continue with ${normalized}` });
  };

  const handleSocialSignIn = async (provider: string) => {
    setSocialLoading(provider);
    const normalizedProvider = normalizeProviderId(provider);

    try {
      const callbackUrl = searchParams.get('callbackUrl') || '/';
      const result = isBuiltinProvider(normalizedProvider)
        ? await signIn.social({
            callbackURL: callbackUrl,
            provider: normalizedProvider,
          })
        : await signIn.oauth2({
            callbackURL: callbackUrl,
            providerId: normalizedProvider,
          });

      if (result?.error) {
        throw result.error;
      }
    } catch (error) {
      console.error(`${normalizedProvider} sign in error:`, error);
      message.error(t('betterAuth.signin.socialError'));
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <Flexbox align="center" justify="center" style={{ minHeight: '100vh' }}>
      <div className={styles.container}>
        <div className={styles.card}>
          <Flexbox align="center" gap={8} justify="center">
            <LobeHub size={48} />
          </Flexbox>

          <h1 className={styles.title}>{t('betterAuth.signin.emailStep.title')}</h1>

          {step === 'email' && (
            <>
              <p className={styles.subtitle}>{t('betterAuth.signin.emailStep.subtitle')}</p>

              {/* Social Login Section */}
              {oAuthSSOProviders.length > 0 && (
                <Flexbox gap={12} style={{ marginTop: '2rem' }}>
                  {oAuthSSOProviders.map((provider) => (
                    <Button
                      block
                      icon={AuthIcons(provider, 16)}
                      key={provider}
                      loading={socialLoading === provider}
                      onClick={() => handleSocialSignIn(provider)}
                      size="large"
                    >
                      {getProviderLabel(provider)}
                    </Button>
                  ))}

                  {/* Divider */}
                  <Flexbox align="center" gap={12} horizontal>
                    <div className={styles.divider} />
                    <span className={styles.dividerText}>
                      {t('betterAuth.signin.orContinueWith')}
                    </span>
                    <div className={styles.divider} />
                  </Flexbox>
                </Flexbox>
              )}

              <Form
                form={form}
                layout="vertical"
                onFinish={handleCheckUser}
                style={{ marginTop: '0.5rem' }}
              >
                <Form.Item
                  name="email"
                  rules={[
                    { message: t('betterAuth.errors.emailRequired'), required: true },
                    { message: t('betterAuth.errors.emailInvalid'), type: 'email' },
                  ]}
                  style={{ marginBottom: 0 }}
                >
                  <Input
                    placeholder={t('betterAuth.signin.emailPlaceholder')}
                    prefix={<Mail size={16} />}
                    ref={emailInputRef}
                    size="large"
                    suffix={
                      <ActionIcon
                        active
                        icon={ChevronRight}
                        loading={loading}
                        onClick={() => form.submit()}
                        size={{ blockSize: 32, size: 16 }}
                        style={{ color: theme.colorPrimary }}
                        title={t('betterAuth.signin.nextStep')}
                      />
                    }
                  />
                </Form.Item>
              </Form>

              {enablePhoneLogin && (
                <div style={{ marginTop: '2rem' }}>
                  <h2 className={styles.title} style={{ fontSize: 18, marginTop: 0 }}>
                    {t('betterAuth.signin.phoneStep.title')}
                  </h2>
                  <p className={styles.subtitle}>{t('betterAuth.signin.phoneStep.subtitle')}</p>

                  {phoneStep === 'input' && (
                    <Form
                      form={phoneForm}
                      layout="vertical"
                      onFinish={handleSendPhoneOtp}
                      style={{ marginTop: '0.5rem' }}
                    >
                      <Form.Item
                        name="phone"
                        rules={[
                          { message: t('betterAuth.errors.phoneRequired'), required: true },
                          {
                            message: t('betterAuth.errors.phoneInvalid'),
                            pattern: /^\+?[0-9]{5,15}$/,
                          },
                        ]}
                        style={{ marginBottom: 0 }}
                      >
                        <Input
                          placeholder={t('betterAuth.signin.phonePlaceholder')}
                          prefix={<Phone size={16} />}
                          size="large"
                          suffix={
                            <ActionIcon
                              active
                              icon={ChevronRight}
                              loading={phoneLoading}
                              onClick={() => phoneForm.submit()}
                              size={{ blockSize: 32, size: 16 }}
                              style={{ color: theme.colorPrimary }}
                              title={t('betterAuth.signin.phoneStep.send')}
                            />
                          }
                        />
                      </Form.Item>
                    </Form>
                  )}

                  {phoneStep === 'otp' && (
                    <>
                      <p className={styles.emailDisplay} style={{ marginTop: '1rem' }}>
                        {t('betterAuth.signin.phoneStep.codeSubtitle', { phone: phoneNumber })}
                      </p>
                      <div
                        className={styles.backButton}
                        onClick={handleBackToPhoneInput}
                        style={{ marginTop: '0.5rem', textAlign: 'center' }}
                      >
                        <ChevronLeft size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />
                        <span style={{ marginLeft: '0.25rem' }}>{t('betterAuth.signin.phoneStep.back')}</span>
                      </div>
                      <Form
                        form={otpForm}
                        layout="vertical"
                        onFinish={handleVerifyPhoneOtp}
                        style={{ marginTop: '1rem' }}
                      >
                        <Form.Item
                          name="code"
                          rules={[{ message: t('betterAuth.errors.codeRequired'), required: true }]}
                          style={{ marginBottom: 0 }}
                        >
                          <Input
                            placeholder={t('betterAuth.signin.phoneStep.codePlaceholder')}
                            prefix={<Hash size={16} />}
                            size="large"
                            suffix={
                              <ActionIcon
                                active
                                icon={ChevronRight}
                                loading={otpLoading}
                                onClick={() => otpForm.submit()}
                                size={{ blockSize: 32, size: 16 }}
                                style={{ color: theme.colorPrimary }}
                                title={t('betterAuth.signin.phoneStep.verify')}
                              />
                            }
                          />
                        </Form.Item>
                      </Form>
                      <div style={{ marginTop: '1rem' }}>
                        <Button
                          block
                          disabled={otpCountdown > 0}
                          loading={phoneLoading}
                          onClick={handleResendOtp}
                          size="large"
                        >
                          {otpCountdown > 0
                            ? t('betterAuth.signin.phoneStep.resendCountdown', { seconds: otpCountdown })
                            : t('betterAuth.signin.phoneStep.resend')}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {step === 'password' && (
            <>
              <p className={styles.emailDisplay}>{email}</p>
              <div
                className={styles.backButton}
                onClick={handleBackToEmail}
                style={{ marginTop: '0.5rem', textAlign: 'center' }}
              >
                <ChevronLeft size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />
                <span style={{ marginLeft: '0.25rem' }}>{t('betterAuth.signin.backToEmail')}</span>
              </div>
              <p className={styles.subtitle} style={{ marginTop: '1rem' }}>
                {t('betterAuth.signin.passwordStep.subtitle')}
              </p>

              <Form
                form={form}
                layout="vertical"
                onFinish={handleSignIn}
                style={{ marginTop: '1.5rem' }}
              >
                <Form.Item
                  name="password"
                  rules={[{ message: t('betterAuth.errors.passwordRequired'), required: true }]}
                  style={{ marginBottom: 0 }}
                >
                  <Input.Password
                    placeholder={t('betterAuth.signin.passwordPlaceholder')}
                    prefix={<Lock size={16} />}
                    ref={passwordInputRef}
                    size="large"
                    suffix={
                      <ActionIcon
                        active
                        icon={ChevronRight}
                        loading={loading}
                        onClick={() => form.submit()}
                        size={{ blockSize: 32, size: 16 }}
                        style={{ color: theme.colorPrimary }}
                        title={t('betterAuth.signin.submit')}
                      />
                    }
                  />
                </Form.Item>
              </Form>

              <div
                className={styles.backButton}
                onClick={async () => {
                  try {
                    await requestPasswordReset({
                      email,
                      redirectTo: `/reset-password?email=${encodeURIComponent(email)}`,
                    });
                    message.success(t('betterAuth.signin.forgotPasswordSent'));
                  } catch {
                    message.error(t('betterAuth.signin.forgotPasswordError'));
                  }
                }}
                style={{ marginTop: '1rem', textAlign: 'center' }}
              >
                {t('betterAuth.signin.forgotPassword')}
              </div>
            </>
          )}
        </div>

        <div className={styles.footer}>
          {t('betterAuth.signin.noAccount')}{' '}
          <a
            onClick={handleGoToSignup}
            style={{ color: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}
          >
            {t('betterAuth.signin.signupLink')}
          </a>
        </div>
      </div>
    </Flexbox>
  );
}
