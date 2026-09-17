import assert from 'node:assert/strict';
import {
  createTikTokEngagementCounts,
  formatTikTokCount,
  likeCountToSlider,
  parseTikTokCount,
  sliderToLikeCount,
} from '../lib/tiktok-engagement.ts';

assert.equal(sliderToLikeCount(0), 0);
assert.equal(sliderToLikeCount(100), 1_000);
assert.equal(sliderToLikeCount(500), 125_000);
assert.equal(sliderToLikeCount(1_000), 1_000_000);
assert.equal(sliderToLikeCount(likeCountToSlider(125_000)), 125_000);

const minimums = createTikTokEngagementCounts(100_000, () => 0);
assert.deepEqual(minimums, { likes: 100_000, comments: 800, saves: 80_000, shares: 5_000 });
const maximums = createTikTokEngagementCounts(100_000, () => 1);
assert.deepEqual(maximums, { likes: 100_000, comments: 1_200, saves: 120_000, shares: 7_000 });

assert.equal(formatTikTokCount(3_100), '3.1k');
assert.equal(formatTikTokCount(1_000_000), '1M');
assert.equal(parseTikTokCount('3.1k'), 3_100);
assert.equal(parseTikTokCount('12.5万'), 125_000);

console.log('TikTok engagement curve, random multiplier thresholds, and count formatting passed');
