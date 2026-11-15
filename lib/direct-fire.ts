/**
 * 直接発火(Direct Fire)
 *
 * X などに貼ったカード(OGP)のタップ先は「貼った URL」に固定で、og:url では変えられない。
 * そこでサイト編集画面の「直接発火」をオンにしたサイトだけ、公開ページ(/[slug])が
 *   - SNS クローラ(User-Agent 判定)には従来どおり OGP 入りの HTML を返し、
 *   - 人間のブラウザには自分のページを描画せず埋め込みリンクへ 302 で送る。
 * 既定はオフで、その場合は従来どおり自分のページを表示する。
 *
 * 注意: 302 はサーバー遷移なので、README「どの環境でも『利用者のタップ』を経由させる」の
 * 黒画面 <a> タップによるアプリ起動の経路は使われない。招待 LP はトップレベルで読み込まれる
 * ためバインド自体は成立するが、アプリ起動は LP 側のボタンに委ねられる。
 */

import type { Site } from './types';

/** OGP を読みに来る代表的なクローラ。JS を実行しないので 302 ではなく HTML を返す必要がある。 */
export const CRAWLER_UA_PATTERN =
  /Twitterbot|facebookexternalhit|Facebot|Discordbot|Slackbot|LinkedInBot|line-poker|TelegramBot|WhatsApp|Pinterest|Applebot|Googlebot|bingbot|Threads|Bluesky|Mastodon/i;

export function isCrawlerUserAgent(userAgent: string | null | undefined): boolean {
  return CRAWLER_UA_PATTERN.test(userAgent ?? '');
}

export function isDirectFireEnabled(site: Pick<Site, 'content_data'>): boolean {
  return site.content_data?.directFire === true;
}

/** 302 の Location に使えるのは http/https の絶対 URL だけ。'#' や空文字は不可。 */
export function directFireLocation(destinationUrl: string | null | undefined): string | null {
  const raw = (destinationUrl ?? '').trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export type DirectFireDecision =
  | { kind: 'render'; reason: 'disabled' | 'crawler' | 'invalid-destination' }
  | { kind: 'redirect'; location: string };

/**
 * 公開ページの応答方針を決める。
 * - 直接発火オフ → 従来どおり描画
 * - クローラ      → 描画(OGP を渡す)
 * - 転送先が不正  → 描画(壊れた 302 を返さない)
 * - それ以外      → 302
 */
export function decideDirectFire(
  site: Pick<Site, 'content_data'>,
  userAgent: string | null | undefined,
  destinationUrl: string | null | undefined
): DirectFireDecision {
  if (!isDirectFireEnabled(site)) return { kind: 'render', reason: 'disabled' };
  if (isCrawlerUserAgent(userAgent)) return { kind: 'render', reason: 'crawler' };
  const location = directFireLocation(destinationUrl);
  if (!location) return { kind: 'render', reason: 'invalid-destination' };
  return { kind: 'redirect', location };
}

export function directFireRedirectResponse(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      // 302 をブラウザや中間キャッシュに持たせない。オフに戻した直後から自分のページが出るようにする。
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
