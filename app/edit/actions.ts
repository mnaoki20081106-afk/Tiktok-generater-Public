'use server';

import { randomUUID } from 'crypto';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';

function randomSlug() {
  return `site-${randomUUID().slice(0, 8)}`;
}

/** 新しいサイトを作成し、秘密の編集リンクへリダイレクトする */
export async function createSite() {
  const admin = createAdminClient();

  let slug = randomSlug();
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await admin.from('sites').select('id').eq('slug', slug).maybeSingle();
    if (!existing) break;
    slug = randomSlug();
  }

  const { data, error } = await admin
    .from('sites')
    .insert({ slug, title: '', description: '', content_data: {} })
    .select('edit_token')
    .single();

  if (error || !data) {
    throw new Error('サイトの作成に失敗しました: ' + (error?.message ?? '不明なエラー'));
  }

  redirect(`/edit/${data.edit_token}`);
}

type SaveResult = { ok: true; url: string } | { ok: false; error: string };

async function uploadIfProvided(
  admin: ReturnType<typeof createAdminClient>,
  formData: FormData,
  fileField: string,
  existingUrlField: string,
  path: string
): Promise<string | null> {
  const file = formData.get(fileField);
  if (file instanceof File && file.size > 0) {
    const { error } = await admin.storage
      .from('site-images')
      .upload(path, file, { upsert: true, contentType: file.type || 'image/png' });
    if (error) throw new Error('画像のアップロードに失敗しました: ' + error.message);
    return admin.storage.from('site-images').getPublicUrl(path).data.publicUrl;
  }
  const existingUrl = formData.get(existingUrlField);
  return typeof existingUrl === 'string' && existingUrl ? existingUrl : null;
}

/** 編集内容を保存する。editTokenが一致する行にしか書き込めない */
export async function saveSite(formData: FormData, siteUrlOrigin: string): Promise<SaveResult> {
  try {
    const editToken = String(formData.get('editToken') || '');
    if (!editToken) return { ok: false, error: '無効な編集リンクです' };

    const admin = createAdminClient();
    const { data: existing } = await admin.from('sites').select('id').eq('edit_token', editToken).maybeSingle();
    if (!existing) return { ok: false, error: '無効な編集リンクです' };

    const slug = String(formData.get('slug') || '')
      .trim()
      .toLowerCase();
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return { ok: false, error: '公開URL(slug)は半角英小文字・数字・ハイフンのみ使用できます' };
    }

    const [backgroundUrl, avatarUrl, ogpUrl, iconUrl] = await Promise.all([
      uploadIfProvided(admin, formData, 'backgroundFile', 'backgroundUrl', `${existing.id}/background-${Date.now()}.png`),
      uploadIfProvided(admin, formData, 'avatarFile', 'avatarUrl', `${existing.id}/avatar-${Date.now()}.png`),
      uploadIfProvided(admin, formData, 'ogpFile', 'ogpUrl', `${existing.id}/ogp-${Date.now()}.png`),
      uploadIfProvided(admin, formData, 'iconFile', 'iconUrl', `${existing.id}/icon-${Date.now()}.png`),
    ]);

    const { error } = await admin
      .from('sites')
      .update({
        slug,
        title: String(formData.get('ogpTitle') || '').trim(),
        description: String(formData.get('description') || ''),
        image_url: avatarUrl,
        content_data: {
          username: String(formData.get('username') || '').trim() || slug,
          tiktokUrl: String(formData.get('tiktokUrl') || '').trim(),
          musicName: String(formData.get('musicName') || '').trim() || 'オリジナル楽曲',
          likeCount: String(formData.get('likeCount') || '').trim() || '0',
          commentCount: String(formData.get('commentCount') || '').trim() || '0',
          shareCount: String(formData.get('shareCount') || '').trim() || '0',
          showPageIndicator: formData.get('showPageIndicator') === '1',
          pageIndicatorCount: String(formData.get('pageIndicatorCount') || '').trim() || '3',
          images: {
            background: backgroundUrl ?? undefined,
            ogpImage: ogpUrl ?? undefined,
            appIcon: iconUrl ?? undefined,
          },
        },
      })
      .eq('id', existing.id);

    if (error) {
      if (error.code === '23505') {
        return { ok: false, error: 'そのURL(slug)はすでに使われています。別の名前にしてください' };
      }
      return { ok: false, error: '保存に失敗しました: ' + error.message };
    }

    return { ok: true, url: `${siteUrlOrigin}/${slug}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : '保存に失敗しました' };
  }
}
