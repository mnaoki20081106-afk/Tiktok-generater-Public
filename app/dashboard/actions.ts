'use server';

import { randomUUID } from 'crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

function randomSlug() {
  return `site-${randomUUID().slice(0, 8)}`;
}

/** ログイン中のユーザーに紐づく新しいサイトを作成し、その編集ページへ移動する */
export async function createSite() {
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

  const { data, error } = await supabase
    .from('sites')
    .insert({ user_id: user.id, slug, title: '', description: '', content_data: {} })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error('サイトの作成に失敗しました: ' + (error?.message ?? '不明なエラー'));
  }

  redirect(`/dashboard/${data.id}`);
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
