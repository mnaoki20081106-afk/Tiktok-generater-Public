'use server';

import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { DEVICE_COOKIE } from '@/lib/device';

function randomSlug() {
  return `site-${randomUUID().slice(0, 8)}`;
}

/**
 * ログイン中のユーザーに紐づく新しいサイトを作成し、その編集ページへ移動する。
 * fingerprint は作成ボタンをクリックした端末のブラウザフィンガープリント(任意)。
 * dvid Cookie削除時に作成者本人を判定するための補助シグナルとして保存する。
 */
export async function createSite(fingerprint?: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  let slug = randomSlug();
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await supabase.from('sites').select('id').eq('slug', slug).maybeSingle();
    if (!existing) break;
    slug = randomSlug();
  }

  const cookieStore = await cookies();
  const creatorDeviceId = cookieStore.get(DEVICE_COOKIE)?.value ?? null;

  const { data, error } = await supabase
    .from('sites')
    .insert({
      user_id: user.id,
      slug,
      title: '',
      description: '',
      content_data: {},
      creator_device_id: creatorDeviceId,
      creator_fingerprint: fingerprint || null,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error('サイトの作成に失敗しました: ' + (error?.message ?? '不明なエラー'));
  }

  redirect(`/dashboard/${data.id}`);
}

/** ログイン中ユーザーの端末フィンガープリントを known_fingerprints に記録する */
export async function recordFingerprint(fingerprint: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !fingerprint) return;

  await supabase
    .from('known_fingerprints')
    .upsert({ user_id: user.id, fingerprint }, { onConflict: 'user_id,fingerprint', ignoreDuplicates: true });
}

/** 自分のサイトを削除する(RLSにより他人のサイトは削除できない) */
export async function deleteSite(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.from('sites').delete().eq('id', id).eq('user_id', user.id);
  if (error) {
    throw new Error('サイトの削除に失敗しました: ' + error.message);
  }

  revalidatePath('/dashboard');
}
