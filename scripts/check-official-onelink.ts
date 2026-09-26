import assert from 'node:assert/strict';
import { generateDestinationUrl, isTikTokLiteOneLink, isTikTokLiteInviteShortLink, detectBuildMode } from '../lib/link-generator.ts';

const savedFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error('Official OneLinks must not be fetched or expanded'); };
try {
  const inputs = [
    'https://snssdk473824.onelink.me/4P4E/opaqueID',
    'https://snssdk473824.onelink.me/4P4E?af_dp=snssdk473824%3A%2F%2Fwebview%3Furl%3Dhttps%253A%252F%252Fexample.com&pid=invite&c=a+b&wid=123&af_adset=x%2fy&af_ios_url=https%3A%2F%2Fapps.apple.com%2Ftest',
    'https://snssdk473824.onelink.me/4P4E?unknown=one&unknown=two&is_retargeting=false#anchor',
  ];
  for (const input of inputs) {
    const result = await generateDestinationUrl('  ' + input + '  ');
    assert.equal(result.url, input, 'Preserve original URL byte for byte apart from surrounding whitespace');
    assert.deepEqual(result.removed, []);
    assert.equal(result.mode, 'onelink');
    assert.equal((await generateDestinationUrl(result.url)).url, input, 'Resaving is idempotent');
  }
  for (const input of ['https://snssdk473824.onelink.me.evil.example/4P4E', 'http://snssdk473824.onelink.me/4P4E', 'https://user:pass@snssdk473824.onelink.me/4P4E', 'https://snssdk473824.onelink.me:8080/4P4E', 'https://snssdk1180.onelink.me/BAuo', 'https://lite.tiktok.com/t/example']) {
    assert.equal(isTikTokLiteOneLink(input), false);
  }
  for (const invalid of ['https://lite.tiktok.com.evil.example/t/test', 'http://lite.tiktok.com/t/test', 'https://user@lite.tiktok.com/t/test', 'https://lite.tiktok.com:444/t/test', 'https://lite.tiktok.com/t/', 'https://lite.tiktok.com/other/test']) assert.equal(isTikTokLiteInviteShortLink(invalid), false);
  assert.equal(isTikTokLiteInviteShortLink('https://lite.tiktok.com/t/ZS9STpGp6kK2T-HhDaj/'), true);
  assert.equal(detectBuildMode('https://lite.tiktok.com/t/ZS9STpGp6kK2T-HhDaj/'), 'original');
  const suppliedInvite = 'https://lite.tiktok.com/t/ZS9AsxUWdSgEF-9javb/';
  assert.equal(isTikTokLiteInviteShortLink(suppliedInvite), true);
  const fallback = await generateDestinationUrl(suppliedInvite);
  assert.equal(
    fallback.url,
    suppliedInvite,
    'If launch metadata cannot be resolved, preserve the original short invite as the last-resort referral path',
  );
  assert.equal(fallback.mode, 'original');
} finally { globalThis.fetch = savedFetch; }
console.log('Official Lite links: OneLinks are preserved; short invites keep an original-link referral fallback when launch extraction fails');
