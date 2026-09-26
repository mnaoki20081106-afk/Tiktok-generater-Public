import assert from 'node:assert/strict';
import {
  extractOfficialLiteLaunchUrl,
  extractUniversalData,
  validateOfficialLiteLaunchUrl,
} from '../lib/official-lite-launch.ts';
import { detectBuildMode, isOfficialTikTokLiteLaunchUrl, generateDestinationUrl } from '../lib/link-generator.ts';

const sharePageData = 'eyJpbnZpdGUiOiJhK2IvPSJ9';
const inviteUrl = new URL('https://www.tiktok.com/ug/incentive/share/pro_scan_code');
inviteUrl.searchParams.set('u_code', 'TESTCODE');
inviteUrl.searchParams.set('share_page_data', sharePageData);
inviteUrl.searchParams.set('inc_target_url', 'aweme://roma_redirect/?spark_page=scan_code');
inviteUrl.searchParams.set('inc_pid', 'coin_referral');
inviteUrl.searchParams.set('media_source', 'coin_referral');
inviteUrl.searchParams.set('ug_launch_category', 'incentive');
inviteUrl.searchParams.set('gd_label', 'test_label');
inviteUrl.searchParams.set('share_enter_from', 'scan_code');
inviteUrl.searchParams.set('utm_source', 'copy');
inviteUrl.searchParams.set('share_type', 'copy');
inviteUrl.searchParams.set('share_position', 'button');
inviteUrl.searchParams.set('gameplay', 'referral');

const query = Object.fromEntries(inviteUrl.searchParams.entries());
const universalData = {
  app_context: { href: inviteUrl.toString(), query, wid: '1234567890' },
  'tiktok.share.api/tiktok/linker/component/strategy/get/v1/': {
    data: {
      strategy: {
        wrappers: [{
          name: 'wrapper_incentive_share_jump_to_roma',
          launch_type: 'tiktok_lite_app',
          wrapper_url: {
            url_fallback: 'https://snssdk473824.onelink.me/4P4E?domain_source=tiktok&af_dp={{schema}}',
            url_schemes: [`snssdk473824://roma_redirect/?params_url=${encodeURIComponent(inviteUrl.toString())}&spark_page={{url}}`],
          },
        }],
      },
    },
  },
  'tiktok.ug_incentive.client_api/tiktok/incentive/v1/coin/share_page': {
    data: { data: { invite_code: 'OFFICIAL_ADSET' } },
  },
};

const html = `<!doctype html><script nonce="x" type="application/json" id="universal-data">${JSON.stringify(universalData)}</script>`;
const launch = extractOfficialLiteLaunchUrl(html);
assert.ok(launch, 'official launch URL is extracted');
assert.equal(validateOfficialLiteLaunchUrl(launch), true);
assert.equal(isOfficialTikTokLiteLaunchUrl(launch), true);
assert.equal(detectBuildMode(launch), 'original');

const outer = new URL(launch);
assert.equal(outer.hostname, 'app-va.tiktokv.com');
assert.equal(outer.pathname, '/lite_redirect/');
assert.equal(outer.searchParams.get('decode_once'), '1');

const redirect = new URL(outer.searchParams.get('redirect_url')!);
const nestedInvite = new URL(redirect.searchParams.get('params_url')!);
const shortDl = new URL(outer.searchParams.get('short_dl')!);
assert.equal(nestedInvite.searchParams.get('u_code'), 'TESTCODE');
assert.equal(nestedInvite.searchParams.get('share_page_data'), sharePageData);
assert.equal(redirect.searchParams.get('u_code'), 'TESTCODE');
assert.equal(redirect.searchParams.get('share_page_data'), sharePageData);
assert.equal(redirect.searchParams.get('wid'), '1234567890');
assert.equal(shortDl.hostname, 'snssdk473824.onelink.me');
assert.equal(shortDl.pathname, '/4P4E');
assert.equal(shortDl.searchParams.get('wid'), '1234567890');
assert.equal(shortDl.searchParams.get('pid'), 'coin_referral');
assert.equal(shortDl.searchParams.get('af_adset'), 'OFFICIAL_ADSET');

const tampered = new URL(launch);
const tamperedShortDl = new URL(tampered.searchParams.get('short_dl')!);
tamperedShortDl.searchParams.set('wid', '999');
tampered.searchParams.set('short_dl', tamperedShortDl.toString());
assert.equal(validateOfficialLiteLaunchUrl(tampered.toString()), false, 'mismatched attribution IDs are rejected');
assert.equal(validateOfficialLiteLaunchUrl(launch.replace('app-va.tiktokv.com', 'app-va.tiktokv.com.evil.example')), false);
assert.equal(extractOfficialLiteLaunchUrl('<script id="universal-data">{bad json}</script>'), null);

// 実際の添付HTMLは id=universal-data (引用符なし) だった。
for (const attr of ['id=universal-data', "id='universal-data'", 'ID = "universal-data"']) {
  const variant = html.replace('id="universal-data"', attr);
  assert.deepEqual(extractUniversalData(variant), universalData);
  assert.equal(extractOfficialLiteLaunchUrl(variant), launch);
}
assert.equal(extractUniversalData(html.replace('id="universal-data"', 'data-id="universal-data"')), null);

// 描画済みボタンは不明な追加パラメータも含めてTikTokのURLをそのまま使う。
const renderedLaunch = launch + '&official_extra=keep%2fme';
const anchor = `<a class="matrix-smart-wrapper" href="${renderedLaunch.replaceAll('&', '&amp;')}">Open</a>`;
assert.equal(extractOfficialLiteLaunchUrl(html + anchor), renderedLaunch);
assert.equal(extractOfficialLiteLaunchUrl(anchor), renderedLaunch);
assert.equal(extractOfficialLiteLaunchUrl(anchor.replaceAll('&amp;', '&#38;')), renderedLaunch);
assert.equal(extractOfficialLiteLaunchUrl(`<!--${anchor}-->`), null);
assert.equal(extractOfficialLiteLaunchUrl(`<script>${anchor}</script>`), null);
assert.equal(extractOfficialLiteLaunchUrl(anchor.replace('href=', 'data-href=')), null);
assert.equal(extractOfficialLiteLaunchUrl(anchor.replace('app-va.tiktokv.com', 'evil.example')), null);

const savedFetch = globalThis.fetch;
try {
  const short = 'https://lite.tiktok.com/t/ZS9SKLkjB9v5P-nhiPj/';
  globalThis.fetch = async input => String(input) === short
    ? new Response(null, { status: 302, headers: { location: inviteUrl.toString() } })
    : new Response(html.replace('id="universal-data"', 'id=universal-data') + anchor);
  const result = await generateDestinationUrl(short);
  assert.equal(result.url, renderedLaunch, 'Shared save path extracts the official button for page and prize URLs');
  assert.equal(new URL(result.url).hostname, 'app-va.tiktokv.com');
  assert.notEqual(new URL(result.url).hostname, 'lite.tiktok.com');
  assert.equal((await generateDestinationUrl(inviteUrl.toString())).url, renderedLaunch,
    'An already-expanded invite LP is also converted to the official app/store launch URL');
  assert.equal((await generateDestinationUrl(result.url)).url, renderedLaunch, 'Resaving preserves the official button URL');
} finally {
  globalThis.fetch = savedFetch;
}

console.log('Official TikTok Lite launch URL: app and store routes preserve the same invite context');
