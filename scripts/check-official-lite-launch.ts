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
const rawUniversalData = structuredClone(universalData);
rawUniversalData.app_context.href = rawInviteHref;
rawUniversalData.app_context.query = Object.fromEntries(new URL(rawInviteHref).searchParams.entries());
const rawStrategy = rawUniversalData['tiktok.share.api/tiktok/linker/component/strategy/get/v1/'].data.strategy;
const rawRoma = rawStrategy.wrappers.find(item => item.name === 'wrapper_incentive_share_jump_to_roma');
if (!rawRoma) throw new Error('current TikTok roma wrapper fixture is missing');
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

for (const key of ['gd_label', 'ug_launch_category', 'incentive_redirect'] as const) {
  const tamperedContext: URL = new URL(launch!);
  const tamperedContextShortDl: URL = new URL(tamperedContext.searchParams.get('short_dl')!);
  tamperedContextShortDl.searchParams.set(key, 'different_context');
  tamperedContext.searchParams.set('short_dl', tamperedContextShortDl.toString());
  assert.equal(
    validateOfficialLiteLaunchUrl(tamperedContext.toString()),
    false,
    `mismatched ${key} between app and store routes is rejected`
  );
}
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

// 実HTMLでは apple-itunes-app に iOSの公式App Store IDがあり、aid=473824は
// 日本向けTikTok Lite。未インストール時はOneLinkの紹介パラメータを保持したまま
// af_ios_url / af_android_url だけを追加し、TikTok側テンプレートのLPフォールバックを上書きする。
const storeUniversalData = structuredClone(universalData);
storeUniversalData.app_context.query.aid = '473824';
const storeHtml = `<!doctype html><meta name="apple-itunes-app" content="app-id=6447160980, app-argument=snssdk473824://webview">
<script id="universal-data" type="application/json">${JSON.stringify(storeUniversalData)}</script>${anchor}`;
const storeLaunch = extractOfficialLiteLaunchUrl(storeHtml);
assert.ok(storeLaunch, 'current invite HTML can add direct store fallbacks');
const storeShortDl = new URL(new URL(storeLaunch).searchParams.get('short_dl')!);
assert.equal(storeShortDl.searchParams.get('af_ios_url'), 'https://apps.apple.com/app/id6447160980');
assert.equal(
  storeShortDl.searchParams.get('af_android_url'),
  'https://play.google.com/store/apps/details?id=com.ss.android.ugc.tiktok.lite'
);
assert.equal(storeShortDl.searchParams.get('wid'), '1234567890', 'store override preserves inviter wid');
assert.equal(storeShortDl.searchParams.get('af_adset'), 'OFFICIAL_ADSET', 'store override preserves invite code');
assert.equal(storeShortDl.searchParams.get('pid'), 'coin_referral_onelink_scan_code_support_mentor');
assert.match(storeLaunch, /official_extra=keep%2fme$/, 'outer unknown TikTok parameters stay byte-preserved');
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

// app側だけの文脈も、同じHTMLのuniversal-dataと一致しない完成済みhrefは採用しない。
// URL単体としては有効でも、別のshare文脈が混ざったCTAを公開しないため。
const wrongGameplayOuter = new URL(renderedLaunch);
const wrongGameplayRedirect = new URL(wrongGameplayOuter.searchParams.get('redirect_url')!);
wrongGameplayRedirect.searchParams.set('gameplay', 'different_gameplay');
wrongGameplayOuter.searchParams.set('redirect_url', wrongGameplayRedirect.toString());
assert.equal(validateOfficialLiteLaunchUrl(wrongGameplayOuter.toString()), true,
  'gameplay is page-context validation, not a standalone lite_redirect structural requirement');
const wrongGameplayAnchor = `<a href="${wrongGameplayOuter.toString().replaceAll('&', '&amp;')}">Open</a>`;
assert.equal(
  extractOfficialLiteLaunchUrl(html + wrongGameplayAnchor),
  launch,
  'a rendered CTA with mismatched page campaign context is ignored and rebuilt from universal-data'
);

const savedFetch = globalThis.fetch;
try {
  // 正攻法では短縮招待URLを加工しない。TikTok側が
  // short URL -> invite LP -> Lite/Store の公式フローを担当する。
  const short = 'https://lite.tiktok.com/t/ZS9SKLkjB9v5P-nhiPj/';
  globalThis.fetch = async () => { throw new Error('Official short invite must not be fetched during save'); };
  const result = await generateDestinationUrl(short);
  assert.equal(result.url, short, 'Shared save path preserves the official short invite byte-for-byte');
  assert.equal(new URL(result.url).hostname, 'lite.tiktok.com');

  const expanded = await generateDestinationUrl(inviteUrl.toString());
  assert.equal(expanded.url, inviteUrl.toString(),
    'An already-expanded invite LP stays on the official LP so TikTok can bind the referral');

  const migrated = await generateDestinationUrl(launch);
  assert.equal(migrated.url, nestedInvite.toString(),
    'A legacy saved lite_redirect is migrated back to its embedded official invite LP');
  assert.equal(migrated.mode, 'lp');
} finally {
  globalThis.fetch = savedFetch;
}

// 今回ユーザーから提示された実リンク形式も、TikTok側のHTML取得可否に関係なく
// 公式短縮URLのまま保持する。
const fallbackShort = 'https://lite.tiktok.com/t/ZS9AsxUWdSgEF-9javb/';
try {
  globalThis.fetch = async () => new Response('temporary upstream failure', { status: 503 });
  const fallback = await generateDestinationUrl(fallbackShort);
  assert.equal(fallback.url, fallbackShort,
    'Official short invite is preserved even if TikTok HTML is temporarily unavailable');
  assert.equal(detectBuildMode(fallback.url), 'original');

  const expanded = await generateDestinationUrl(inviteUrl.toString());
  assert.equal(expanded.url, inviteUrl.toString(),
    'Expanded official invite LP remains usable and is not forced through lite_redirect');
} finally {
  globalThis.fetch = savedFetch;
}

console.log('Official TikTok Lite invite flow: short link and invite LP are preserved; legacy lite_redirect is migrated back to LP');
