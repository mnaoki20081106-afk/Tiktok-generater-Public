'use client';

import { useState } from 'react';
import { XPostCard } from '@/components/XPostCard';
import type { XMonitorPost } from '@/lib/x-monitor';

type Feed = 'early' | 'trending';

export function XMonitorFeedSwitcher({
  earlyPosts,
  trendingPosts,
}: {
  earlyPosts: XMonitorPost[];
  trendingPosts: XMonitorPost[];
}) {
  const [feed, setFeed] = useState<Feed>('early');
  const posts = feed === 'trending' ? trendingPosts : earlyPosts;
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
          <span>{earlyPosts.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!isEarly}
          className={!isEarly ? 'active' : ''}
          onClick={() => setFeed('trending')}
        >
          🔥 バズっている
          <span>{trendingPosts.length}</span>
        </button>
      </div>

      <div className="xmon-feed-head">
        <div>
          <p className="studio-eyebrow">
            {isEarly ? 'EARLY DISCOVERY' : 'TRENDING NOW'}
          </p>
          <h2>{isEarly ? '早期発見' : '🔥 バズっている'}</h2>
        </div>
        <span>
          {isEarly
            ? `${earlyPosts.length} posts · 4時間以内・予測最終100万imp以上 · 予測最終imp順`
            : `${trendingPosts.length} posts · 4時間超〜24時間・現在150万imp以上 · imp/分順`}
        </span>
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
