import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { renderViewerHtml, siteToViewerData } from '@/lib/tiktok-viewer';
import { resolveDestinationUrl } from '@/lib/surprise';
import { DEVICE_COOKIE } from '@/lib/device';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

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

  const viewerData = siteToViewerData(site, origin);
  viewerData.tiktokUrl = destinationUrl;
  const html = renderViewerHtml(viewerData);

  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'no-cache' },
  });
}
