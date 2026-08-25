import { NextResponse } from 'next/server';
import { followRedirects } from '@/lib/link-generator';

export const dynamic = 'force-dynamic';

interface ExpandBody {
  url?: unknown;
}

/**
 * 短縮リンクを展開して、着地した最終URLだけを返す。
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
    return NextResponse.json({ url: await followRedirects(url) });
  } catch (e) {
    // 展開できなくても呼び出し側は従来の抽出経路へ進むだけなので、エラーでは返さない
    return NextResponse.json({ url: null, error: e instanceof Error ? e.message : String(e) });
  }
}
