import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  formatCompactNumber,
  normalizeXMonitorPost,
  splitXMonitorHits,
} from '../lib/x-monitor.ts';

const early = {
  post_id: '123',
  author: 'early_user',
  author_name: '早期ユーザー',
  posted_at: '2026-09-22T09:00:00Z',
  text: 'early',
  url: 'https://x.com/early_user/status/123',
  replies: 10,
  retweets: 20,
  quotes: 3,
  likes: 400,
  bookmarks: 50,
  impressions: 200000,
  predicted_final_impressions: 5000000,
  impressions_per_min: 8000,
  impressions_acceleration: 1.74,
  prediction_confidence: 'high',
  score: 88,
};

const trending = {
  post_id: '456',
  author: 'trending_user',
  author_name: 'バズユーザー',
  posted_at: '2026-09-22T03:00:00Z',
  text: 'trending',
  url: 'https://x.com/trending_user/status/456',
  impressions: 9_000_000,
  predicted_final_impressions: 10_000_000,
  impressions_per_min: 14_000,
};

const normalized = normalizeXMonitorPost(early);
assert.ok(normalized);
assert.equal(normalized.authorName, '早期ユーザー');
assert.equal(normalized.quotes, 3);
assert.equal(normalized.predictedFinalImpressions, 5_000_000);

const split = splitXMonitorHits({
  early_posts: [early],
  trending_posts: [trending],
  posts: [early], // X-Bunseki's backwards-compatible alias of early_posts
});
assert.deepEqual(split.earlyPosts.map((post) => post.id), ['123']);
assert.deepEqual(split.trendingPosts.map((post) => post.id), ['456']);
assert.equal(
  split.earlyPosts.some((post) => post.id === '456'),
  false,
  'trending posts must never be merged into early discovery',
);
assert.equal(
  split.trendingPosts.some((post) => post.id === '123'),
  false,
  'early posts must never be merged into trending',
);

const fallback = splitXMonitorHits({
  posts: [early],
});
assert.deepEqual(
  fallback.earlyPosts.map((post) => post.id),
  ['123'],
  'legacy posts must be treated only as the early_posts fallback',
);
assert.deepEqual(fallback.trendingPosts, []);

assert.equal(formatCompactNumber(12_400_000), '12.4M');
assert.equal(formatCompactNumber(438_000), '438.0K');

const page = fs.readFileSync(new URL('../app/x-monitor/page.tsx', import.meta.url), 'utf8');
assert.match(page, />早期発見</);
assert.match(page, />バズっている</);
assert.match(page, /data\.earlyPosts/);
assert.match(page, /data\.trendingPosts/);
assert.doesNotMatch(
  page,
  /data\.posts/,
  'public X monitor page must not render a merged post feed',
);

const actions = fs.readFileSync(new URL('../app/admin/x-keyword-actions.ts', import.meta.url), 'utf8');
const github = fs.readFileSync(new URL('../lib/x-monitor-github.ts', import.meta.url), 'utf8');
assert.match(actions, /assertAdmin\(\)/, 'keyword writes must re-check admin on the server');
assert.match(github, /X_BUNSEKI_GITHUB_TOKEN/, 'keyword writes must use server-only token');
assert.doesNotMatch(github, /NEXT_PUBLIC_X_BUNSEKI_GITHUB_TOKEN/, 'GitHub token must never be public');

const css = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
assert.match(css, /@media \(max-width: 760px\)/);
assert.match(css, /\.xmon-prediction/);
assert.match(css, /overflow-x: clip/);

console.log('✅ X monitor source-section contract checks passed');
