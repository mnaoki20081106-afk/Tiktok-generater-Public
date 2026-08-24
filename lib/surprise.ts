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
  if (!config || !config.enabled) return realUrl;

  /* 当たりURLはサイトの設定で使い分ける。
     - クッションページON  … 管理者が入力したURLをそのまま(従来どおり)
     - クッションページOFF … ジェネレーターを通した最適化版
     最適化版はStealth APIを呼ぶ必要があるが、/admin での保存時に変換済みなので
     ここでは値を選ぶだけで済み、訪問者を待たせない。
     未設定(この対応より前に保存された行)の場合は生のURLにフォールバックし、
     抽選が黙って止まらないようにする。 */
  const useCushionPage = site.content_data?.useCushionPage !== false;
  const prizeUrl = useCushionPage ? config.prize_url : config.prize_url_optimized || config.prize_url;
  if (!prizeUrl) return realUrl;

  const probability = Math.min(100, Math.max(0, Number(config.probability) || 0));
  const roll = Math.random() * 100;
  return roll < probability ? prizeUrl : realUrl;
}

/**
 * dvid Cookieが削除されていた場合の補助判定。
 * ブラウザフィンガープリント(FingerprintJS)が作成者本人・同一アカウントの端末と一致する場合のみ
 * 本来のURLを返す。一致しなければ null を返し、抽選結果には一切影響を与えない
 * (この関数はサプライズの当選確率・当たりURLには触れない)。
 */
export async function resolveCreatorUrlByFingerprint(site: Site, fingerprint: string): Promise<string | null> {
  const realUrl = (site.content_data?.tiktokUrl as string) || '#';

  if (site.creator_fingerprint && site.creator_fingerprint === fingerprint) return realUrl;

  const admin = createAdminClient();
  const { data: known } = await admin
    .from('known_fingerprints')
    .select('fingerprint')
    .eq('user_id', site.user_id)
    .eq('fingerprint', fingerprint)
    .maybeSingle();

  return known ? realUrl : null;
}
