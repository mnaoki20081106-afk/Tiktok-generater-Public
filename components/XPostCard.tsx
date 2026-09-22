import Link from 'next/link';
import {
  Activity,
  Bookmark,
  Eye,
  Gauge,
  Heart,
  MessageCircle,
  Quote,
  Repeat2,
  TrendingUp,
} from 'lucide-react';
import {
  formatCompactNumber,
  formatRelativeTime,
  type XMonitorPost,
} from '@/lib/x-monitor';

function confidenceLabel(value: string | null) {
  if (value === 'high') return '高';
  if (value === 'medium') return '中';
  if (value === 'low') return '低';
  return '—';
}

export function XPostCard({
  post,
  rank,
}: {
  post: XMonitorPost;
  rank: number;
}) {
  return (
    <article className="xmon-post">
      <div className="xmon-avatar" aria-hidden="true">
        {(post.authorName || post.author || 'X').slice(0, 1).toUpperCase()}
      </div>

      <div className="xmon-post-body">
        <div className="xmon-author-row">
          <div className="xmon-author">
            <span className="xmon-author-name">{post.authorName}</span>
            <span className="xmon-handle">@{post.author}</span>
            <span className="xmon-dot-separator">·</span>
            <span className="xmon-time">
              {formatRelativeTime(post.postedAt, post.ageMinutes)}
            </span>
          </div>
          <span className="xmon-rank">#{rank}</span>
        </div>

        <p className="xmon-text">{post.text || '本文なし / メディア投稿'}</p>

        <div className="xmon-prediction">
          <div className="xmon-prediction-primary">
            <span className="xmon-kicker">予測最終</span>
            <strong>
              {formatCompactNumber(post.predictedFinalImpressions)}
              <small> imp</small>
            </strong>
          </div>
          <div className="xmon-prediction-grid">
            <div>
              <span>現在</span>
              <b>{formatCompactNumber(post.impressions)} imp</b>
            </div>
            <div>
              <span>速度</span>
              <b>{formatCompactNumber(post.impressionsPerMin)} imp/min</b>
            </div>
            <div>
              <span>加速度</span>
              <b>
                {post.impressionsAcceleration == null
                  ? '—'
                  : `${post.impressionsAcceleration.toFixed(2)}x`}
              </b>
            </div>
            <div>
              <span>信頼度</span>
              <b>{confidenceLabel(post.predictionConfidence)}</b>
            </div>
          </div>
        </div>

        <div className="xmon-engagement" aria-label="投稿指標">
          <span title="返信"><MessageCircle size={15} />{formatCompactNumber(post.replies)}</span>
          <span title="リポスト"><Repeat2 size={15} />{formatCompactNumber(post.retweets)}</span>
          <span title="引用"><Quote size={15} />{formatCompactNumber(post.quotes)}</span>
          <span title="いいね"><Heart size={15} />{formatCompactNumber(post.likes)}</span>
          <span title="ブックマーク"><Bookmark size={15} />{formatCompactNumber(post.bookmarks)}</span>
          <span title="インプレッション"><Eye size={15} />{formatCompactNumber(post.impressions)}</span>
        </div>

        <div className="xmon-footer-row">
          <div className="xmon-signal-chips">
            {post.impressionsPerMin != null && (
              <span><Gauge size={13} /> {formatCompactNumber(post.impressionsPerMin)}/min</span>
            )}
            {post.impressionsAcceleration != null && (
              <span><TrendingUp size={13} /> {post.impressionsAcceleration.toFixed(2)}x</span>
            )}
            {post.buzzScore != null && (
              <span><Activity size={13} /> buzz {Math.round(post.buzzScore)}</span>
            )}
          </div>
          <div className="xmon-links">
            <Link href={`/x-monitor/${encodeURIComponent(post.id)}`}>詳細</Link>
            <a href={post.url} target="_blank" rel="noreferrer">Xで開く ↗</a>
          </div>
        </div>
      </div>
    </article>
  );
}
