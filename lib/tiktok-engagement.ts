export const TIKTOK_LIKE_MAX = 1_000_000;
export const TIKTOK_SLIDER_MAX = 1_000;

export type TikTokEngagementCounts = {
  likes: number;
  comments: number;
  saves: number;
  shares: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 左側ほど細かく調整できる三乗カーブで、バーを0〜100万いいねへ変換する。 */
export function sliderToLikeCount(raw: number): number {
  const position = clamp(Number.isFinite(raw) ? raw : 0, 0, TIKTOK_SLIDER_MAX) / TIKTOK_SLIDER_MAX;
  return Math.round(position ** 3 * TIKTOK_LIKE_MAX);
}

export function likeCountToSlider(raw: number): number {
  const likes = clamp(Number.isFinite(raw) ? raw : 0, 0, TIKTOK_LIKE_MAX);
  return Math.round(Math.cbrt(likes / TIKTOK_LIKE_MAX) * TIKTOK_SLIDER_MAX);
}

function randomBetween(min: number, max: number, random: () => number): number {
  return min + clamp(random(), 0, 1) * (max - min);
}

export function createTikTokEngagementCounts(
  likes: number,
  random: () => number = Math.random
): TikTokEngagementCounts {
  const safeLikes = clamp(Math.round(Number.isFinite(likes) ? likes : 0), 0, TIKTOK_LIKE_MAX);
  return {
    likes: safeLikes,
    comments: Math.round(safeLikes * randomBetween(0.008, 0.012, random)),
    saves: Math.round(safeLikes * randomBetween(0.8, 1.2, random)),
    shares: Math.round(safeLikes * randomBetween(0.05, 0.07, random)),
  };
}

export function formatTikTokCount(raw: number): string {
  const count = Math.max(0, Math.round(Number.isFinite(raw) ? raw : 0));
  const compact = (value: number, suffix: string) => {
    const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
    return `${String(rounded).replace(/\.0$/, '')}${suffix}`;
  };
  if (count >= 1_000_000) return compact(count / 1_000_000, 'M');
  if (count >= 1_000) return compact(count / 1_000, 'k');
  return String(count);
}

export function parseTikTokCount(raw: unknown): number {
  if (typeof raw !== 'string' && typeof raw !== 'number') return 0;
  const normalized = String(raw).trim().replace(/,/g, '');
  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*([kKmM万]?)$/);
  if (!match) return 0;
  const multiplier = match[2].toLowerCase() === 'm' ? 1_000_000
    : match[2].toLowerCase() === 'k' ? 1_000
      : match[2] === '万' ? 10_000 : 1;
  return Math.max(0, Math.round(Number(match[1]) * multiplier));
}
