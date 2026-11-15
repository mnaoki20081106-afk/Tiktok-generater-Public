import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  decideDirectFire,
  directFireLocation,
  directFireRedirectResponse,
  isCrawlerUserAgent,
} from '../lib/direct-fire.ts';

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const X_IAB_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Twitter for iPhone/10.0';
const DEST = 'https://lite.tiktok.com/t/ZSabc123/';

// ---- クローラ判定 ----
assert.equal(isCrawlerUserAgent('Twitterbot/1.0'), true);
assert.equal(isCrawlerUserAgent('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'), true);
assert.equal(isCrawlerUserAgent('Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)'), true);
assert.equal(isCrawlerUserAgent(IPHONE_UA), false);
// X のアプリ内ブラウザは人間。クローラ扱いにしてしまうと直接発火が効かなくなる
assert.equal(isCrawlerUserAgent(X_IAB_UA), false);
assert.equal(isCrawlerUserAgent(null), false);

// ---- 転送先の検証 ----
assert.equal(directFireLocation(DEST), DEST);
assert.equal(directFireLocation('#'), null, "'#'(未設定) は転送しない");
assert.equal(directFireLocation(''), null);
assert.equal(directFireLocation('javascript:alert(1)'), null);
assert.equal(directFireLocation('snssdk473824://roma_redirect/'), null, 'カスタムスキームは 302 で送らない');
assert.equal(directFireLocation('https://user:pw@example.com/'), null);

// ---- 応答方針 ----
const off = { content_data: { tiktokUrl: DEST } };
const on = { content_data: { tiktokUrl: DEST, directFire: true } };
const legacy = { content_data: {} };

assert.deepEqual(decideDirectFire(off, IPHONE_UA, DEST), { kind: 'render', reason: 'disabled' }, '既定(オフ)は自分のページを表示');
assert.deepEqual(decideDirectFire(legacy, IPHONE_UA, DEST), { kind: 'render', reason: 'disabled' }, '既存データ(未設定)もオフ扱い');
assert.deepEqual(decideDirectFire(on, 'Twitterbot/1.0', DEST), { kind: 'render', reason: 'crawler' }, 'クローラには OGP 付き HTML');
assert.deepEqual(decideDirectFire(on, IPHONE_UA, '#'), { kind: 'render', reason: 'invalid-destination' }, '転送先が無ければ描画に戻す');
assert.deepEqual(decideDirectFire(on, IPHONE_UA, DEST), { kind: 'redirect', location: DEST });
assert.deepEqual(decideDirectFire(on, X_IAB_UA, DEST), { kind: 'redirect', location: DEST });
// 文字列 'true' などは有効にしない(JSONB の型ゆれ対策)
assert.equal(decideDirectFire({ content_data: { directFire: 'true' as unknown as boolean } }, IPHONE_UA, DEST).kind, 'render');

// ---- 302 レスポンス ----
const res = directFireRedirectResponse(DEST);
assert.equal(res.status, 302);
assert.equal(res.headers.get('Location'), DEST);
assert.equal(res.headers.get('Cache-Control'), 'no-store');

// ---- 配線の確認(公開ページ・編集画面・型) ----
const read = (file: string) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

const route = read('app/[slug]/route.ts');
assert.match(route, /decideDirectFire\(site, userAgent, destinationUrl\)/, '公開ページは抽選後の destinationUrl で判定する');
assert.ok(
  route.indexOf('resolveDestinationUrl(') < route.indexOf('decideDirectFire('),
  '直接発火の判定はサプライズ抽選・本人除外の後に行う'
);
assert.ok(
  route.indexOf('recordPageView(') < route.indexOf('decideDirectFire('),
  '302 で返す場合も PV を記録する'
);

const form = read('app/dashboard/dashboard-form.tsx');
assert.match(form, /data-id="directFireToggle"/, '編集画面にチェックボックスがある');
assert.match(form, /<label htmlFor="directFireToggle">直接発火<\/label>/, 'ラベルは「直接発火」');
assert.match(form, /directFire: directFireToggle\.checked,\s*\n\s*images: \{/, '保存時に content_data.directFire へ入る');
assert.match(form, /directFireToggle\.checked = saved \? saved\.directFire === true : cd\.directFire === true/, '読込時は既定オフ');

const types = read('lib/types.ts');
assert.match(types, /directFire\?: boolean;/);

const css = read('app/dashboard/editor.module.css');
assert.doesNotMatch(css, /\.previewCol:not\(\[data-mode="tiktok"\]\)[^\n]*\.directFireRow/, '直接発火の行は全モードで表示する');

console.log('✅ direct-fire checks passed');
