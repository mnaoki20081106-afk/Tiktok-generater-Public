export interface YouTubeEditorVideo {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  viewCount: string;
  ago: string;
  duration: string;
}

type ApiVideo = {
  id?: unknown;
  snippet?: {
    title?: unknown;
    channelTitle?: unknown;
    publishedAt?: unknown;
    thumbnails?: Record<string, { url?: unknown }>;
  };
  statistics?: { viewCount?: unknown };
  contentDetails?: { duration?: unknown };
};

export function formatYouTubeViewCount(raw: unknown): string {
  const count = Number(raw);
  if (!Number.isFinite(count) || count < 0) return '0回視聴';
  const compact = (value: number, unit: string) => {
    const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
    return `${String(rounded).replace(/\.0$/, '')}${unit}回視聴`;
  };
  if (count >= 100_000_000) return compact(count / 100_000_000, '億');
  if (count >= 10_000) return compact(count / 10_000, '万');
  return `${Math.floor(count).toLocaleString('ja-JP')}回視聴`;
}

export function formatYouTubeElapsedDays(publishedAt: unknown, now = new Date()): string {
  if (typeof publishedAt !== 'string') return '';
  const published = new Date(publishedAt);
  if (!Number.isFinite(published.getTime())) return '';
  const days = Math.max(0, Math.floor((now.getTime() - published.getTime()) / 86_400_000));
  return days === 0 ? '今日' : `${days.toLocaleString('ja-JP')}日前`;
}

/** ISO 8601 duration (PT#H#M#S) をYouTube風の H:MM:SS / M:SS にする。 */
export function formatYouTubeDuration(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const match = raw.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return '';
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function parseYouTubePopularVideos(payload: unknown, now = new Date()): YouTubeEditorVideo[] {
  if (!payload || typeof payload !== 'object') return [];
  const items = Array.isArray((payload as { items?: unknown }).items)
    ? (payload as { items: ApiVideo[] }).items
    : [];

  return items.flatMap(item => {
    const id = typeof item.id === 'string' && /^[A-Za-z0-9_-]{6,20}$/.test(item.id) ? item.id : '';
    const title = typeof item.snippet?.title === 'string' ? item.snippet.title.trim() : '';
    const channel = typeof item.snippet?.channelTitle === 'string' ? item.snippet.channelTitle.trim() : '';
    const thumbnails = item.snippet?.thumbnails || {};
    const thumbnail = ['maxres', 'standard', 'high', 'medium', 'default']
      .map(key => thumbnails[key]?.url)
      .find((url): url is string => typeof url === 'string' && /^https:\/\//.test(url)) || '';
    if (!id || !title || !thumbnail) return [];
    return [{
      id,
      title: title.slice(0, 600),
      channel: channel.slice(0, 200),
      thumbnail,
      viewCount: formatYouTubeViewCount(item.statistics?.viewCount),
      ago: formatYouTubeElapsedDays(item.snippet?.publishedAt, now),
      duration: formatYouTubeDuration(item.contentDetails?.duration),
    }];
  });
}
