import { cookies } from 'next/headers';
import { after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { renderViewerHtml, siteToViewerData } from '@/lib/tiktok-viewer';
import { resolveDestinationUrl } from '@/lib/surprise';
import { recordPageView } from '@/lib/analytics';
import { DEVICE_COOKIE } from '@/lib/device';
import { hashClientIp } from '@/lib/request-identity';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // 作成者識別シグナルはサプライズ抽選の本人除外にだけ使う。公開REST APIへ出さず、
  // Service Roleで非公開のsite_owner_signalsも照合する。
  const supabase = createAdminClient();

  const { data: site } = await supabase.from('sites').select('*').eq('slug', slug).maybeSingle();

  if (!site) {
    return new Response(
      '<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>404</title></head>' +
        '<body style="font-family:sans-serif;text-align:center;padding:80px 20px;">' +
        '<h1>404</h1><p>お探しのページは見つかりませんでした。</p></body></html>',
      { status: 404, headers: { 'Content-Type': 'text/html;charset=UTF-8' } }
    );
  }

  const origin = new URL(request.url).origin;
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
  const destinationUrl = await resolveDestinationUrl(site, { deviceId, ipHash, userId: visitorUserId });

  // PV/UU集計用の記録はレスポンス送信をブロックしないよう、応答後に実行する
  after(() => recordPageView(supabase, site.id, deviceId, request.headers.get('user-agent')));

  const viewerData = siteToViewerData(site, origin);
  viewerData.tiktokUrl = destinationUrl;
  const html = renderViewerHtml(viewerData);

  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'no-cache' },
  });
}
