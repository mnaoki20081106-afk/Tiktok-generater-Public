'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

function isAdminEmail(email: string | null | undefined) {
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return !!email && adminEmails.includes(email.toLowerCase());
}

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');
  if (!isAdminEmail(user.email)) redirect('/dashboard');
}

/** サプライズ抽選のグローバル設定(有効/無効・当選確率・当たりURL)を更新する */
export async function updateSurpriseConfig(formData: FormData) {
  await assertAdmin();

  const enabled = formData.get('enabled') === 'on';
  const probabilityRaw = Number(formData.get('probability'));
  const probability = Number.isFinite(probabilityRaw) ? Math.min(100, Math.max(0, probabilityRaw)) : 0;
  const prizeUrl = String(formData.get('prize_url') ?? '').trim();

  const admin = createAdminClient();
  const { error } = await admin.from('surprise_config').upsert({
    id: 1,
    enabled,
    probability,
    prize_url: prizeUrl || null,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error('設定の保存に失敗しました: ' + error.message);
  }

  revalidatePath('/admin');
}
