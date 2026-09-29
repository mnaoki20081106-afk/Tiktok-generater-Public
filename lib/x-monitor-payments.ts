import 'server-only';

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export type XMonitorPaymentProvider = 'paypay' | 'kyash';

export type XMonitorPaymentPublicConfig = {
  paypay: { available: boolean; price: number };
  kyash: { available: boolean; price: number };
};

export type XMonitorPaymentAdminState = {
  paypayEnabled: boolean;
  kyashEnabled: boolean;
  pricePayPay: number;
  priceKyash: number;
  paypayConnected: boolean;
  kyashConnected: boolean;
};

export type XMonitorPaymentResult = {
  ok: boolean;
  status: 'paid' | 'pending' | 'failed';
  message: string;
  paymentId?: string;
  expiresAt?: string;
};

type PaymentAccountRow = {
  paypay_phone_enc: string | null;
  paypay_password_enc: string | null;
  paypay_uuid: string | null;
  kyash_email_enc: string | null;
  kyash_password_enc: string | null;
  kyash_client_uuid: string | null;
  kyash_installation_uuid: string | null;
  kyash_access_token_enc: string | null;
};

type PaymentRow = {
  id: string;
  user_id: string;
  email: string;
  provider: XMonitorPaymentProvider;
  amount: number;
  link_hash: string;
  payment_link_enc: string | null;
  status: 'processing' | 'pending' | 'paid' | 'failed';
  entitlement_expires_at: string | null;
};

const PAYPAY_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';
const KYASH_VERSION = '11.8.1';

function adminClient() {
  return createAdminClient() as any;
}

function encryptionKey(): Buffer {
  const serviceRole = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!serviceRole) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for payment encryption');
  }
  return createHash('sha256')
    .update('x-monitor-payment-credentials\0')
    .update(serviceRole)
    .digest();
}

function encryptValue(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

function decryptValue(value: string): string {
  const [version, ivRaw, tagRaw, dataRaw] = value.split('.');
  if (version !== 'v1' || !ivRaw || !tagRaw || !dataRaw) {
    throw new Error('Unsupported encrypted payment value');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(ivRaw, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataRaw, 'base64url')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

function payHeaders(extra?: Record<string, string>) {
  return {
    'User-Agent': PAYPAY_UA,
    Accept: 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
    ...(extra || {}),
  };
}

function payCode(link: string) {
  return link
    .trim()
    .replace(/^https:\/\/pay\.paypay\.ne\.jp\//, '')
    .split(/[?#]/)[0] || '';
}

function kyashHeaders(
  clientUuid: string,
  installationUuid: string,
  accessToken?: string,
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Kyash-Client-Id': clientUuid,
    Accept: 'application/json',
    'X-Kyash-Device-Language': 'ja',
    'X-Kyash-Client-Version': KYASH_VERSION,
    'X-Kyash-Device-Info': 'iPhone 8, Version:16.7.5',
    'Accept-Language': 'ja-jp',
    'X-Kyash-Date': String(Math.round(Date.now() / 1000)),
    'User-Agent': 'Kyash/2 CFNetwork/1240.0.4 Darwin/20.6.0',
    'X-Kyash-Installation-Id': installationUuid,
    'X-Kyash-Os': 'iOS',
  };
  if (accessToken) headers['X-Auth'] = accessToken;
  return headers;
}

export function normalizeXMonitorPaymentLink(
  provider: XMonitorPaymentProvider,
  raw: string,
): string {
  const text = raw.trim();
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error('送金リンクの形式が正しくありません');
  }

  if (url.protocol !== 'https:') {
    throw new Error('HTTPSの送金リンクを入力してください');
  }

  if (provider === 'paypay') {
    if (url.hostname !== 'pay.paypay.ne.jp') {
      throw new Error('PayPayの送金リンクを入力してください');
    }
    const code = url.pathname.replace(/^\/+/, '').split('/')[0] || '';
    if (!code) throw new Error('PayPayの送金リンクが不正です');
    return `https://pay.paypay.ne.jp/${code}`;
  }

  if (url.hostname !== 'kyash.me') {
    throw new Error('Kyashの送金リンクを入力してください');
  }
  const match = url.pathname.match(/^\/payments\/([^/?#]+)/);
  if (!match?.[1]) {
    throw new Error('Kyashの送金リンクが不正です');
  }
  return `https://kyash.me/payments/${match[1]}`;
}

async function sha256Hex(value: string): Promise<string> {
  return createHash('sha256').update(value).digest('hex');
}

async function getAccountRow(): Promise<PaymentAccountRow> {
  const admin = adminClient();
  const { data, error } = await admin
    .from('x_monitor_payment_accounts')
    .select(
      'paypay_phone_enc,paypay_password_enc,paypay_uuid,kyash_email_enc,kyash_password_enc,kyash_client_uuid,kyash_installation_uuid,kyash_access_token_enc',
    )
    .eq('id', 1)
    .maybeSingle();
  if (error) throw error;
  return (
    data || {
      paypay_phone_enc: null,
      paypay_password_enc: null,
      paypay_uuid: null,
      kyash_email_enc: null,
      kyash_password_enc: null,
      kyash_client_uuid: null,
      kyash_installation_uuid: null,
      kyash_access_token_enc: null,
    }
  ) as PaymentAccountRow;
}

export async function getXMonitorPaymentAdminState(): Promise<XMonitorPaymentAdminState> {
  const admin = adminClient();
  const [{ data: config, error: configError }, account] = await Promise.all([
    admin
      .from('x_monitor_payment_config')
      .select('paypay_enabled,kyash_enabled,price_paypay,price_kyash')
      .eq('id', 1)
      .maybeSingle(),
    getAccountRow(),
  ]);
  if (configError) throw configError;

  return {
    paypayEnabled: Boolean(config?.paypay_enabled),
    kyashEnabled: Boolean(config?.kyash_enabled),
    pricePayPay: Number(config?.price_paypay || 0),
    priceKyash: Number(config?.price_kyash || 0),
    paypayConnected: Boolean(
      account.paypay_phone_enc &&
        account.paypay_password_enc &&
        account.paypay_uuid,
    ),
    kyashConnected: Boolean(
      account.kyash_client_uuid &&
        account.kyash_installation_uuid &&
        account.kyash_access_token_enc,
    ),
  };
}

export async function getXMonitorPaymentPublicConfig(): Promise<XMonitorPaymentPublicConfig> {
  const state = await getXMonitorPaymentAdminState();
  return {
    paypay: {
      available:
        state.paypayEnabled && state.paypayConnected && state.pricePayPay > 0,
      price: state.pricePayPay,
    },
    kyash: {
      available:
        state.kyashEnabled && state.kyashConnected && state.priceKyash > 0,
      price: state.priceKyash,
    },
  };
}

export async function isXMonitorPaymentConfigured(): Promise<boolean> {
  const config = await getXMonitorPaymentPublicConfig();
  return config.paypay.available || config.kyash.available;
}

export async function setXMonitorPaymentConfig(input: {
  paypayEnabled: boolean;
  kyashEnabled: boolean;
  pricePayPay: number;
  priceKyash: number;
}): Promise<XMonitorPaymentAdminState> {
  for (const value of [input.pricePayPay, input.priceKyash]) {
    if (!Number.isInteger(value) || value < 0 || value > 1_000_000) {
      throw new Error('料金は0〜1,000,000円の整数で入力してください');
    }
  }

  const admin = adminClient();
  const { error } = await admin.from('x_monitor_payment_config').upsert({
    id: 1,
    paypay_enabled: input.paypayEnabled,
    kyash_enabled: input.kyashEnabled,
    price_paypay: input.pricePayPay,
    price_kyash: input.priceKyash,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return getXMonitorPaymentAdminState();
}

async function saveChallenge(
  provider: XMonitorPaymentProvider,
  payload: unknown,
): Promise<string> {
  const admin = adminClient();
  const id = randomUUID();
  const { error } = await admin.from('x_monitor_payment_login_challenges').insert({
    id,
    provider,
    payload_enc: encryptValue(JSON.stringify(payload)),
    expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
  });
  if (error) throw error;
  return id;
}

async function takeChallenge(
  provider: XMonitorPaymentProvider,
  id: string,
): Promise<any | null> {
  const admin = adminClient();
  const { data, error } = await admin
    .from('x_monitor_payment_login_challenges')
    .select('payload_enc,expires_at')
    .eq('id', id)
    .eq('provider', provider)
    .maybeSingle();
  if (error) throw error;
  if (!data || Date.parse(data.expires_at) < Date.now()) {
    if (data) {
      await admin
        .from('x_monitor_payment_login_challenges')
        .delete()
        .eq('id', id);
    }
    return null;
  }
  await admin.from('x_monitor_payment_login_challenges').delete().eq('id', id);
  return JSON.parse(decryptValue(data.payload_enc));
}

async function payPayLoginStart(
  phone: string,
  password: string,
  uuid: string,
): Promise<any> {
  const response = await fetch('https://www.paypay.ne.jp/app/v1/oauth/token', {
    method: 'POST',
    headers: payHeaders({
      Origin: 'https://www.paypay.ne.jp',
      Referer: 'https://www.paypay.ne.jp/app/account/sign-in',
    }),
    body: JSON.stringify({
      scope: 'SIGN_IN',
      client_uuid: uuid,
      grant_type: 'password',
      username: phone,
      password,
      add_otp_prefix: true,
      language: 'ja',
    }),
    cache: 'no-store',
  });
  return response.json();
}

async function payPayLoginOtp(input: {
  uuid: string;
  otp: string;
  otpReferenceId: string;
  otpPrefix: string;
}): Promise<any> {
  const response = await fetch('https://www.paypay.ne.jp/app/v1/oauth/token', {
    method: 'POST',
    headers: payHeaders({
      Origin: 'https://www.paypay.ne.jp',
      Referer: 'https://www.paypay.ne.jp/app/account/sign-in',
    }),
    body: JSON.stringify({
      scope: 'SIGN_IN',
      client_uuid: input.uuid,
      grant_type: 'otp',
      otp_prefix: String(input.otpPrefix),
      otp: input.otp,
      otp_reference_id: input.otpReferenceId,
      username_type: 'MOBILE',
      language: 'ja',
    }),
    cache: 'no-store',
  });
  return response.json();
}

async function kyashLoginStart(
  email: string,
  password: string,
  clientUuid: string,
  installationUuid: string,
): Promise<any> {
  const response = await fetch('https://api.kyash.me/v2/login', {
    method: 'POST',
    headers: kyashHeaders(clientUuid, installationUuid),
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
  });
  return response.json();
}

async function kyashLoginOtp(input: {
  email: string;
  otp: string;
  clientUuid: string;
  installationUuid: string;
}): Promise<any> {
  const response = await fetch('https://api.kyash.me/v2/login/mobile/verify', {
    method: 'POST',
    headers: kyashHeaders(input.clientUuid, input.installationUuid),
    body: JSON.stringify({
      verificationCode: input.otp,
      email: input.email,
    }),
    cache: 'no-store',
  });
  return response.json();
}

export async function startXMonitorPayPayLogin(
  phone: string,
  password: string,
): Promise<{ challengeId: string; otpPrefix: string }> {
  const cleanPhone = phone.trim();
  if (!cleanPhone || !password) {
    throw new Error('PayPayの電話番号とパスワードを入力してください');
  }
  const uuid = randomUUID();
  const result = await payPayLoginStart(cleanPhone, password, uuid);
  if (result?.response_type === 'ErrorResponse') {
    throw new Error('PayPayログイン情報が一致しません');
  }
  if (!result?.otp_reference_id || !result?.otp_prefix) {
    throw new Error('PayPay OTP開始に失敗しました');
  }
  const challengeId = await saveChallenge('paypay', {
    phone: cleanPhone,
    password,
    uuid,
    otpReferenceId: result.otp_reference_id,
    otpPrefix: result.otp_prefix,
  });
  return { challengeId, otpPrefix: String(result.otp_prefix) };
}

export async function verifyXMonitorPayPayLogin(
  challengeId: string,
  otp: string,
): Promise<void> {
  const payload = await takeChallenge('paypay', challengeId);
  if (!payload) throw new Error('OTP認証が失効しました');
  const result = await payPayLoginOtp({
    uuid: payload.uuid,
    otp: otp.trim(),
    otpReferenceId: payload.otpReferenceId,
    otpPrefix: payload.otpPrefix,
  });
  if (result?.response_type === 'ErrorResponse') {
    throw new Error('OTPコードが正しくありません');
  }

  const admin = adminClient();
  const { error } = await admin.from('x_monitor_payment_accounts').upsert({
    id: 1,
    paypay_phone_enc: encryptValue(payload.phone),
    paypay_password_enc: encryptValue(payload.password),
    paypay_uuid: payload.uuid,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function startXMonitorKyashLogin(
  email: string,
  password: string,
): Promise<{ challengeId: string }> {
  const cleanEmail = email.trim();
  if (!cleanEmail || !password) {
    throw new Error('Kyashのメールアドレスとパスワードを入力してください');
  }
  const clientUuid = randomUUID().toUpperCase();
  const installationUuid = randomUUID().toUpperCase();
  const result = await kyashLoginStart(
    cleanEmail,
    password,
    clientUuid,
    installationUuid,
  );
  if (result?.code !== 200) {
    throw new Error(result?.error?.message || 'Kyashログイン開始に失敗しました');
  }
  const challengeId = await saveChallenge('kyash', {
    email: cleanEmail,
    password,
    clientUuid,
    installationUuid,
  });
  return { challengeId };
}

export async function verifyXMonitorKyashLogin(
  challengeId: string,
  otp: string,
): Promise<void> {
  const payload = await takeChallenge('kyash', challengeId);
  if (!payload) throw new Error('OTP認証が失効しました');
  const result = await kyashLoginOtp({
    email: payload.email,
    otp: otp.trim(),
    clientUuid: payload.clientUuid,
    installationUuid: payload.installationUuid,
  });
  const token = result?.result?.data?.token;
  if (result?.code !== 200 || !token) {
    throw new Error(result?.error?.message || 'Kyash OTP認証に失敗しました');
  }

  const admin = adminClient();
  const { error } = await admin.from('x_monitor_payment_accounts').upsert({
    id: 1,
    kyash_email_enc: encryptValue(payload.email),
    kyash_password_enc: encryptValue(payload.password),
    kyash_client_uuid: payload.clientUuid,
    kyash_installation_uuid: payload.installationUuid,
    kyash_access_token_enc: encryptValue(token),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function disconnectXMonitorPaymentProvider(
  provider: XMonitorPaymentProvider,
): Promise<void> {
  const admin = adminClient();
  const patch =
    provider === 'paypay'
      ? {
          paypay_phone_enc: null,
          paypay_password_enc: null,
          paypay_uuid: null,
          updated_at: new Date().toISOString(),
        }
      : {
          kyash_email_enc: null,
          kyash_password_enc: null,
          kyash_client_uuid: null,
          kyash_installation_uuid: null,
          kyash_access_token_enc: null,
          updated_at: new Date().toISOString(),
        };
  const { error } = await admin
    .from('x_monitor_payment_accounts')
    .update(patch)
    .eq('id', 1);
  if (error) throw error;
}

async function getPayPayAccount() {
  const row = await getAccountRow();
  if (!row.paypay_phone_enc || !row.paypay_password_enc || !row.paypay_uuid) {
    return null;
  }
  return {
    phone: decryptValue(row.paypay_phone_enc),
    password: decryptValue(row.paypay_password_enc),
    uuid: row.paypay_uuid,
  };
}

async function getKyashAccount() {
  const row = await getAccountRow();
  if (
    !row.kyash_client_uuid ||
    !row.kyash_installation_uuid ||
    !row.kyash_access_token_enc
  ) {
    return null;
  }
  return {
    clientUuid: row.kyash_client_uuid,
    installationUuid: row.kyash_installation_uuid,
    accessToken: decryptValue(row.kyash_access_token_enc),
  };
}

async function checkPayPayLink(link: string): Promise<any | null> {
  const code = payCode(link);
  const response = await fetch(
    'https://www.paypay.ne.jp/app/v2/p2p-api/getP2PLinkInfo?verificationCode=' +
      encodeURIComponent(code),
    { headers: payHeaders(), cache: 'no-store' },
  );
  if (!response.ok) return null;
  const data = await response.json();
  if (data?.header?.resultCode !== 'S0000') return null;
  return data;
}

async function acceptPayPayLink(
  link: string,
  account: { phone: string; password: string; uuid: string },
): Promise<{
  ok: boolean;
  pending: boolean;
  amount: number;
  status: string;
}> {
  const code = payCode(link);
  const info = await checkPayPayLink(link);
  if (!info) return { ok: false, pending: false, amount: 0, status: 'INVALID' };
  const amount = Number(info?.payload?.message?.data?.amount ?? 0);
  const status = String(info?.payload?.orderStatus ?? 'UNKNOWN');
  if (info?.payload?.pendingP2PInfo?.isSetPasscode) {
    return {
      ok: false,
      pending: false,
      amount,
      status: 'PASSCODE_REQUIRED',
    };
  }
  if (status !== 'PENDING') {
    return { ok: false, pending: false, amount, status };
  }

  const login = await fetch('https://www.paypay.ne.jp/app/v1/oauth/token', {
    method: 'POST',
    headers: payHeaders({
      Origin: 'https://www.paypay.ne.jp',
      Referer: 'https://pay.paypay.ne.jp/' + code,
    }),
    body: JSON.stringify({
      scope: 'SIGN_IN',
      client_uuid: account.uuid,
      grant_type: 'password',
      username: account.phone,
      password: account.password,
      add_otp_prefix: true,
      language: 'ja',
    }),
    cache: 'no-store',
  });
  const loginData = await login.json();
  const accessToken = loginData?.access_token;
  if (!accessToken) {
    return {
      ok: false,
      pending: true,
      amount,
      status: 'LOGIN_REQUIRED',
    };
  }

  const data = info.payload.message.data;
  const receivePayload = {
    verificationCode: code,
    client_uuid: account.uuid,
    requestAt: new Date().toISOString(),
    requestId: data.requestId,
    orderId: data.orderId,
    senderMessageId: info.payload.message.messageId,
    senderChannelUrl: info.payload.message.chatRoomId,
    iosMinimumVersion: '3.45.0',
    androidMinimumVersion: '3.45.0',
  };
  const headers = payHeaders({ Authorization: 'Bearer ' + accessToken });
  const cookie = login.headers.get('set-cookie');
  if (cookie) (headers as Record<string, string>).Cookie = cookie;

  const received = await fetch(
    'https://www.paypay.ne.jp/app/v2/p2p-api/acceptP2PSendMoneyLink',
    {
      method: 'POST',
      headers,
      body: JSON.stringify(receivePayload),
      cache: 'no-store',
    },
  );
  const receivedData = await received.json().catch(() => null);
  const ok = received.ok && receivedData?.header?.resultCode === 'S0000';
  return {
    ok,
    pending: !ok,
    amount,
    status: ok ? 'COMPLETED' : 'PENDING',
  };
}

async function checkKyashLink(
  link: string,
): Promise<{ amount: number; uuid: string } | null> {
  const response = await fetch(link, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const html = await response.text();
  const amount = (
    html.match(
      /class=["'][^"']*amountText text_send[^"']*["'][^>]*>([^<]+)/i,
    )?.[1] || ''
  ).replace(/[¥,\s]/g, '');
  const raw = html.match(/data-href-app=["']kyash:\/\/claim\/([^"']+)/i)?.[1];
  if (!amount || !raw) return null;
  return { amount: Number(amount), uuid: raw };
}

async function receiveKyashLink(
  link: string,
  account: {
    clientUuid: string;
    installationUuid: string;
    accessToken: string;
  },
) {
  const info = await checkKyashLink(link);
  if (!info) return { ok: false, amount: 0, status: 'INVALID' };
  const response = await fetch(
    'https://api.kyash.me/v1/links/' +
      encodeURIComponent(info.uuid) +
      '/receive',
    {
      method: 'PUT',
      headers: kyashHeaders(
        account.clientUuid,
        account.installationUuid,
        account.accessToken,
      ),
      cache: 'no-store',
    },
  );
  const data = await response.json().catch(() => null);
  return {
    ok: response.ok && data?.code === 200,
    amount: info.amount,
    status: data?.code === 200 ? 'COMPLETED' : 'FAILED',
  };
}

async function paymentPrice(
  provider: XMonitorPaymentProvider,
): Promise<number> {
  const config = await getXMonitorPaymentPublicConfig();
  const method = config[provider];
  if (!method.available || method.price <= 0) {
    throw new Error(
      provider === 'paypay'
        ? 'PayPay決済は現在利用できません'
        : 'Kyash決済は現在利用できません',
    );
  }
  return method.price;
}

async function setPaymentStatus(
  paymentId: string,
  status: 'pending' | 'failed',
): Promise<void> {
  const admin = adminClient();
  const { error } = await admin
    .from('x_monitor_payments')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId);
  if (error) throw error;
}

async function finalizePayment(paymentId: string): Promise<string> {
  const admin = adminClient();
  const { data, error } = await admin.rpc('x_monitor_finalize_payment', {
    p_payment_id: paymentId,
  });
  if (error) throw error;
  if (!data) throw new Error('利用期限の更新に失敗しました');
  return String(data);
}

async function processPaymentRow(
  payment: PaymentRow,
  normalizedLink: string,
  allowAlreadyCompletedPayPay: boolean,
): Promise<XMonitorPaymentResult> {
  try {
    if (payment.provider === 'paypay') {
      const account = await getPayPayAccount();
      if (!account) {
        await setPaymentStatus(payment.id, 'pending');
        return {
          ok: false,
          status: 'pending',
          paymentId: payment.id,
          message:
            '販売者側のPayPay接続が必要です。管理者が再接続した後に「再確認」を押してください。',
        };
      }

      const info = await checkPayPayLink(normalizedLink);
      if (!info) {
        await setPaymentStatus(payment.id, 'failed');
        return {
          ok: false,
          status: 'failed',
          paymentId: payment.id,
          message: 'PayPay送金リンクを確認できませんでした。',
        };
      }
      const amount = Number(info?.payload?.message?.data?.amount ?? 0);
      const currentStatus = String(info?.payload?.orderStatus ?? 'UNKNOWN');
      if (amount < payment.amount) {
        await setPaymentStatus(payment.id, 'failed');
        return {
          ok: false,
          status: 'failed',
          paymentId: payment.id,
          message: `金額が不足しています。必要: ${payment.amount}円 / リンク: ${amount}円`,
        };
      }
      if (info?.payload?.pendingP2PInfo?.isSetPasscode) {
        await setPaymentStatus(payment.id, 'failed');
        return {
          ok: false,
          status: 'failed',
          paymentId: payment.id,
          message: 'パスコード付きのPayPay送金リンクには対応していません。',
        };
      }

      if (
        allowAlreadyCompletedPayPay &&
        (currentStatus === 'SUCCESS' || currentStatus === 'COMPLETED')
      ) {
        const expiresAt = await finalizePayment(payment.id);
        return {
          ok: true,
          status: 'paid',
          paymentId: payment.id,
          expiresAt,
          message: '支払いを確認しました。X監視の利用期限を30日延長しました。',
        };
      }

      if (currentStatus !== 'PENDING') {
        await setPaymentStatus(payment.id, 'failed');
        return {
          ok: false,
          status: 'failed',
          paymentId: payment.id,
          message: '未使用のPayPay送金リンクを入力してください。',
        };
      }

      const received = await acceptPayPayLink(normalizedLink, account);
      if (received.ok) {
        const expiresAt = await finalizePayment(payment.id);
        return {
          ok: true,
          status: 'paid',
          paymentId: payment.id,
          expiresAt,
          message: '決済が完了しました。X監視の利用期限を30日延長しました。',
        };
      }

      if (received.pending) {
        await setPaymentStatus(payment.id, 'pending');
        return {
          ok: false,
          status: 'pending',
          paymentId: payment.id,
          message:
            received.status === 'LOGIN_REQUIRED'
              ? 'PayPayの受け取りに再認証が必要です。管理者がPayPayを再接続した後に「再確認」を押してください。'
              : 'PayPayの受け取りが保留中です。「再確認」を押してください。',
        };
      }

      await setPaymentStatus(payment.id, 'failed');
      return {
        ok: false,
        status: 'failed',
        paymentId: payment.id,
        message: 'PayPay決済を確認できませんでした。',
      };
    }

    const account = await getKyashAccount();
    if (!account) {
      await setPaymentStatus(payment.id, 'pending');
      return {
        ok: false,
        status: 'pending',
        paymentId: payment.id,
        message:
          '販売者側のKyash接続が必要です。管理者が再接続した後に「再確認」を押してください。',
      };
    }
    const info = await checkKyashLink(normalizedLink);
    if (!info) {
      await setPaymentStatus(payment.id, 'failed');
      return {
        ok: false,
        status: 'failed',
        paymentId: payment.id,
        message: 'Kyash送金リンクを確認できませんでした。',
      };
    }
    if (info.amount < payment.amount) {
      await setPaymentStatus(payment.id, 'failed');
      return {
        ok: false,
        status: 'failed',
        paymentId: payment.id,
        message: `金額が不足しています。必要: ${payment.amount}円 / リンク: ${info.amount}円`,
      };
    }

    const received = await receiveKyashLink(normalizedLink, account);
    if (!received.ok) {
      await setPaymentStatus(payment.id, 'pending');
      return {
        ok: false,
        status: 'pending',
        paymentId: payment.id,
        message:
          'Kyash決済を受け取れませんでした。アカウント接続を確認してから「再確認」を押してください。',
      };
    }
    const expiresAt = await finalizePayment(payment.id);
    return {
      ok: true,
      status: 'paid',
      paymentId: payment.id,
      expiresAt,
      message: '決済が完了しました。X監視の利用期限を30日延長しました。',
    };
  } catch (error) {
    console.error('[x-monitor-payment] payment processing failed', error);
    await setPaymentStatus(payment.id, 'pending').catch(() => undefined);
    return {
      ok: false,
      status: 'pending',
      paymentId: payment.id,
      message:
        '決済確認中に通信エラーが発生しました。少ししてから「再確認」を押してください。',
    };
  }
}

export async function createXMonitorPayment(input: {
  userId: string;
  email: string;
  provider: XMonitorPaymentProvider;
  link: string;
}): Promise<XMonitorPaymentResult> {
  const normalizedLink = normalizeXMonitorPaymentLink(
    input.provider,
    input.link,
  );
  const amount = await paymentPrice(input.provider);
  const linkHash = await sha256Hex(normalizedLink);
  const admin = adminClient();

  const paymentId = randomUUID();
  const { data, error } = await admin
    .from('x_monitor_payments')
    .insert({
      id: paymentId,
      user_id: input.userId,
      email: input.email.trim().toLowerCase(),
      provider: input.provider,
      amount,
      link_hash: linkHash,
      payment_link_enc: encryptValue(normalizedLink),
      status: 'processing',
      updated_at: new Date().toISOString(),
    })
    .select(
      'id,user_id,email,provider,amount,link_hash,payment_link_enc,status,entitlement_expires_at',
    )
    .single();

  if (error) {
    const { data: existing, error: existingError } = await admin
      .from('x_monitor_payments')
      .select(
        'id,user_id,email,provider,amount,link_hash,payment_link_enc,status,entitlement_expires_at',
      )
      .eq('link_hash', linkHash)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) throw error;
    if (existing.user_id !== input.userId) {
      return {
        ok: false,
        status: 'failed',
        message: 'この送金リンクは既に使用されています。',
      };
    }
    if (existing.status === 'paid' && existing.entitlement_expires_at) {
      return {
        ok: true,
        status: 'paid',
        paymentId: existing.id,
        expiresAt: existing.entitlement_expires_at,
        message: 'この送金リンクの支払いは既に反映済みです。',
      };
    }
    if (
      (existing.status === 'pending' || existing.status === 'processing') &&
      existing.payment_link_enc
    ) {
      return processPaymentRow(
        existing as PaymentRow,
        decryptValue(existing.payment_link_enc),
        true,
      );
    }
    return {
      ok: false,
      status: 'failed',
      paymentId: existing.id,
      message: 'この送金リンクは既に処理済みです。新しい送金リンクを作成してください。',
    };
  }

  return processPaymentRow(data as PaymentRow, normalizedLink, false);
}

export async function retryXMonitorPayment(input: {
  userId: string;
  paymentId: string;
}): Promise<XMonitorPaymentResult> {
  const admin = adminClient();
  const { data, error } = await admin
    .from('x_monitor_payments')
    .select(
      'id,user_id,email,provider,amount,link_hash,payment_link_enc,status,entitlement_expires_at',
    )
    .eq('id', input.paymentId)
    .eq('user_id', input.userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return {
      ok: false,
      status: 'failed',
      message: '決済情報が見つかりません。',
    };
  }
  if (data.status === 'paid' && data.entitlement_expires_at) {
    return {
      ok: true,
      status: 'paid',
      paymentId: data.id,
      expiresAt: data.entitlement_expires_at,
      message: 'この支払いは既に反映済みです。',
    };
  }
  if (
    (data.status !== 'pending' && data.status !== 'processing') ||
    !data.payment_link_enc
  ) {
    return {
      ok: false,
      status: 'failed',
      paymentId: data.id,
      message: 'この決済は再確認できません。新しい送金リンクを作成してください。',
    };
  }
  return processPaymentRow(
    data as PaymentRow,
    decryptValue(data.payment_link_enc),
    true,
  );
}

export async function getLatestPendingXMonitorPayment(userId: string): Promise<{
  id: string;
  provider: XMonitorPaymentProvider;
} | null> {
  const admin = adminClient();
  const { data, error } = await admin
    .from('x_monitor_payments')
    .select('id,provider')
    .eq('user_id', userId)
    .in('status', ['processing', 'pending'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    provider: data.provider as XMonitorPaymentProvider,
  };
}

export async function getActiveXMonitorSubscriptionExpiry(
  userId: string,
): Promise<string | null> {
  const admin = adminClient();
  const { data, error } = await admin
    .from('x_monitor_subscriptions')
    .select('expires_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  const expiresAt = data?.expires_at ? String(data.expires_at) : null;
  if (!expiresAt || Date.parse(expiresAt) <= Date.now()) return null;
  return expiresAt;
}
