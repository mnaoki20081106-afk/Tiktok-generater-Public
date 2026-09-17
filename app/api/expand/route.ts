import { NextResponse } from 'next/server';
import { followRedirects, isTikTokLiteInviteShortLink, resolveOfficialLiteInviteUrl } from '@/lib/link-generator';

export const dynamic = 'force-dynamic';

interface ExpandBody {
  url?: unknown;
  includeLaunchUrl?: unknown;
}

/**
 * 短縮リンクを展開して着地URLを返す。公式Lite招待リンクから明示的に要求された場合は、
 * 招待LP内にあるTikTok公式のアプリ/ストア分岐URLも抽出して返す。
 *
 * 公式の招待リンク(`https://lite.tiktok.com/t/XXXX/`)はただのリダイレクトで
 * 招待LPへ着地するので、Puppeteer を使わずここで展開できる。
 * ブラウザからはクロスオリジンのリダイレクトを追えないため、この経路を挟む。
 *
 * 取りに行くドメインは `followRedirects()` 側で TikTok / AppsFlyer に限定してある。
 * 本文は返さず、URLだけを返す。
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ExpandBody | null;
  const url = typeof body?.url === 'string' ? body.url : null;

  if (!url) {
    return NextResponse.json({ url: null, error: 'url が指定されていません。' }, { status: 400 });
  }

  try {
    if (body?.includeLaunchUrl === true && isTikTokLiteInviteShortLink(url)) {
      const resolved = await resolveOfficialLiteInviteUrl(url);
      return NextResponse.json({ url: resolved.landingUrl, launchUrl: resolved.launchUrl });
    }
    return NextResponse.json({ url: await followRedirects(url) });
  } catch (e) {
    // 呼び出し側で失敗を判別する。検証済みの公式短縮リンクに限り、
    // generateDestinationUrlは入力URLを保持して保存を継続する。
    return NextResponse.json({ url: null, error: e instanceof Error ? e.message : String(e) });
  }
}
