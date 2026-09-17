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

/** 公式LPのHTMLから universal-data JSONを読み出す。 */
export function extractUniversalData(html: string): JsonRecord | null {
  const match = html.match(/<script\b(?=[^>]*\bid\s*=\s*["']universal-data["'])[^>]*>([\s\S]*?)<\/script\s*>/i);
  if (!match) return null;
  try {
    return record(JSON.parse(match[1]));
  } catch {
    return null;
  }
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

  const shareRoot = record(data['tiktok.ug_incentive.client_api/tiktok/incentive/v1/coin/share_page']);
  const shareResponse = record(shareRoot?.data);
  const sharePayload = record(shareResponse?.data);
  const inviteCode = stringValue(sharePayload?.invite_code);
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

  const outer = new URL(LAUNCH_PATH, LAUNCH_ORIGIN);
  outer.searchParams.set('redirect_url', redirectUrl);
  outer.searchParams.set('short_dl', fallback.toString());
  outer.searchParams.set('decode_once', '1');
  const result = outer.toString();
  return validateOfficialLiteLaunchUrl(result) ? result : null;
}

/** HTMLを直接受け取る便利関数。 */
export function extractOfficialLiteLaunchUrl(html: string): string | null {
  const data = extractUniversalData(html);
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
  return !!wid && /^\d+$/.test(wid) && shortDl.searchParams.get('wid') === wid
    && !!shortDl.searchParams.get('pid') && !!shortDl.searchParams.get('af_adset');
}
