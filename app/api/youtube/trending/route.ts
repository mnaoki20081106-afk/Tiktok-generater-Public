import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseYouTubePopularVideos } from '@/lib/youtube-trending';

export const dynamic = 'force-dynamic';

/** 認証済みエディター専用。APIキーをブラウザへ渡さず、日本の人気動画候補だけを返す。 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 });

  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: 'YouTube自動入力が未設定です。管理者がYOUTUBE_API_KEYを設定してください。' },
      { status: 503 }
    );
  }

  const url = new URL('https://www.googleapis.com/youtube/v3/videos');
  url.searchParams.set('part', 'snippet,statistics,contentDetails');
  url.searchParams.set('chart', 'mostPopular');
  url.searchParams.set('regionCode', 'JP');
  url.searchParams.set('hl', 'ja');
  url.searchParams.set('maxResults', '25');
  url.searchParams.set('key', apiKey);

  try {
    // 同じ人気動画一覧を15分キャッシュし、編集操作によるAPIクォータ消費を抑える。
    const response = await fetch(url, { next: { revalidate: 900 } });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data && typeof data === 'object'
        ? String((data as { error?: { message?: unknown } }).error?.message || '')
        : '';
      return NextResponse.json(
        { error: `YouTubeから動画を取得できませんでした。${message ? ` ${message.slice(0, 160)}` : ''}` },
        { status: 502 }
      );
    }
    const videos = parseYouTubePopularVideos(data);
    if (videos.length === 0) {
      return NextResponse.json({ error: '利用できる人気動画が見つかりませんでした。' }, { status: 502 });
    }
    return NextResponse.json({ videos }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'YouTubeへの接続に失敗しました。時間を置いて再実行してください。' }, { status: 502 });
  }
}
