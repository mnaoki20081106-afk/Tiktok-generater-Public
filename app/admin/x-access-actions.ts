'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/admin';
import {
  addXMonitorAllowedEmail,
  removeXMonitorAllowedEmail,
} from '@/lib/x-monitor-access-store';

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    throw new Error('管理者権限が必要です');
  }
}

function parseEmail(value: FormDataEntryValue | null): string {
  const email = String(value || '').trim().toLowerCase();
  if (
    !email ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error('有効なメールアドレスを入力してください');
  }
  return email;
}

function revalidateViews() {
  revalidatePath('/admin');
  revalidatePath('/dashboard');
  revalidatePath('/x-monitor');
}

export async function addXMonitorAccessAction(formData: FormData) {
  await assertAdmin();
  await addXMonitorAllowedEmail(parseEmail(formData.get('email')));
  revalidateViews();
}

export async function removeXMonitorAccessAction(formData: FormData) {
  await assertAdmin();
  await removeXMonitorAllowedEmail(parseEmail(formData.get('email')));
  revalidateViews();
}
