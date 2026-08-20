/**
 * 端末識別用Cookie。サプライズ抽選で「サイト作成者本人の端末」「同一アカウントで
 * ログイン済みの端末」を判定するために使う(proxy.ts/lib/supabase/middleware.ts で発行)。
 * ブラウザのCookie削除で回避され得る簡易的な識別であり、厳密な不正防止手段ではない。
 */
export const DEVICE_COOKIE = 'dvid';
export const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 2;
