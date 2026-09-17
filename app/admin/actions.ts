'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdminEmail } from '@/lib/admin';
import { generateDestinationUrl } from '@/lib/link-generator';

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');
  if (!isAdminEmail(user.email)) redirect('/dashboard');
}

export interface UpdateSurpriseConfigResult {
  ok: boolean;
  error?: string;
}

/**
 * サプライズ抽選のグローバル設定(有効/無効・当選確率・当たりURL)を更新する。
 *
 * 公開ページと共通の公式リンク処理を保存時に行う。
 * 既存DBとの互換性のため、解決結果の保存先の列名は維持する。
 */
export async function updateSurpriseConfig(formData: FormData): Promise<UpdateSurpriseConfigResult> {
  await assertAdmin();

  const enabled = formData.get('enabled') === 'on';
  const probabilityRaw = Number(formData.get('probability'));
  const probability = Number.isFinite(probabilityRaw) ? Math.min(100, Math.max(0, probabilityRaw)) : 0;
  const prizeUrl = String(formData.get('prize_url') ?? '').trim();

  let optimizedPrizeUrl: string | null = null;
  if (prizeUrl) {
    try {
      const built = await generateDestinationUrl(prizeUrl);
      optimizedPrizeUrl = built.url;
    } catch (e) {
      return {
        ok: false,
        error:
          '当たりURLを確認できなかったため保存しませんでした。' +
          (e instanceof Error ? e.message : String(e)) +
          '\nTikTok Liteの招待リンク、または *.onelink.me のURLを入力してください。',
      };
    }
  }

  const admin = createAdminClient();
  const { error } = await admin.from('surprise_config').upsert({
    id: 1,
    enabled,
    probability,
    prize_url: prizeUrl || null,
    prize_url_optimized: optimizedPrizeUrl,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return { ok: false, error: '設定の保存に失敗しました: ' + error.message };
  }

  revalidatePath('/admin');
  return { ok: true };
}
