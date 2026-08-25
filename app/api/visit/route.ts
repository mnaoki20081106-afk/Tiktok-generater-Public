import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveCreatorUrlByFingerprint } from '@/lib/surprise';

export const dynamic = 'force-dynamic';

interface VisitBody {
  slug?: unknown;
  fp?: unknown;
}

/**
 * 公開ページ(/[slug])から読み込み時に送られるブラウザフィンガープリントを受け取り、
 * dvid Cookieが削除されていても作成者本人・同一アカウントの端末と判定できた場合のみ
 * 本来のURLを返す(それ以外は null)。当選確率・当たりURLなど抽選設定には一切触れない。
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as VisitBody | null;
  const slug = typeof body?.slug === 'string' ? body.slug : null;
  const fp = typeof body?.fp === 'string' ? body.fp : null;

  if (!slug || !fp) {
    return NextResponse.json({ href: null });
  }

  // creator_device_id / creator_fingerprint はサプライズ抽選の判定にのみ使う非公開の値のため、
  // 匿名ロール(anon)には公開していない。Service Roleクライアントで読み取る。
  const supabase = createAdminClient();
  const { data: site } = await supabase.from('sites').select('*').eq('slug', slug).maybeSingle();
  if (!site) {
    return NextResponse.json({ href: null });
  }

  const href = await resolveCreatorUrlByFingerprint(site, fp);
  return NextResponse.json({ href });
}
