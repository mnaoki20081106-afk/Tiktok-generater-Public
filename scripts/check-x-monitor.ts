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
const switcher = fs.readFileSync(
  new URL('../components/XMonitorFeedSwitcher.tsx', import.meta.url),
  'utf8',
);
const postCard = fs.readFileSync(
  new URL('../components/XPostCard.tsx', import.meta.url),
  'utf8',
);
const layout = fs.readFileSync(
  new URL('../app/x-monitor/layout.tsx', import.meta.url),
  'utf8',
);
const autoRefresh = fs.readFileSync(
  new URL('../components/XMonitorAutoRefresh.tsx', import.meta.url),
  'utf8',
);
const monitorLib = fs.readFileSync(
  new URL('../lib/x-monitor.ts', import.meta.url),
  'utf8',
);
const studioHeader = fs.readFileSync(
  new URL('../components/StudioHeader.tsx', import.meta.url),
  'utf8',
);
const dashboardLayout = fs.readFileSync(
  new URL('../app/dashboard/layout.tsx', import.meta.url),
  'utf8',
);
const adminLayout = fs.readFileSync(
  new URL('../app/admin/layout.tsx', import.meta.url),
  'utf8',
);

assert.match(page, /<XMonitorFeedSwitcher/);
assert.match(page, /earlyPosts=\{data\.earlyPosts\}/);
assert.match(page, /trendingPosts=\{data\.trendingPosts\}/);
assert.doesNotMatch(
  page,
  /data\.posts/,
  'public X monitor page must not render a merged post feed',
);

assert.match(switcher, /useState<Feed>\('early'\)/, 'source UI defaults to early discovery');
assert.match(switcher, /setFeed\('early'\)/);
assert.match(switcher, /setFeed\('trending'\)/);
assert.match(switcher, />\s*早期発見\s*</);
assert.match(switcher, /xmon-flame-emoji/);
assert.match(switcher, /バズっている/);
assert.doesNotMatch(switcher, /🔥/, 'native red fire emoji must not be used in X monitor labels');
assert.match(
  switcher,
  /feed === 'trending' \? trendingPosts : earlyPosts/,
  'only the selected source feed should be rendered',
);
assert.match(postCard, /isTrending \? '現在' : '予測最終'/);
assert.match(
  postCard,
  /isTrending \? post\.impressions : post\.predictedFinalImpressions/,
  'trending must lead with current impressions while early leads with predicted final impressions',
);

assert.match(layout, /<XMonitorAutoRefresh \/>/);
assert.match(
  autoRefresh,
  /15 \* 60 \* 1000/,
  'X monitor UI must refresh every 15 minutes',
);
assert.match(autoRefresh, /router\.refresh\(\)/);
assert.match(autoRefresh, /visibilitychange/);
assert.match(
  monitorLib,
  /t=\$\{Date\.now\(\)\}/,
  'runtime JSON fetches must bypass upstream raw-file caches',
);
assert.match(monitorLib, /cache: 'no-store'/);

assert.doesNotMatch(
  studioHeader,
  /リンクツール|\/tools\/link-generator/,
  'broken link tool must not appear in studio navigation',
);
assert.match(studioHeader, />\s*X監視\s*</);
assert.match(studioHeader, />\s*マイサイト\s*</);
assert.match(studioHeader, /studio-nav-current/);
assert.match(layout, /<StudioHeader current="x-monitor" \/>/);
assert.match(dashboardLayout, /<StudioHeader current="dashboard" \/>/);
assert.match(adminLayout, /<StudioHeader current="dashboard" \/>/);
assert.doesNotMatch(
  layout,
  /publicView/,
  'X monitor must use the same two-tab studio navigation as authenticated pages',
);

const actions = fs.readFileSync(new URL('../app/admin/x-keyword-actions.ts', import.meta.url), 'utf8');
const github = fs.readFileSync(new URL('../lib/x-monitor-github.ts', import.meta.url), 'utf8');
assert.match(actions, /assertAdmin\(\)/, 'keyword writes must re-check admin on the server');
assert.match(github, /X_BUNSEKI_GITHUB_TOKEN/, 'keyword writes must use server-only token');
assert.doesNotMatch(github, /NEXT_PUBLIC_X_BUNSEKI_GITHUB_TOKEN/, 'GitHub token must never be public');

const css = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
assert.match(css, /@media \(max-width: 760px\)/);
assert.match(css, /\.xmon-prediction/);
assert.match(css, /\.xmon-flame-emoji/);
assert.match(css, /data:image\/png;base64/);
assert.match(css, /overflow-x: clip/);

console.log('✅ X monitor source-section contract checks passed');
