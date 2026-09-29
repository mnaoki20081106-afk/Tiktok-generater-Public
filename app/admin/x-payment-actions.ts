'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/admin';
import {
  disconnectXMonitorPaymentProvider,
  getXMonitorPaymentAdminState,
  setXMonitorPaymentConfig,
  startXMonitorKyashLogin,
  startXMonitorPayPayLogin,
  verifyXMonitorKyashLogin,
  verifyXMonitorPayPayLogin,
  type XMonitorPaymentAdminState,
  type XMonitorPaymentProvider,
} from '@/lib/x-monitor-payments';

export type XMonitorPaymentAdminActionResult =
  | { ok: true; state?: XMonitorPaymentAdminState; challengeId?: string; otpPrefix?: string }
  | { ok: false; error: string };

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    throw new Error('管理者権限が必要です');
  }
}

function fail(error: unknown): XMonitorPaymentAdminActionResult {
  console.error('[x-monitor-payment-admin]', error);
  return {
    ok: false,
    error: error instanceof Error ? error.message : '処理に失敗しました',
  };
}

function revalidatePaymentViews() {
  revalidatePath('/admin');
  revalidatePath('/x-monitor');
  revalidatePath('/x-monitor/upgrade');
}

export async function saveXMonitorPaymentConfigAction(input: {
  paypayEnabled: boolean;
  kyashEnabled: boolean;
  pricePayPay: number;
  priceKyash: number;
}): Promise<XMonitorPaymentAdminActionResult> {
  try {
    await assertAdmin();
    const state = await setXMonitorPaymentConfig(input);
    revalidatePaymentViews();
    return { ok: true, state };
  } catch (error) {
    return fail(error);
  }
}

export async function startXMonitorPayPayLoginAction(
  phone: string,
  password: string,
): Promise<XMonitorPaymentAdminActionResult> {
  try {
    await assertAdmin();
    const result = await startXMonitorPayPayLogin(phone, password);
    return { ok: true, ...result };
  } catch (error) {
    return fail(error);
  }
}

export async function verifyXMonitorPayPayLoginAction(
  challengeId: string,
  otp: string,
): Promise<XMonitorPaymentAdminActionResult> {
  try {
    await assertAdmin();
    await verifyXMonitorPayPayLogin(challengeId, otp);
    const state = await getXMonitorPaymentAdminState();
    revalidatePaymentViews();
    return { ok: true, state };
  } catch (error) {
    return fail(error);
  }
}

export async function startXMonitorKyashLoginAction(
  email: string,
  password: string,
): Promise<XMonitorPaymentAdminActionResult> {
  try {
    await assertAdmin();
    const result = await startXMonitorKyashLogin(email, password);
    return { ok: true, ...result };
  } catch (error) {
    return fail(error);
  }
}

export async function verifyXMonitorKyashLoginAction(
  challengeId: string,
  otp: string,
): Promise<XMonitorPaymentAdminActionResult> {
  try {
    await assertAdmin();
    await verifyXMonitorKyashLogin(challengeId, otp);
    const state = await getXMonitorPaymentAdminState();
    revalidatePaymentViews();
    return { ok: true, state };
  } catch (error) {
    return fail(error);
  }
}

export async function disconnectXMonitorPaymentProviderAction(
  provider: XMonitorPaymentProvider,
): Promise<XMonitorPaymentAdminActionResult> {
  try {
    await assertAdmin();
    if (provider !== 'paypay' && provider !== 'kyash') {
      throw new Error('決済方法が不正です');
    }
    await disconnectXMonitorPaymentProvider(provider);
    const state = await getXMonitorPaymentAdminState();
    revalidatePaymentViews();
    return { ok: true, state };
  } catch (error) {
    return fail(error);
  }
}
