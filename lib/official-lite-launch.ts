/**
 * TikTok Lite の招待LPが、自身の「ダウンロード」ボタン用に生成する公式リンクを扱う。
 *
 * URLをこちらで推測して作るのではなく、LP内の universal-data にある公式設定だけを
 * 組み合わせる。既インストール時は redirect_url、新規インストール時は short_dl
 * (AppsFlyer OneLink) が使われ、どちらにも同じ招待コンテキストが残る。
 */

const LAUNCH_ORIGIN = 'https://app-va.tiktokv.com';
const LAUNCH_PATH = '/lite_redirect/';
const ONELINK_HOST = 'snssdk473824.onelink.me';
const ONELINK_PATH = '/4P4E';
const LITE_SCHEME = 'snssdk473824:';
const WRAPPER_NAME = 'wrapper_incentive_share_jump_to_roma';

/**
 * 招待コードが入るshare/page APIはTikTok側で世代更新される。
 * 2026-09-26に採取した実HTMLは v2/share/page、
 * それ以前に採取したHTMLは v1/coin/share_page だった。
 * 新しい方を優先しつつ旧形式も後方互換で読む。
 */
const SHARE_PAGE_KEYS = [
  'tiktok.ug_incentive.client_api/tiktok/incentive/v2/share/page',
  'tiktok.ug_incentive.client_api/tiktok/incentive/v1/coin/share_page',
] as const;

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseUrl(value: unknown): URL | null {
  if (typeof value !== 'string') return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isInviteLp(url: URL): boolean {
  return url.protocol === 'https:'
    && /(^|\.)tiktok\.com$/i.test(url.hostname)
    && /^\/ug\/incentive\/share\//i.test(url.pathname)
    && !!url.searchParams.get('u_code')
    && !!url.searchParams.get('share_page_data');
}

function appendRawParam(url: string, key: string, value: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

/** HTML属性は引用符付き・引用符なしの両方を許容する。data-id等とは区別する。 */
function htmlAttribute(tag: string, name: string): string | null {
  const attributes = /\s+([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const match of tag.matchAll(attributes)) {
    if (match[1].toLowerCase() === name) return match[2] ?? match[3] ?? match[4] ?? '';
  }
  return null;
}

/** hrefのHTMLエンティティだけを復元し、URLのエンコードやパラメータ順は保持する。 */
function decodeHtmlAttribute(value: string): string {
  return value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[0-9a-f]+);/gi, entity => {
    const named: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' };
    if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
    const hex = entity[2].toLowerCase() === 'x';
    const code = Number.parseInt(entity.slice(hex ? 3 : 2, -1), hex ? 16 : 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  });
}

/** 公式LPのHTMLから universal-data JSONを読み出す。 */
export function extractUniversalData(html: string): JsonRecord | null {
  for (const match of html.matchAll(/(<script\b[^>]*>)([\s\S]*?)<\/script\s*>/gi)) {
    if (htmlAttribute(match[1], 'id') !== 'universal-data') continue;
    try {
      return record(JSON.parse(match[2]));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * universal-dataから、TikTok公式LPと同じ lite_redirect URLを生成する。
 * 必須値やホストが1つでも異なる場合はnullを返し、壊れた招待リンクを公開しない。
 */
export function buildOfficialLiteLaunchUrl(data: JsonRecord): string | null {
  const appContext = record(data.app_context);
  const href = parseUrl(appContext?.href);
  const query = record(appContext?.query);
  const wid = stringValue(appContext?.wid);
  if (!href || !isInviteLp(href) || !query || !wid || !/^\d+$/.test(wid)) return null;

  // app_context.query と実際のLP URLが同じ招待を指していることを確認する。
  for (const key of ['u_code', 'share_page_data']) {
    const fromQuery = stringValue(query[key]);
    if (!fromQuery || fromQuery !== href.searchParams.get(key)) return null;
  }

  const strategyRoot = record(data['tiktok.share.api/tiktok/linker/component/strategy/get/v1/']);
  const strategyData = record(strategyRoot?.data);
  const strategy = record(strategyData?.strategy);
  const wrappers = Array.isArray(strategy?.wrappers) ? strategy.wrappers : [];
  const wrapper = wrappers.map(record).find(item => item?.name === WRAPPER_NAME);
  const wrapperUrl = record(wrapper?.wrapper_url);
  const fallbackTemplate = stringValue(wrapperUrl?.url_fallback);
  const schemes = Array.isArray(wrapperUrl?.url_schemes) ? wrapperUrl.url_schemes : [];
  const schemeTemplate = schemes.map(stringValue).find(Boolean) || null;
  if (!fallbackTemplate || !schemeTemplate || wrapper?.launch_type !== 'tiktok_lite_app') return null;

  const target = parseUrl(stringValue(query.inc_target_url));
  const sparkPage = target?.searchParams.get('spark_page');
  if (!sparkPage) return null;

  const schemaBase = schemeTemplate.replaceAll('{{url}}', encodeURIComponent(sparkPage));
  const schemaUrl = parseUrl(schemaBase);
  if (!schemaUrl || schemaUrl.protocol !== LITE_SCHEME || schemaUrl.hostname !== 'roma_redirect') return null;
  const nestedInvite = parseUrl(schemaUrl.searchParams.get('params_url'));
  if (!nestedInvite || !isInviteLp(nestedInvite)) return null;
  if (nestedInvite.searchParams.get('u_code') !== href.searchParams.get('u_code')) return null;
  if (nestedInvite.searchParams.get('share_page_data') !== href.searchParams.get('share_page_data')) return null;

  const redirectParams: Array<[string, string]> = [
    ['needlaunchlog', '1'], ['ug_medium', 'fe_component'], ['wid', wid],
    ['disable_ttnet_proxy', '0'], ['use_mutable_context', '1'], ['_pia_', '1'],
    ['use_spark', '1'], ['__status_bar', 'true'], ['hide_nav_bar', '1'],
    ['should_full_screen', '1'], ['sharer_biz', 'ug_paid_acquisition'],
    ['bdhm_bid', 'incentive_campaign_hybrid'],
    ['inc_pid', stringValue(query.inc_pid) || ''],
    ['ug_launch_category', stringValue(query.ug_launch_category) || ''],
    ['media_source', stringValue(query.media_source) || ''],
    ['u_code', stringValue(query.u_code) || ''],
    ['gd_label', stringValue(query.gd_label) || ''],
    ['incentive_redirect', '1'],
    ['share_enter_from', stringValue(query.share_enter_from) || ''],
    ['utm_source', stringValue(query.utm_source) || ''],
    ['enter_from', 'share_scan_code'],
    ['share_page_data', stringValue(query.share_page_data) || ''],
    ['share_page_type', ''], ['campaign', ''],
    ['share_type', stringValue(query.share_type) || ''],
    ['share_position', stringValue(query.share_position) || ''],
    ['gameplay', stringValue(query.gameplay) || ''], ['invite_code', ''],
  ];
  let redirectUrl = schemaBase;
  for (const [key, value] of redirectParams) redirectUrl = appendRawParam(redirectUrl, key, value);

  const fallback = parseUrl(fallbackTemplate.replaceAll('{{schema}}', ''));
  if (!fallback || fallback.protocol !== 'https:' || fallback.hostname !== ONELINK_HOST || fallback.pathname !== ONELINK_PATH) return null;

  let inviteCode: string | null = null;
  for (const key of SHARE_PAGE_KEYS) {
    const shareRoot = record(data[key]);
    const shareResponse = record(shareRoot?.data);
    const sharePayload = record(shareResponse?.data);
    inviteCode = stringValue(sharePayload?.invite_code);
    if (inviteCode) break;
  }
  if (!inviteCode) return null;

  fallback.searchParams.set('pid', stringValue(query.inc_pid) || stringValue(query.media_source) || '');
  fallback.searchParams.set('wid', wid);
  fallback.searchParams.set('c', 'UG_Referral_JP');
  fallback.searchParams.set('is_retargeting', 'true');
  fallback.searchParams.set('af_web_dp', 'https://www.tiktok.com');
  fallback.searchParams.set('af_android_store_csl', 't');
  fallback.searchParams.set('incentive_redirect', '1');
  fallback.searchParams.set('ug_launch_category', stringValue(query.ug_launch_category) || '');
  fallback.searchParams.set('media_source', stringValue(query.media_source) || '');
  fallback.searchParams.set('af_adset', inviteCode);
  fallback.searchParams.set('gd_label', stringValue(query.gd_label) || '');
  fallback.searchParams.set('af_c_id', '');
  fallback.searchParams.set('af_adset_id', '');

  // TikTokの実HTMLは外側lite_redirectもencodeURIComponent相当で組み立てている。
  // URLSearchParamsで再シリアライズすると、nested params_url内の「~」が「%7E」に
  // 変わるなどバイト表現だけがずれる。意味は同じでも、公式hrefを可能な限り
  // 1バイト単位で再現するため外側もraw appendで組み立てる。
  let result = new URL(LAUNCH_PATH, LAUNCH_ORIGIN).toString();
  result = appendRawParam(result, 'redirect_url', redirectUrl);
  result = appendRawParam(result, 'short_dl', fallback.toString());
  result = appendRawParam(result, 'decode_once', '1');
  return validateOfficialLiteLaunchUrl(result) ? result : null;
}

/** HTMLを直接受け取る便利関数。 */
export function extractOfficialLiteLaunchUrl(html: string): string | null {
  const data = extractUniversalData(html);
  // SSR済みの公式ボタンがある場合は、TikTok自身が生成したURLをそのまま採用する。
  // スクリプト文字列やコメント内の疑似リンクは対象外。
  const markup = html.replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
  for (const match of markup.matchAll(/<a\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi)) {
    const href = htmlAttribute(match[0], 'href');
    if (!href) continue;
    const candidate = decodeHtmlAttribute(href);
    if (!validateOfficialLiteLaunchUrl(candidate)) continue;
    const query = record(record(data?.app_context)?.query);
    if (query) {
      const redirect = new URL(new URL(candidate).searchParams.get('redirect_url')!);
      if (['u_code', 'share_page_data'].some(key => query[key] !== redirect.searchParams.get(key))) continue;
    }
    return candidate;
  }
  return data ? buildOfficialLiteLaunchUrl(data) : null;
}

/** 保存済みURLを再保存する際にも使う、公式 lite_redirect の厳格な検証。 */
export function validateOfficialLiteLaunchUrl(raw: string): boolean {
  const outer = parseUrl(raw);
  if (!outer || outer.protocol !== 'https:' || outer.origin !== LAUNCH_ORIGIN
    || outer.pathname !== LAUNCH_PATH || outer.searchParams.get('decode_once') !== '1'
    || outer.username || outer.password || outer.port) return false;

  const redirect = parseUrl(outer.searchParams.get('redirect_url'));
  const shortDl = parseUrl(outer.searchParams.get('short_dl'));
  if (!redirect || redirect.protocol !== LITE_SCHEME || redirect.hostname !== 'roma_redirect') return false;
  if (!shortDl || shortDl.protocol !== 'https:' || shortDl.hostname !== ONELINK_HOST
    || shortDl.pathname !== ONELINK_PATH || shortDl.username || shortDl.password || shortDl.port) return false;

  const invite = parseUrl(redirect.searchParams.get('params_url'));
  if (!invite || !isInviteLp(invite)) return false;
  if (!redirect.searchParams.get('u_code') || redirect.searchParams.get('u_code') !== invite.searchParams.get('u_code')) return false;
  if (!redirect.searchParams.get('share_page_data') || redirect.searchParams.get('share_page_data') !== invite.searchParams.get('share_page_data')) return false;
  const wid = redirect.searchParams.get('wid');
  if (!wid || !/^\d+$/.test(wid) || shortDl.searchParams.get('wid') !== wid) return false;

  // 添付された実HTMLでは、未インストール時のOneLinkも同じ紹介文脈を持つ。
  // widだけでなく pid/media_source までredirect_url側と一致することを確認し、
  // 別キャンペーンのOneLinkを誤って採用しない。
  const redirectPid = redirect.searchParams.get('inc_pid') || redirect.searchParams.get('media_source');
  const redirectMediaSource = redirect.searchParams.get('media_source');
  if (!redirectPid || shortDl.searchParams.get('pid') !== redirectPid) return false;
  if (redirectMediaSource && shortDl.searchParams.get('media_source') !== redirectMediaSource) return false;

  return !!shortDl.searchParams.get('af_adset');
}
