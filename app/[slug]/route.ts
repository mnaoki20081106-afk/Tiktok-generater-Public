import { cookies } from 'next/headers';
import { after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { renderRedirectHtml, renderViewerHtml, siteToViewerData } from '@/lib/tiktok-viewer';
import { resolveDestinationUrl } from '@/lib/surprise';
import { recordPageView } from '@/lib/analytics';
import { DEVICE_COOKIE } from '@/lib/device';
import { isInAppBrowser } from '@/lib/lite-launch';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // creator_device_id / creator_fingerprint はサプライズ抽選の判定にのみ使う非公開の値のため、
  // 匿名ロール(anon)には公開していない。Service Roleクライアントで読み取る。
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
  const destinationUrl = await resolveDestinationUrl(site, deviceId);

  // PV/UU集計用の記録はレスポンス送信をブロックしないよう、応答後に実行する
  after(() => recordPageView(supabase, site.id, deviceId, request.headers.get('user-agent')));

  const viewerData = siteToViewerData(site, origin);
  viewerData.tiktokUrl = destinationUrl;

  /* <a> の href はDOM構築の時点で確定していなければならない(JSから書き換えると
     利用者のタップとして扱われず Universal Link / スキームの受け渡しが壊れる)ので、
     アプリ内ブラウザかどうかの判定もサーバー側で行う。 */
  viewerData.inAppBrowser = isInAppBrowser(request.headers.get('user-agent') ?? '');

  /* クッションページを挟まない設定のサイトは、TikTok風ページを表示せず遷移先へ直行させる。
     未設定の既存サイトは true(=従来どおりTikTok風ページを表示)として扱う。 */
  const useCushionPage = site.content_data?.useCushionPage !== false;
  const html = useCushionPage ? renderViewerHtml(viewerData) : renderRedirectHtml(viewerData);

  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'no-cache' },
  });
}
