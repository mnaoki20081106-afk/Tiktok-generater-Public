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
  /** 日単位集計なら YYYY-MM-DD、時間単位集計なら YYYY-MM-DDTHH */
  date: string;
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

type Row = { device_id: string; viewed_at: string };
type Granularity = 'day' | 'hour';

function truncateToUnit(d: Date, granularity: Granularity): Date {
  const copy = new Date(d);
  if (granularity === 'day') {
    copy.setHours(0, 0, 0, 0);
  } else {
    copy.setMinutes(0, 0, 0);
  }
  return copy;
}

function advance(d: Date, granularity: Granularity, amount: number): Date {
  const copy = new Date(d);
  if (granularity === 'day') copy.setDate(copy.getDate() + amount);
  else copy.setHours(copy.getHours() + amount);
  return copy;
}

function bucketKey(iso: string, granularity: Granularity): string {
  return granularity === 'day' ? iso.slice(0, 10) : iso.slice(0, 13);
}

function buildSeries(rows: Row[], windowSize: number, now: Date, granularity: Granularity): DailyPoint[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = bucketKey(row.viewed_at, granularity);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const series: DailyPoint[] = [];
  for (let i = windowSize - 1; i >= 0; i--) {
    const key = bucketKey(advance(now, granularity, -i).toISOString(), granularity);
    series.push({ date: key, pv: counts.get(key) ?? 0 });
  }
  return series;
}

function changePercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

async function summarize(
  rows: Row[],
  windowSize: number,
  granularity: Granularity
): Promise<AnalyticsSummary> {
  const now = new Date();
  const currentStart = truncateToUnit(advance(now, granularity, -(windowSize - 1)), granularity);
  const currentStartIso = currentStart.toISOString();

  const currentRows = rows.filter((r) => r.viewed_at >= currentStartIso);
  const previousRows = rows.filter((r) => r.viewed_at < currentStartIso);

  const pv = currentRows.length;
  const uu = new Set(currentRows.map((r) => r.device_id)).size;
  const pvPrev = previousRows.length;
  const uuPrev = new Set(previousRows.map((r) => r.device_id)).size;

  return {
    pv,
    uu,
    pvChangePercent: changePercent(pv, pvPrev),
    uuChangePercent: changePercent(uu, uuPrev),
    daily: buildSeries(currentRows, windowSize, now, granularity),
  };
}

function windowStartIso(windowSize: number, granularity: Granularity): string {
  const now = new Date();
  const currentStart = truncateToUnit(advance(now, granularity, -(windowSize - 1)), granularity);
  // 直前期間との比較のため、もう1期間分さかのぼった時点から取得する
  return advance(currentStart, granularity, -windowSize).toISOString();
}

async function fetchSiteRows(client: SupabaseClient<Database>, siteId: string, sinceIso: string): Promise<Row[]> {
  const { data } = await client
    .from('page_views')
    .select('device_id, viewed_at')
    .eq('site_id', siteId)
    .gte('viewed_at', sinceIso);
  return data ?? [];
}

/**
 * 指定したサイトのPV/UUを日単位で集計する(過去days日と、その直前days日を比較して増減率を出す)。
 * 呼び出し元(ページ所有者用は認証済みクライアント、管理者用はService Roleクライアント)で
 * アクセス制御を行うこと。
 */
export async function getSiteAnalytics(
  client: SupabaseClient<Database>,
  siteId: string,
  days: 7 | 30
): Promise<AnalyticsSummary> {
  const rows = await fetchSiteRows(client, siteId, windowStartIso(days, 'day'));
  return summarize(rows, days, 'day');
}

/**
 * 指定したサイトのPV/UUを時間単位で集計する(短命なサイト向け。既定は過去24時間)。
 */
export async function getSiteAnalyticsHourly(
  client: SupabaseClient<Database>,
  siteId: string,
  hours: number = 24
): Promise<AnalyticsSummary> {
  const rows = await fetchSiteRows(client, siteId, windowStartIso(hours, 'hour'));
  return summarize(rows, hours, 'hour');
}

async function globalAnalytics(
  admin: SupabaseClient<Database>,
  windowSize: number,
  granularity: Granularity
): Promise<AnalyticsSummary & { siteCount: number; userCount: number }> {
  const [viewRows, { count: siteCount }, { data: userRows }] = await Promise.all([
    admin
      .from('page_views')
      .select('device_id, viewed_at')
      .gte('viewed_at', windowStartIso(windowSize, granularity))
      .then((r) => r.data ?? []),
    admin.from('sites').select('id', { count: 'exact', head: true }),
    admin.from('sites').select('user_id'),
  ]);

  const summary = await summarize(viewRows, windowSize, granularity);
  const userCount = new Set((userRows ?? []).map((r) => r.user_id)).size;

  return { ...summary, siteCount: siteCount ?? 0, userCount };
}

/** 管理者向け: 全サイト合算のPV/UUを日単位で集計する(Service Roleクライアント専用) */
export async function getGlobalAnalytics(
  admin: SupabaseClient<Database>,
  days: 7 | 30
): Promise<AnalyticsSummary & { siteCount: number; userCount: number }> {
  return globalAnalytics(admin, days, 'day');
}

/** 管理者向け: 全サイト合算のPV/UUを時間単位で集計する(既定は過去24時間) */
export async function getGlobalAnalyticsHourly(
  admin: SupabaseClient<Database>,
  hours: number = 24
): Promise<AnalyticsSummary & { siteCount: number; userCount: number }> {
  return globalAnalytics(admin, hours, 'hour');
}
