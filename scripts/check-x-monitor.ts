import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  formatCompactNumber,
  normalizeXMonitorPost,
  sortXMonitorPosts,
} from '../lib/x-monitor.ts';

const strong = normalizeXMonitorPost({
  post_id: '123',
  author: 'tester',
  author_name: 'テスター',
  posted_at: '2026-09-22T09:00:00Z',
  text: 'test',
  url: 'https://x.com/tester/status/123',
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
});
assert.ok(strong);
assert.equal(strong.authorName, 'テスター');
assert.equal(strong.quotes, 3);
assert.equal(strong.predictedFinalImpressions, 5_000_000);

const noPrediction = normalizeXMonitorPost({
  author: 'slow',
  url: 'https://x.com/slow/status/456',
  impressions: 9_000_000,
  predicted_final_impressions: null,
});
assert.ok(noPrediction);

const sorted = sortXMonitorPosts([noPrediction, strong]);
assert.equal(sorted[0].id, '123', 'predicted-final ranking must come first');
assert.equal(sorted[1].id, '456', 'missing prediction must be pushed behind');
assert.equal(formatCompactNumber(12_400_000), '12.4M');
assert.equal(formatCompactNumber(438_000), '438.0K');

const actions = fs.readFileSync(new URL('../app/admin/x-keyword-actions.ts', import.meta.url), 'utf8');
const github = fs.readFileSync(new URL('../lib/x-monitor-github.ts', import.meta.url), 'utf8');
assert.match(actions, /assertAdmin\(\)/, 'keyword writes must re-check admin on the server');
assert.match(github, /X_BUNSEKI_GITHUB_TOKEN/, 'keyword writes must use server-only token');
assert.doesNotMatch(github, /NEXT_PUBLIC_X_BUNSEKI_GITHUB_TOKEN/, 'GitHub token must never be public');

const css = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
assert.match(css, /@media \(max-width: 760px\)/);
assert.match(css, /\.xmon-prediction/);
assert.match(css, /overflow-x: clip/);

console.log('✅ X monitor integration contract checks passed');
