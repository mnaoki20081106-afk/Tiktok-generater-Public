import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Bookmark,
  Eye,
  Heart,
  MessageCircle,
  Quote,
  Repeat2,
} from 'lucide-react';
import {
  formatCompactNumber,
  formatRelativeTime,
  getXMonitorData,
} from '@/lib/x-monitor';

export const dynamic = 'force-dynamic';

export default async function XMonitorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getXMonitorData();
  const post = data.posts.find((row) => row.id === id);
  if (!post) notFound();

  return (
    <main className="xmon-wrap xmon-detail-wrap">
      <Link href="/x-monitor" className="xmon-back"><ArrowLeft size={16} /> ランキングへ</Link>
      <article className="xmon-detail-card">
        <header>
          <div className="xmon-avatar xmon-avatar-lg">{post.authorName.slice(0, 1).toUpperCase()}</div>
          <div>
            <h1>{post.authorName}</h1>
            <p>@{post.author} · {formatRelativeTime(post.postedAt, post.ageMinutes)}</p>
          </div>
        </header>

        <p className="xmon-detail-text">{post.text || '本文なし / メディア投稿'}</p>

        <div className="xmon-detail-prediction">
          <span>予測最終インプレッション</span>
          <strong>{formatCompactNumber(post.predictedFinalImpressions)} <small>imp</small></strong>
          <p>現在 {formatCompactNumber(post.impressions)} imp</p>
        </div>

        <div className="xmon-detail-metrics">
          <div><span>速度</span><strong>{formatCompactNumber(post.impressionsPerMin)} imp/min</strong></div>
          <div><span>加速度</span><strong>{post.impressionsAcceleration == null ? '—' : `${post.impressionsAcceleration.toFixed(2)}x`}</strong></div>
          <div><span>予測信頼度</span><strong>{post.predictionConfidence || '—'}</strong></div>
          <div><span>Buzz score</span><strong>{post.buzzScore == null ? '—' : Math.round(post.buzzScore)}</strong></div>
        </div>

        <div className="xmon-detail-engagement">
          <span><MessageCircle size={17} />返信 <b>{formatCompactNumber(post.replies)}</b></span>
          <span><Repeat2 size={17} />RT <b>{formatCompactNumber(post.retweets)}</b></span>
          <span><Quote size={17} />引用 <b>{formatCompactNumber(post.quotes)}</b></span>
          <span><Heart size={17} />いいね <b>{formatCompactNumber(post.likes)}</b></span>
          <span><Bookmark size={17} />BM <b>{formatCompactNumber(post.bookmarks)}</b></span>
          <span><Eye size={17} />imp <b>{formatCompactNumber(post.impressions)}</b></span>
        </div>

        <a className="xmon-open-x" href={post.url} target="_blank" rel="noreferrer">
          元の投稿をXで開く ↗
        </a>
      </article>
    </main>
  );
}
