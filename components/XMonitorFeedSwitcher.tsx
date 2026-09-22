'use client';

import { useState } from 'react';
import { XPostCard } from '@/components/XPostCard';
import type { XMonitorPost } from '@/lib/x-monitor';

type Feed = 'early' | 'trending';
type SortMode = 'default' | 'newest';

export function XMonitorFeedSwitcher({
  earlyPosts,
  trendingPosts,
}: {
  earlyPosts: XMonitorPost[];
  trendingPosts: XMonitorPost[];
}) {
  const [feed, setFeed] = useState<Feed>('early');
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const sourcePosts = feed === 'trending' ? trendingPosts : earlyPosts;
  const posts =
    sortMode === 'newest'
      ? [...sourcePosts].sort((a, b) => {
          const aTime = a.postedAt ? Date.parse(a.postedAt) : Number.NaN;
          const bTime = b.postedAt ? Date.parse(b.postedAt) : Number.NaN;

          if (Number.isFinite(aTime) && Number.isFinite(bTime)) {
            return bTime - aTime;
          }
          if (Number.isFinite(aTime)) return -1;
          if (Number.isFinite(bTime)) return 1;

          const aAge = a.ageMinutes ?? Number.POSITIVE_INFINITY;
          const bAge = b.ageMinutes ?? Number.POSITIVE_INFINITY;
          return aAge - bAge;
        })
      : sourcePosts;
  const isEarly = feed === 'early';

  return (
    <section className="xmon-feed-section">
      <div className="xmon-feed-tabs" role="tablist" aria-label="X監視表示切替">
        <button
          type="button"
          role="tab"
          aria-selected={isEarly}
          className={isEarly ? 'active' : ''}
          onClick={() => setFeed('early')}
        >
          早期発見
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!isEarly}
          className={!isEarly ? 'active' : ''}
          onClick={() => setFeed('trending')}
        >
          <span className="xmon-trending-label"><span className="xmon-flame-emoji" aria-hidden="true" />バズっている</span>
        </button>
      </div>

      <div className="xmon-feed-head">
        <div>
          <p className="studio-eyebrow">
            {isEarly ? 'EARLY DISCOVERY' : 'TRENDING NOW'}
          </p>
          <h2>{isEarly ? '早期発見' : <span className="xmon-trending-label"><span className="xmon-flame-emoji" aria-hidden="true" />バズっている</span>}</h2>
        </div>
        <div className="xmon-feed-controls">
          <span>
            {isEarly
              ? `${earlyPosts.length} posts · 4時間以内・予測最終100万imp以上`
              : `${trendingPosts.length} posts · 4時間超〜24時間・現在150万imp以上`}
          </span>
          <div className="xmon-sort-toggle" role="group" aria-label="並び順">
            <button
              type="button"
              className={sortMode === 'default' ? 'active' : ''}
              aria-pressed={sortMode === 'default'}
              onClick={() => setSortMode('default')}
            >
              インプレッション順
            </button>
            <button
              type="button"
              className={sortMode === 'newest' ? 'active' : ''}
              aria-pressed={sortMode === 'newest'}
              onClick={() => setSortMode('newest')}
            >
              新着順
            </button>
          </div>
        </div>
      </div>

      <div className="xmon-feed" role="tabpanel">
        {posts.length ? (
          posts.map((post, index) => (
            <XPostCard
              key={post.id}
              post={post}
              rank={index + 1}
              feed={feed}
            />
          ))
        ) : (
          <div className="xmon-empty">
            {isEarly
              ? '早期発見投稿はありません。'
              : '現在表示する大バズ投稿はありません。'}
          </div>
        )}
      </div>
    </section>
  );
}
