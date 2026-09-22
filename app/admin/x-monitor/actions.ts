'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/admin';
import {
  updateXKeywords,
  type XKeywordKind,
} from '@/lib/x-monitor-github';

const KINDS = new Set<XKeywordKind>(['keywords', 'combo', 'ng']);

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    throw new Error('管理者権限が必要です');
  }
}

function parseKind(value: FormDataEntryValue | null): XKeywordKind {
  const kind = String(value || '') as XKeywordKind;
  if (!KINDS.has(kind)) throw new Error('不正なキーワード種別です');
  return kind;
}

function parseAdditions(kind: XKeywordKind, value: FormDataEntryValue | null): string[] {
  const raw = String(value || '');
  const source = kind === 'combo' ? raw.split(/\r?\n/) : raw.split(/[\r\n,、]+/);
  const values = [...new Set(source.map((item) => item.trim()).filter(Boolean))];
  if (!values.length) throw new Error('追加するキーワードを入力してください');
  if (values.length > 100) throw new Error('一度に追加できるのは100件までです');
  for (const item of values) {
    if (item.length > 200 || item.startsWith('#')) {
      throw new Error('キーワードは200文字以内で、#から始めないでください');
    }
  }
  return values;
}

export async function addXKeywordAction(formData: FormData) {
  await assertAdmin();
  const kind = parseKind(formData.get('kind'));
  const additions = parseAdditions(kind, formData.get('values'));
  await updateXKeywords(kind, additions, []);
  revalidatePath('/admin/x-monitor');
}

export async function removeXKeywordAction(formData: FormData) {
  await assertAdmin();
  const kind = parseKind(formData.get('kind'));
  const value = String(formData.get('value') || '').trim();
  if (!value || value.length > 200) throw new Error('不正なキーワードです');
  await updateXKeywords(kind, [], [value]);
  revalidatePath('/admin/x-monitor');
}
