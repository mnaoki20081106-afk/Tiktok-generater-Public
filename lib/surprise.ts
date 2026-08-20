import { createAdminClient } from '@/lib/supabase/admin';
import type { Site } from '@/lib/types';

/**
 * 公開ページの遷移先URLを決定する。
 *
 * - サイト作成者本人の端末(site.creator_device_id と一致)、または
 *   同一アカウントでログイン済みの端末(known_devices に登録済み)からのアクセスは、
 *   常にユーザーが入力した本来のURLへ100%遷移させる(自作自演での不正取得を防ぐため)。
 * - それ以外の訪問者は、管理者が設定した確率でサプライズの当たりURLへ遷移する。
 */
export async function resolveDestinationUrl(site: Site, deviceId: string | null): Promise<string> {
  const realUrl = (site.content_data?.tiktokUrl as string) || '#';

  if (!deviceId) return realUrl;
  if (site.creator_device_id && site.creator_device_id === deviceId) return realUrl;

  const admin = createAdminClient();

  const { data: known } = await admin
    .from('known_devices')
    .select('device_id')
    .eq('user_id', site.user_id)
    .eq('device_id', deviceId)
    .maybeSingle();
  if (known) return realUrl;

  const { data: config } = await admin.from('surprise_config').select('*').eq('id', 1).maybeSingle();
  if (!config || !config.enabled || !config.prize_url) return realUrl;

  const probability = Math.min(100, Math.max(0, Number(config.probability) || 0));
  const roll = Math.random() * 100;
  return roll < probability ? config.prize_url : realUrl;
}
