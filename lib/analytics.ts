import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types';

/** 検索エンジン等の主要クローラーのUser-Agent。PV/UUの集計対象から除外する */
const BOT_USER_AGENT_PATTERN =
  /bot|crawl|spider|slurp|facebookexternalhit|preview|monitor|uptime|headless|curl|wget|python-requests/i;

export function isLikelyBot(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return BOT_USER_AGENT_PATTERN.test(userAgent);
}

/** 公開ページの閲覧を1件記録する。失敗しても閲覧者の体験には影響させない */
export async function recordPageView(
  admin: SupabaseClient<Database>,
  siteId: string,
  deviceId: string | null,
  userAgent: string | null
): Promise<void> {
  if (!deviceId || isLikelyBot(userAgent)) return;
  try {
    await admin.from('page_views').insert({ site_id: siteId, device_id: deviceId });
  } catch {
    // 分析用の記録が失敗しても閲覧自体は成功させたいので無視する
  }
}

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  pv: number;
}

export interface AnalyticsSummary {
  pv: number;
  uu: number;
  /** 直前の同じ長さの期間に対する変化率(%)。直前期間の実績が0件の場合はnull(比較不可) */
  pvChangePercent: number | null;
  uuChangePercent: number | null;
  daily: DailyPoint[];
}

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

function buildDailySeries(rows: { viewed_at: string }[], days: number, now: Date): DailyPoint[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(dateKey(row.viewed_at), (counts.get(dateKey(row.viewed_at)) ?? 0) + 1);
  }
  const series: DailyPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    series.push({ date: key, pv: counts.get(key) ?? 0 });
  }
  return series;
}

function changePercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/**
 * 指定したサイトのPV/UUを集計する(過去days日と、その直前days日を比較して増減率を出す)。
 * 呼び出し元(ページ所有者用は認証済みクライアント、管理者用はService Roleクライアント)で
 * アクセス制御を行うこと。
 */
export async function getSiteAnalytics(
  client: SupabaseClient<Database>,
  siteId: string,
  days: 7 | 30
): Promise<AnalyticsSummary> {
  const now = new Date();
  const currentStart = new Date(now);
  currentStart.setDate(currentStart.getDate() - (days - 1));
  currentStart.setHours(0, 0, 0, 0);
  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - days);

  const { data } = await client
    .from('page_views')
    .select('device_id, viewed_at')
    .eq('site_id', siteId)
    .gte('viewed_at', previousStart.toISOString());

  const rows = data ?? [];
  const currentRows = rows.filter((r) => r.viewed_at >= currentStart.toISOString());
  const previousRows = rows.filter((r) => r.viewed_at < currentStart.toISOString());

  const pv = currentRows.length;
  const uu = new Set(currentRows.map((r) => r.device_id)).size;
  const pvPrev = previousRows.length;
  const uuPrev = new Set(previousRows.map((r) => r.device_id)).size;

  return {
    pv,
    uu,
    pvChangePercent: changePercent(pv, pvPrev),
    uuChangePercent: changePercent(uu, uuPrev),
    daily: buildDailySeries(currentRows, days, now),
  };
}

/** 管理者向け: 全サイト合算のPV/UUを集計する(Service Roleクライアント専用) */
export async function getGlobalAnalytics(
  admin: SupabaseClient<Database>,
  days: 7 | 30
): Promise<AnalyticsSummary & { siteCount: number; userCount: number }> {
  const now = new Date();
  const currentStart = new Date(now);
  currentStart.setDate(currentStart.getDate() - (days - 1));
  currentStart.setHours(0, 0, 0, 0);
  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - days);

  const [{ data: viewRows }, { count: siteCount }, { data: userRows }] = await Promise.all([
    admin.from('page_views').select('device_id, viewed_at').gte('viewed_at', previousStart.toISOString()),
    admin.from('sites').select('id', { count: 'exact', head: true }),
    admin.from('sites').select('user_id'),
  ]);

  const rows = viewRows ?? [];
  const currentRows = rows.filter((r) => r.viewed_at >= currentStart.toISOString());
  const previousRows = rows.filter((r) => r.viewed_at < currentStart.toISOString());

  const pv = currentRows.length;
  const uu = new Set(currentRows.map((r) => r.device_id)).size;
  const pvPrev = previousRows.length;
  const uuPrev = new Set(previousRows.map((r) => r.device_id)).size;
  const userCount = new Set((userRows ?? []).map((r) => r.user_id)).size;

  return {
    pv,
    uu,
    pvChangePercent: changePercent(pv, pvPrev),
    uuChangePercent: changePercent(uu, uuPrev),
    daily: buildDailySeries(currentRows, days, now),
    siteCount: siteCount ?? 0,
    userCount,
  };
}
