'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentXMonitorAccess } from '@/lib/x-monitor-access';
import {
  createXMonitorPayment,
  retryXMonitorPayment,
  type XMonitorPaymentProvider,
  type XMonitorPaymentResult,
} from '@/lib/x-monitor-payments';

function safeFailure(error: unknown): XMonitorPaymentResult {
  console.error('[x-monitor-payment-action]', error);
  return {
    ok: false,
    status: 'failed',
    message:
      error instanceof Error
        ? error.message
        : '決済処理に失敗しました。入力内容を確認してください。',
  };
}

export async function submitXMonitorPaymentAction(input: {
  provider: string;
  link: string;
}): Promise<XMonitorPaymentResult> {
  try {
    const access = await getCurrentXMonitorAccess();
    if (!access.authenticated || !access.userId || !access.email) {
      return {
        ok: false,
        status: 'failed',
        message: 'ログインし直してから決済してください。',
      };
    }
    if (access.source === 'admin' || access.source === 'manual') {
      return {
        ok: false,
        status: 'failed',
        message: 'このアカウントは個別許可済みのため、支払いは不要です。',
      };
    }

    const provider = input.provider as XMonitorPaymentProvider;
    if (provider !== 'paypay' && provider !== 'kyash') {
      return {
        ok: false,
        status: 'failed',
        message: '決済方法を選択してください。',
      };
    }

    const result = await createXMonitorPayment({
      userId: access.userId,
      email: access.email,
      provider,
      link: input.link,
    });
    if (result.ok) {
      revalidatePath('/x-monitor');
      revalidatePath('/x-monitor/upgrade');
      revalidatePath('/dashboard');
    }
    return result;
  } catch (error) {
    return safeFailure(error);
  }
}

export async function retryXMonitorPaymentAction(
  paymentId: string,
): Promise<XMonitorPaymentResult> {
  try {
    const access = await getCurrentXMonitorAccess();
    if (!access.authenticated || !access.userId) {
      return {
        ok: false,
        status: 'failed',
        message: 'ログインし直してから再確認してください。',
      };
    }

    const result = await retryXMonitorPayment({
      userId: access.userId,
      paymentId,
    });
    if (result.ok) {
      revalidatePath('/x-monitor');
      revalidatePath('/x-monitor/upgrade');
      revalidatePath('/dashboard');
    }
    return result;
  } catch (error) {
    return safeFailure(error);
  }
}
