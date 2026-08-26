/**
 * 招待LPのURL生成が壊れていないことを、**実物のペイロードで**検証する。
 *
 *   node --experimental-strip-types scripts/check-invite-lp.ts
 *   npm test
 *
 * ## なぜこれが要るか
 *
 * この生成器は「実機で試す → 結果を見て方針を決める」を繰り返してきたが、
 * 実機の往復は高くつくうえ、途中で**因果を取り違えて2回ひっくり返している**
 * (READMEの「『公式を一切改変しない』は3回否定されている」を参照)。
 *
 * 機械で確かめられることは実機に持ち込む前に確かめる。ここで見るのは
 * 「実物の36キーが1つも欠けず、意図した1点だけが変わっているか」で、
 * これは実機を出さずに決着がつく。実機でしか分からないのは
 * 「Xがそのスキームを通すか」だけに絞れる。
 *
 * フィクスチャ(`lib/__fixtures__/invite-lp.json`)は実物の招待LPのHTMLの
 * `universal-data` から採取したクエリ36キー。u_code / share_page_data /
 * _d / share_time は実在の値なのでダミーに置き換えてある(長さと文字種は実物どおり)。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  DEFAULT_ANDROID_URL,
  DEFAULT_IOS_URL,
  DEFAULT_WEB_DP_URL,
  INCENTIVE_PARAMS,
  INTERSTITIAL_PARAMS,
  LITE_SCHEME,
  TRACKING_PARAMS,
  buildUrl,
  isInviteLpUrl,
  isLiteWrapperUrl,
  lpToPrefetch,
  parseHttpUrl,
  wrapperPayloadUrl,
} from '../lib/link-generator.ts';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(here, '../lib/__fixtures__/invite-lp.json'), 'utf-8')) as {
  base: string;
  query: Record<string, string>;
  url: string;
};

let failed = 0;

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    console.log('  ok   ' + name);
  } else {
    failed++;
    console.log('  FAIL ' + name + (detail ? '\n         ' + detail : ''));
  }
}

const source = parseHttpUrl(fixture.url);
if (!source) throw new Error('フィクスチャのURLが不正です');

console.log('実物の招待LPのペイロードで検証します');
console.log('  キー数 ' + [...source.searchParams.keys()].length + ' / URL長 ' + fixture.url.length + '\n');

/* ===== 1. 入力が招待LPのURLとして認識されるか ===== */
console.log('1. 入力の判定');
check('招待LPのURLとして認識される', isInviteLpUrl(source));
check('u_code を持っている', source.searchParams.has('u_code'));

/* ===== 2. 既定の生成(forceLite: true) ===== */
console.log('\n2. 生成結果(forceLite: true / 配布される形)');
const built = buildUrl(fixture.url, {
  iosUrl: DEFAULT_IOS_URL,
  androidUrl: DEFAULT_ANDROID_URL,
  webDpUrl: DEFAULT_WEB_DP_URL,
  forceLite: true,
  stripDeepLinks: true,
});
const out = parseHttpUrl(built.url);
if (!out) throw new Error('生成結果が http(s) のURLになっていません');

check('mode が lp(招待LP直結)', built.mode === 'lp', 'mode=' + built.mode);
check('liteForced が立っている', built.liteForced === true);
check('遷移先は https', out.protocol === 'https:', out.protocol);
check('遷移先のホストは www.tiktok.com', out.hostname === 'www.tiktok.com', out.hostname);
check('遷移先のパスは招待LPのまま', out.pathname === source.pathname, out.pathname);
check(
  '短縮リンク(lite.tiktok.com/t/...)へは絶対に飛ばさない',
  !/(^|\.)lite\.tiktok\.com$/i.test(out.hostname)
);

/* ===== 3. トラッキング必須キーが1バイトの欠損もなく保持されているか ===== */
console.log('\n3. ペイロードの保全');
const trackingLost = TRACKING_PARAMS.filter(
  (k) => source.searchParams.has(k) && out.searchParams.get(k) !== source.searchParams.get(k)
);
check('TRACKING_PARAMS が1件も欠けていない', trackingLost.length === 0, trackingLost.join(', '));

const renderLost = INTERSTITIAL_PARAMS.filter(
  (k) => source.searchParams.has(k) && out.searchParams.get(k) !== source.searchParams.get(k)
);
check(
  '描画用パラメータも欠けていない(LPのボタンが描画されなくなるため)',
  renderLost.length === 0,
  renderLost.join(', ')
);

const incentiveLost = INCENTIVE_PARAMS.filter(
  (k) => source.searchParams.has(k) && !out.searchParams.has(k)
);
check('アプリを開くためのキーが3件とも残っている', incentiveLost.length === 0, incentiveLost.join(', '));

const keptCount = [...out.searchParams.keys()].length;
check(
  'キー数が入力と同じ',
  keptCount === [...source.searchParams.keys()].length,
  keptCount + ' vs ' + [...source.searchParams.keys()].length
);

/* ===== 4. 公式との差分は inc_target_url の1点だけか ===== */
console.log('\n4. 公式のURLとの差分');
const diff: string[] = [];
source.searchParams.forEach((v, k) => {
  if (out.searchParams.get(k) !== v) diff.push(k);
});
out.searchParams.forEach((_v, k) => {
  if (!source.searchParams.has(k)) diff.push('+' + k);
});
check('差分は inc_target_url の1件だけ', diff.length === 1 && diff[0] === 'inc_target_url', diff.join(', '));

const incTarget = out.searchParams.get('inc_target_url') || '';
check('inc_target_url が Lite のスキームを指している', incTarget.startsWith(LITE_SCHEME), incTarget);
check(
  'inc_target_url のスキーム以外は1バイトも変えていない',
  incTarget.slice(LITE_SCHEME.length) ===
    (source.searchParams.get('inc_target_url') || '').replace(/^aweme:\/\//, ''),
  incTarget
);

/* ===== 5. forceLite を切れば公式と完全一致するか(切り分け用の退路) ===== */
console.log('\n5. forceLite: false(切り分け用)');
const asIs = buildUrl(fixture.url, {
  iosUrl: DEFAULT_IOS_URL,
  androidUrl: DEFAULT_ANDROID_URL,
  webDpUrl: DEFAULT_WEB_DP_URL,
  forceLite: false,
  stripDeepLinks: true,
});
check('出力が入力と1バイトも違わない', asIs.url === fixture.url);
check('liteForced が立っていない', !asIs.liteForced);

/* ===== 6. 生成済みURLを再保存しても劣化しないか ===== */
console.log('\n6. 再保存(生成済みURLをもう一度通す)');
const again = buildUrl(built.url, {
  iosUrl: DEFAULT_IOS_URL,
  androidUrl: DEFAULT_ANDROID_URL,
  webDpUrl: DEFAULT_WEB_DP_URL,
  forceLite: true,
  stripDeepLinks: true,
});
check('2回目の出力が1回目と一致する(再保存で削れない)', again.url === built.url);

/* ===== 7. LPの画面を見せない形(hideLp) =====

   遷移先はラッパーになり、招待LPは黒画面の裏で踏む。
   ここで確かめるのは「踏み先が正しく取り出せること」と
   「ラッパーの中でトラッキングが1件も欠けていないこと」。
   **裏で踏むだけでバインドが立つかどうかは実機でしか分からない。** */
console.log('\n7. hideLp: true(LPの画面を見せない形・実機で未検証)');
const hidden = buildUrl(fixture.url, {
  iosUrl: DEFAULT_IOS_URL,
  androidUrl: DEFAULT_ANDROID_URL,
  webDpUrl: DEFAULT_WEB_DP_URL,
  forceLite: true,
  stripDeepLinks: true,
  hideLp: true,
});
const hiddenUrl = parseHttpUrl(hidden.url);
if (!hiddenUrl) throw new Error('hideLp の出力が http(s) のURLになっていません');

check('遷移先は https(Xのアプリ内ブラウザがタップを通す条件)', hiddenUrl.protocol === 'https:');
check('遷移先は Lite の OneLink', isLiteWrapperUrl(hiddenUrl), hiddenUrl.toString().slice(0, 60));
check('裏で踏むURLが返っている', !!hidden.prefetchUrl);
check(
  '裏で踏むURLは、LP直結のときの遷移先と同一',
  hidden.prefetchUrl === built.url,
  String(hidden.prefetchUrl).slice(0, 80)
);
check(
  '保存済みURLからでも踏み先を復元できる(DBは1本のままでよい)',
  lpToPrefetch(hidden.url) === hidden.prefetchUrl
);

/* ラッパーの中(af_dp の params_url)に、招待LPのURLが丸ごと入っていること */
const payload = wrapperPayloadUrl(hidden.url);
check('ラッパーの中から招待LPのURLを取り出せる', !!payload);
if (payload) {
  const payloadLost = TRACKING_PARAMS.filter(
    (k) => source.searchParams.has(k) && payload.searchParams.get(k) !== source.searchParams.get(k)
  );
  check('ラッパーの中でもトラッキングが1件も欠けていない', payloadLost.length === 0, payloadLost.join(', '));
  check('ラッパーの中の u_code が生きている', payload.searchParams.get('u_code') === source.searchParams.get('u_code'));
}

/* 再保存でラッパーが剥がれたり二重に被ったりしないこと */
const hiddenAgain = buildUrl(hidden.url, {
  iosUrl: DEFAULT_IOS_URL,
  androidUrl: DEFAULT_ANDROID_URL,
  webDpUrl: DEFAULT_WEB_DP_URL,
  forceLite: true,
  stripDeepLinks: true,
  hideLp: true,
});
check('再保存してもラッパーが二重にならない', hiddenAgain.url === hidden.url);

/* hideLp を切って再保存すれば、LP直結へ戻せること(退路) */
const unwrapped = buildUrl(hidden.url, {
  iosUrl: DEFAULT_IOS_URL,
  androidUrl: DEFAULT_ANDROID_URL,
  webDpUrl: DEFAULT_WEB_DP_URL,
  forceLite: true,
  stripDeepLinks: true,
});
check('hideLp を切って再保存すればLP直結へ戻せる', unwrapped.url === built.url, unwrapped.url.slice(0, 80));

/* 既定(hideLp を渡さない)ではラッパーにならないこと */
check('既定ではラッパーにならない(LP直結のまま)', !built.prefetchUrl && built.url === built.url && !isLiteWrapperUrl(out));

console.log('');
if (failed > 0) {
  console.error(failed + ' 件の検証に失敗しました。');
  process.exit(1);
}
console.log('すべての検証を通過しました。');
