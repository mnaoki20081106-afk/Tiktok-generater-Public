import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { resolveCreatorUrlByFingerprint } from '@/lib/surprise';
import { lpToPrefetch } from '@/lib/link-generator';
import { DEVICE_COOKIE } from '@/lib/device';
import { hashClientIp } from '@/lib/request-identity';

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

  // 作成者識別シグナルはサプライズ抽選の本人除外にだけ使う。公開REST APIへ出さず、
  // Service Roleで非公開のsite_owner_signalsも照合する。
  const supabase = createAdminClient();
  const { data: site } = await supabase.from('sites').select('*').eq('slug', slug).maybeSingle();
  if (!site) {
    return NextResponse.json({ href: null });
  }

  const cookieStore = await cookies();
  const deviceId = cookieStore.get(DEVICE_COOKIE)?.value ?? null;
  const ipHash = hashClientIp(request.headers);
  let visitorUserId: string | null = null;
  const hasAuthCookie = cookieStore.getAll().some(cookie => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token'));
  if (hasAuthCookie) {
    try {
      const auth = await createClient();
      const { data: { user } } = await auth.auth.getUser();
      visitorUserId = user?.id ?? null;
    } catch {
      // 認証基盤が一時的に応答しなくても、端末・指紋・IPの照合は継続する。
    }
  }

  const href = await resolveCreatorUrlByFingerprint(site, fp, { deviceId, ipHash, userId: visitorUserId });

  /* 差し替え後のURLが「LPの画面を見せない」形なら、裏で踏むべき招待LPのURLも返す。
     公開ページ側はこれを受けて踏み先を差し替える(踏んだ招待と開くアプリを揃えるため)。 */
  return NextResponse.json({ href, prefetch: href ? (lpToPrefetch(href) ?? null) : null });
}
