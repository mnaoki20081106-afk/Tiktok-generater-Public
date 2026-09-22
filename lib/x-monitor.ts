const ENGINE_REPO = 'mnaoki20081106-afk/X-Bunseki';
const RAW_BASE =
  process.env.X_BUNSEKI_RAW_BASE?.replace(/\/$/, '') ||
  `https://raw.githubusercontent.com/${ENGINE_REPO}/main`;

export interface XMonitorPost {
  id: string;
  author: string;
  authorName: string;
  postedAt: string | null;
  text: string;
  url: string;
  replies: number;
  retweets: number;
  quotes: number;
  likes: number;
  bookmarks: number;
  impressions: number;
  predictedFinalImpressions: number | null;
  impressionsPerMin: number | null;
  impressionsAcceleration: number | null;
  predictionConfidence: string | null;
  buzzScore: number | null;
  ageMinutes: number | null;
  candidate: boolean;
  discoverySource: string | null;
  megaViral: boolean;
}

export interface XMonitorStatus {
  updatedAt: string | null;
  status: string;
  postsScanned: number;
  postsWithHistory: number;
  postsFlagged: number;
  watchlistActive: number;
  observationRecords: number;
  observationPosts: number;
}

export interface XModelStatus {
  champion: string;
  automationState: string;
  completed24hPosts: number;
  earlyObservedPosts: number;
  completionRate: number;
  modelVersion: string;
  completedPosts: number;
  examples: number;
  validationLogMae: number | null;
  previousLogMae: number | null;
}

export interface XMonitorData {
  updatedAt: string | null;
  earlyPosts: XMonitorPost[];
  trendingPosts: XMonitorPost[];
  allPosts: XMonitorPost[];
  status: XMonitorStatus;
  model: XModelStatus;
  sourceError: string | null;
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function numberOrZero(value: unknown): number {
  return numberOrNull(value) ?? 0;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function idFromUrl(url: string): string {
  return url.match(/\/status\/(\d+)/)?.[1] || url;
}

export function normalizeXMonitorPost(value: unknown): XMonitorPost | null {
  const p = record(value);
  const url = stringOrNull(p.url) || '';
  const author = stringOrNull(p.author) || stringOrNull(p.author_handle) || '';
  const rawId = stringOrNull(p.post_id) || idFromUrl(url);
  if (!rawId || !url) return null;

  const predicted = numberOrNull(p.predicted_final_impressions);
  return {
    id: rawId,
    author,
    authorName: stringOrNull(p.author_name) || author || 'X user',
    postedAt: stringOrNull(p.posted_at),
    text: stringOrNull(p.text) || stringOrNull(p.text_snippet) || '',
    url,
    replies: numberOrZero(p.replies),
    retweets: numberOrZero(p.retweets),
    quotes: numberOrZero(p.quotes),
    likes: numberOrZero(p.likes),
    bookmarks: numberOrZero(p.bookmarks),
    impressions: numberOrZero(p.impressions),
    predictedFinalImpressions: predicted && predicted > 0 ? predicted : null,
    impressionsPerMin: numberOrNull(p.impressions_per_min),
    impressionsAcceleration: numberOrNull(p.impressions_acceleration),
    predictionConfidence: stringOrNull(p.prediction_confidence),
    buzzScore: numberOrNull(p.score ?? p.buzz_score),
    ageMinutes: numberOrNull(p.age_minutes),
    candidate: Boolean(p.candidate),
    discoverySource: stringOrNull(p.discovery_source),
    megaViral: Boolean(p.mega_viral),
  };
}

function normalizePostList(values: unknown[]): XMonitorPost[] {
  const result: XMonitorPost[] = [];
  const seen = new Set<string>();

  for (const raw of values) {
    const post = normalizeXMonitorPost(raw);
    if (!post || seen.has(post.id)) continue;
    seen.add(post.id);
    result.push(post);
  }

  return result;
}

/**
 * Preserve the engine's own two-list contract.
 *
 * X-Bunseki writes:
 * - early_posts: early discovery (already sorted by predicted final impressions)
 * - trending_posts: actively viral posts (already sorted by impressions/min, then impressions)
 * - posts: backwards-compatible alias of early_posts only
 *
 * Never merge early_posts and trending_posts into one public ranking.
 */
export function splitXMonitorHits(hits: UnknownRecord): {
  earlyPosts: XMonitorPost[];
  trendingPosts: XMonitorPost[];
} {
  const earlySource = Array.isArray(hits.early_posts)
    ? hits.early_posts
    : Array.isArray(hits.posts)
      ? hits.posts
      : [];
  const trendingSource = Array.isArray(hits.trending_posts)
    ? hits.trending_posts
    : [];

  return {
    earlyPosts: normalizePostList(earlySource),
    trendingPosts: normalizePostList(trendingSource),
  };
}

function mergeForDetail(
  earlyPosts: XMonitorPost[],
  trendingPosts: XMonitorPost[],
): XMonitorPost[] {
  const byId = new Map<string, XMonitorPost>();
  for (const post of [...earlyPosts, ...trendingPosts]) {
    const previous = byId.get(post.id);
    if (!previous) {
      byId.set(post.id, post);
      continue;
    }

    byId.set(post.id, {
      ...previous,
      ...post,
      authorName: post.authorName || previous.authorName,
      postedAt: post.postedAt || previous.postedAt,
      predictedFinalImpressions:
        post.predictedFinalImpressions ?? previous.predictedFinalImpressions,
      impressionsPerMin: post.impressionsPerMin ?? previous.impressionsPerMin,
      impressionsAcceleration:
        post.impressionsAcceleration ?? previous.impressionsAcceleration,
      predictionConfidence:
        post.predictionConfidence ?? previous.predictionConfidence,
      buzzScore: post.buzzScore ?? previous.buzzScore,
      impressions: Math.max(previous.impressions, post.impressions),
      likes: Math.max(previous.likes, post.likes),
      retweets: Math.max(previous.retweets, post.retweets),
      quotes: Math.max(previous.quotes, post.quotes),
      replies: Math.max(previous.replies, post.replies),
      bookmarks: Math.max(previous.bookmarks, post.bookmarks),
    });
  }
  return [...byId.values()];
}

async function fetchEngineJson(path: string): Promise<UnknownRecord> {
  const response = await fetch(`${RAW_BASE}/${path}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`${path}: HTTP ${response.status}`);
  }
  return record(await response.json());
}

function parseStatus(raw: UnknownRecord): XMonitorStatus {
  const observation = record(raw.observation_db);
  return {
    updatedAt: stringOrNull(raw.updated_at),
    status: stringOrNull(raw.status) || 'unknown',
    postsScanned: numberOrZero(raw.posts_scanned),
    postsWithHistory: numberOrZero(raw.posts_with_history),
    postsFlagged: numberOrZero(raw.posts_flagged),
    watchlistActive: numberOrZero(raw.watchlist_active),
    observationRecords: numberOrZero(observation.total),
    observationPosts: numberOrZero(observation.posts),
  };
}

function parseModel(registry: UnknownRecord, model: UnknownRecord): XModelStatus {
  const champion = record(registry.champion);
  const stats = record(registry.dataset_stats);
  return {
    champion: stringOrNull(champion.generation) || 'gen0',
    automationState: stringOrNull(registry.automation_state) || 'unknown',
    completed24hPosts: numberOrZero(stats.completed_24h_posts),
    earlyObservedPosts: numberOrZero(stats.early_observed_posts),
    completionRate: numberOrZero(stats.completion_rate),
    modelVersion: model.version == null ? 'gen0-prior' : `v${String(model.version)}`,
    completedPosts: numberOrZero(model.completed_posts),
    examples: numberOrZero(model.examples),
    validationLogMae: numberOrNull(model.validation_log_mae),
    previousLogMae: numberOrNull(model.previous_log_mae),
  };
}

export async function getXMonitorData(): Promise<XMonitorData> {
  try {
    const [hits, status, registry, model] = await Promise.all([
      fetchEngineJson('hits.json'),
      fetchEngineJson('status.json'),
      fetchEngineJson('data/model_registry.json').catch(() => ({})),
      fetchEngineJson('data/impression_model.json').catch(() => ({})),
    ]);
    const { earlyPosts, trendingPosts } = splitXMonitorHits(hits);
    return {
      updatedAt:
        stringOrNull(hits.updated_at) || stringOrNull(status.updated_at),
      earlyPosts,
      trendingPosts,
      allPosts: mergeForDetail(earlyPosts, trendingPosts),
      status: parseStatus(status),
      model: parseModel(registry, model),
      sourceError: null,
    };
  } catch (error) {
    return {
      updatedAt: null,
      earlyPosts: [],
      trendingPosts: [],
      allPosts: [],
      status: parseStatus({}),
      model: parseModel({}, {}),
      sourceError: error instanceof Error ? error.message : 'monitor data unavailable',
    };
  }
}

export function formatCompactNumber(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 10_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${(value / 1_000).toFixed(1)}K`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return Math.round(value).toLocaleString('ja-JP');
}

export function formatRelativeTime(
  postedAt: string | null,
  ageMinutes: number | null,
): string {
  let minutes = ageMinutes;
  if (postedAt) {
    const parsed = Date.parse(postedAt);
    if (Number.isFinite(parsed)) {
      minutes = Math.max(0, (Date.now() - parsed) / 60_000);
    }
  }
  if (minutes == null) return '時刻不明';
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))}分`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(minutes < 120 ? 1 : 0)}時間`;
  return `${Math.round(minutes / 1440)}日`;
}
