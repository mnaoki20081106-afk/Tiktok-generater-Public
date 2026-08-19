import { createPublicClient } from '@/lib/supabase/public';
import { renderViewerHtml, siteToViewerData } from '@/lib/tiktok-viewer';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createPublicClient();

  // edit_token列は列権限でrevokeされているため、ここで select('*') をしても含まれない。
  const { data: site } = await supabase
    .from('sites')
    .select('id, slug, title, description, image_url, content_data, created_at')
    .eq('slug', slug)
    .maybeSingle();

  if (!site) {
    return new Response(
      '<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>404</title></head>' +
        '<body style="font-family:sans-serif;text-align:center;padding:80px 20px;">' +
        '<h1>404</h1><p>お探しのページは見つかりませんでした。</p></body></html>',
      { status: 404, headers: { 'Content-Type': 'text/html;charset=UTF-8' } }
    );
  }

  const origin = new URL(request.url).origin;
  const html = renderViewerHtml(siteToViewerData(site, origin));

  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'no-cache' },
  });
}
