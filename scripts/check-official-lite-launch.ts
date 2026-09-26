import assert from 'node:assert/strict';
import {
  extractOfficialLiteLaunchUrl,
  extractUniversalData,
  validateOfficialLiteLaunchUrl,
} from '../lib/official-lite-launch.ts';
import { detectBuildMode, isOfficialTikTokLiteLaunchUrl, generateDestinationUrl } from '../lib/link-generator.ts';

// 実HTMLのshare_page_dataはURL上の「+」がURLSearchParamsでは空白として見える。
const sharePageData = 'MIIB current+shape/test=='.replace('+', ' ');
const inviteUrl = new URL('https://www.tiktok.com/ug/incentive/share/pro_scan_code');
inviteUrl.searchParams.set('u_code', 'TESTCODE');
inviteUrl.searchParams.set('share_page_data', sharePageData);
inviteUrl.searchParams.set('inc_target_url', 'aweme://roma_redirect/?spark_page=scan_code');
inviteUrl.searchParams.set('inc_pid', 'coin_referral_onelink_scan_code_support_mentor');
inviteUrl.searchParams.set('media_source', 'coin_referral_onelink_scan_code_support_mentor');
inviteUrl.searchParams.set('ug_launch_category', 'referral');
inviteUrl.searchParams.set('gd_label', 'click_wap_coin_scan_code_support_mentor');
inviteUrl.searchParams.set('share_enter_from', 'bottom_tab');
inviteUrl.searchParams.set('utm_source', 'copy');
inviteUrl.searchParams.set('share_type', 'link');
inviteUrl.searchParams.set('share_position', 'invite_panel');
inviteUrl.searchParams.set('gameplay', 'scan_code_support');
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
  // 2026-09-26添付HTMLの現行形式。
  'tiktok.ug_incentive.client_api/tiktok/incentive/v2/share/page': {
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
assert.equal(shortDl.searchParams.get('pid'), 'coin_referral_onelink_scan_code_support_mentor');
assert.equal(shortDl.searchParams.get('af_adset'), 'OFFICIAL_ADSET');
assert.equal(shortDl.searchParams.get('media_source'), 'coin_referral_onelink_scan_code_support_mentor');

// 現行HTMLではshare/pageがv2。描画済み<a>が消えてもuniversal-dataだけで
// 同じLite/ストア分岐を復元できることを固定する。
const v2OnlyHtml = `<!doctype html><script id="universal-data" type="application/json">${JSON.stringify(universalData)}</script>`;
const v2OnlyLaunch = extractOfficialLiteLaunchUrl(v2OnlyHtml);
assert.ok(v2OnlyLaunch, 'v2/share/page alone can rebuild the official Lite launch');
assert.equal(validateOfficialLiteLaunchUrl(v2OnlyLaunch), true);
assert.equal(new URL(new URL(v2OnlyLaunch).searchParams.get('short_dl')!).searchParams.get('af_adset'), 'OFFICIAL_ADSET');

// 添付HTMLのapp_context.hrefは画像URLの "~tplv-..." を生の "~" のまま持つ。
// URLSearchParamsで作るテストデータとはシリアライズが違うため、実HTMLと同じraw表現を
// 明示的に作り、lite_redirectの外側まで1バイト表現を保持できることを確認する。
const rawInviteHref = inviteUrl.toString()
  + '&og_image=https%3A%2F%2Fexample.com%2Fcurrent.png~tplv-current.image';
const rawUniversalData = structuredClone(universalData) as Record<string, any>;
rawUniversalData.app_context.href = rawInviteHref;
rawUniversalData.app_context.query = Object.fromEntries(new URL(rawInviteHref).searchParams.entries());
const rawStrategy = rawUniversalData['tiktok.share.api/tiktok/linker/component/strategy/get/v1/'].data.strategy;
const rawRoma = rawStrategy.wrappers.find((item: any) => item.name === 'wrapper_incentive_share_jump_to_roma');
rawRoma.wrapper_url.url_schemes = [
  `snssdk473824://roma_redirect/?params_url=${encodeURIComponent(rawInviteHref)}&spark_page={{url}}`,
];
const rawHtml = `<!doctype html><script id="universal-data" type="application/json">${JSON.stringify(rawUniversalData)}</script>`;
const rawLaunch = extractOfficialLiteLaunchUrl(rawHtml);
assert.ok(rawLaunch);
assert.match(rawLaunch, /current\.png~tplv-current\.image/, 'TikTok-style raw ~ encoding is preserved');
assert.doesNotMatch(rawLaunch, /current\.png%7Etplv-current\.image/i, 'outer URL is not reserialized by URLSearchParams');

// 旧HTML(v1/coin/share_page)も再保存・過去データ用に読み続ける。
const legacyUniversalData = structuredClone(universalData) as Record<string, unknown>;
delete legacyUniversalData['tiktok.ug_incentive.client_api/tiktok/incentive/v2/share/page'];
legacyUniversalData['tiktok.ug_incentive.client_api/tiktok/incentive/v1/coin/share_page'] = {
  data: { data: { invite_code: 'LEGACY_ADSET' } },
};
const legacyHtml = `<!doctype html><script id="universal-data" type="application/json">${JSON.stringify(legacyUniversalData)}</script>`;
const legacyLaunch = extractOfficialLiteLaunchUrl(legacyHtml);
assert.ok(legacyLaunch, 'legacy v1/coin/share_page remains supported');
assert.equal(new URL(new URL(legacyLaunch).searchParams.get('short_dl')!).searchParams.get('af_adset'), 'LEGACY_ADSET');

const tampered = new URL(launch);
const tamperedShortDl = new URL(tampered.searchParams.get('short_dl')!);
tamperedShortDl.searchParams.set('wid', '999');
tampered.searchParams.set('short_dl', tamperedShortDl.toString());
assert.equal(validateOfficialLiteLaunchUrl(tampered.toString()), false, 'mismatched attribution IDs are rejected');

const wrongPid = new URL(launch);
const wrongPidShortDl = new URL(wrongPid.searchParams.get('short_dl')!);
wrongPidShortDl.searchParams.set('pid', 'different_campaign');
wrongPid.searchParams.set('short_dl', wrongPidShortDl.toString());
assert.equal(validateOfficialLiteLaunchUrl(wrongPid.toString()), false, 'mismatched referral pid is rejected');

const wrongMediaSource = new URL(launch);
const wrongMediaShortDl = new URL(wrongMediaSource.searchParams.get('short_dl')!);
wrongMediaShortDl.searchParams.set('media_source', 'different_campaign');
wrongMediaSource.searchParams.set('short_dl', wrongMediaShortDl.toString());
assert.equal(validateOfficialLiteLaunchUrl(wrongMediaSource.toString()), false, 'mismatched media_source is rejected');
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

// 完成済みhref自体は形式上有効でも、同じHTMLのuniversal-dataと紹介者情報が
// 食い違う場合はそのhrefを捨て、universal-dataから正しいものを再構築する。
const mixedOuter = new URL(renderedLaunch);
const mixedShortDl = new URL(mixedOuter.searchParams.get('short_dl')!);
mixedShortDl.searchParams.set('af_adset', 'OTHER_INVITER');
mixedOuter.searchParams.set('short_dl', mixedShortDl.toString());
const mixedAnchor = `<a href="${mixedOuter.toString().replaceAll('&', '&amp;')}">Open</a>`;
assert.equal(
  extractOfficialLiteLaunchUrl(html + mixedAnchor),
  launch,
  'a rendered CTA with a mismatched invite code is ignored and rebuilt from matching universal-data'
);

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

// TikTok側の一時障害・HTML変更で公式lite_redirectを抽出できない場合でも、
// 招待導線そのものは失わない。今回ユーザーから提示された実リンク形式を固定する。
const fallbackShort = 'https://lite.tiktok.com/t/ZS9AsxUWdSgEF-9javb/';
try {
  globalThis.fetch = async () => new Response('temporary upstream failure', { status: 503 });
  const fallback = await generateDestinationUrl(fallbackShort);
  assert.equal(fallback.url, fallbackShort,
    'If official launch extraction fails, keep the verified TikTok Lite short invite as the last-resort referral path');
  assert.equal(detectBuildMode(fallback.url), 'original');

  await assert.rejects(
    () => generateDestinationUrl(inviteUrl.toString()),
    /公式|招待LP|分岐リンク|取得でき/,
    'An expanded invite LP has no recoverable original short URL, so it still fails closed'
  );
} finally {
  globalThis.fetch = savedFetch;
}

console.log('Official TikTok Lite launch URL: app/store fan-out is preferred; original short invite is retained only as a last resort');
