import assert from 'node:assert/strict';
import {
  formatYouTubeDuration,
  formatYouTubeElapsedDays,
  formatYouTubeViewCount,
  parseYouTubeChannelAvatars,
  parseYouTubePopularVideos,
} from '../lib/youtube-trending.ts';

assert.equal(formatYouTubeViewCount('123456'), '12.3万回視聴');
assert.equal(formatYouTubeViewCount('250000000'), '2.5億回視聴');
assert.equal(formatYouTubeViewCount('999'), '999回視聴');
assert.equal(formatYouTubeDuration('PT8M24S'), '8:24');
assert.equal(formatYouTubeDuration('PT1H2M3S'), '1:02:03');
assert.equal(formatYouTubeDuration('invalid'), '');
assert.equal(formatYouTubeElapsedDays('2026-09-14T00:00:00Z', new Date('2026-09-17T12:00:00Z')), '3日前');

const videos = parseYouTubePopularVideos({
  items: [
    {
      id: 'abcDEF_1234',
      snippet: {
        title: '人気動画タイトル',
        channelTitle: 'サンプルチャンネル',
        channelId: 'UCabcDEF_1234',
        publishedAt: '2026-09-15T00:00:00Z',
        thumbnails: {
          medium: { url: 'https://i.ytimg.com/vi/abcDEF_1234/mqdefault.jpg' },
          high: { url: 'https://i.ytimg.com/vi/abcDEF_1234/hqdefault.jpg' },
        },
      },
      statistics: { viewCount: '987654' },
      contentDetails: { duration: 'PT12M5S' },
    },
    { id: '<script>', snippet: { title: 'invalid', thumbnails: { high: { url: 'javascript:alert(1)' } } } },
  ],
}, new Date('2026-09-17T12:00:00Z'));

assert.equal(videos.length, 1);
assert.deepEqual(videos[0], {
  id: 'abcDEF_1234',
  title: '人気動画タイトル',
  channel: 'サンプルチャンネル',
  channelId: 'UCabcDEF_1234',
  channelAvatar: '',
  thumbnail: 'https://i.ytimg.com/vi/abcDEF_1234/hqdefault.jpg',
  viewCount: '98.8万回視聴',
  ago: '2日前',
  duration: '12:05',
});

const channelAvatars = parseYouTubeChannelAvatars({ items: [{
  id: 'UCabcDEF_1234',
  snippet: { thumbnails: { default: { url: 'https://yt3.ggpht.com/default' }, high: { url: 'https://yt3.ggpht.com/high' } } },
}, { id: '<script>', snippet: { thumbnails: { high: { url: 'javascript:alert(1)' } } } }] });
assert.deepEqual(channelAvatars, { UCabcDEF_1234: 'https://yt3.ggpht.com/high' });

console.log('YouTube popular video metadata: title, thumbnail, views, age, and duration formatting passed');
