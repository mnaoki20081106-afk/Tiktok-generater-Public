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
  /** 保存できた場合、ジェネレーターを通した当たりURL(クッションページOFFのサイト用) */
  optimizedPrizeUrl?: string | null;
  /**
   * 最適化がどちらの経路で行われたか。
   * `onelink` は招待LPのURLが取れなかったときのフォールバックで、
   * この形式は実機で「招待が成立しない」ことが確認されている。管理画面で警告を出す。
   */
  optimizedMode?: 'lp' | 'onelink' | 'unknown';
}

/**
 * サプライズ抽選のグローバル設定(有効/無効・当選確率・当たりURL)を更新する。
 *
 * 当たりURLはここで一度だけリンクジェネレーター(展開＋サニタイズ)に通し、
 * 結果を prize_url_optimized に保存する。訪問者のアクセスごとに変換すると
 * Stealth APIの応答(コールドスタート時は最大60秒)を待たせることになるため、
 * 待ち時間は管理者の保存操作の側に寄せている。
 *
 * 変換に失敗した場合は保存自体を行わない。中途半端に生のURLだけ更新されると、
 * クッションページOFFのサイトで未サニタイズのURLが当たりとして配られてしまうため。
 */
export async function updateSurpriseConfig(formData: FormData): Promise<UpdateSurpriseConfigResult> {
  await assertAdmin();

  const enabled = formData.get('enabled') === 'on';
  const probabilityRaw = Number(formData.get('probability'));
  const probability = Number.isFinite(probabilityRaw) ? Math.min(100, Math.max(0, probabilityRaw)) : 0;
  const prizeUrl = String(formData.get('prize_url') ?? '').trim();

  let optimizedPrizeUrl: string | null = null;
  let optimizedMode: 'lp' | 'onelink' | 'unknown' | undefined;
  if (prizeUrl) {
    try {
      const built = await generateDestinationUrl(prizeUrl);
      optimizedPrizeUrl = built.url;
      optimizedMode = built.mode;
    } catch (e) {
      return {
        ok: false,
        error:
          '当たりURLの最適化に失敗したため保存しませんでした。' +
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
  return { ok: true, optimizedPrizeUrl, optimizedMode };
}
