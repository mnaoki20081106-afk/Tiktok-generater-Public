/**
 * カスタムURLジェネレーターのコアロジック。
 *
 * 単独版 `index.html` の <script> から、抽出・整形処理をそのまま移植したもの。
 * デバッグ済みの挙動を変えないため、Fetch処理・URLオブジェクトの再構築・
 * DEEPLINK_PARAMS によるサニタイズは元コードと同一のまま(コメントも含めて)保持している。
 *
 * DOMに一切触れないので、クライアントコンポーネントからそのまま呼び出せる。
 * UI(React)側との唯一の違いは、元コードが `$('id').value` で直接読んでいた入力値を
 * 引数で受け取る形にしてある点だけ。
 */

export const BTN_LABEL = 'URLを抽出＆自動生成';

/** Stealth APIのホスト。環境変数で差し替えられるようにしてあるが、既定値は単独版と同一。 */
export const API_HOST =
  process.env.NEXT_PUBLIC_STEALTH_API_HOST || 'https://apiforurlgenerater-oxsh2xkm7a-an.a.run.app';

export const TIMEOUT_MS = 60000; // Cloud Run のコールドスタート対策
export const PROBE_MS = 8000; // 原因切り分けプローブのタイムアウト
export const MIN_BUSY_MS = 400; // 「抽出中...」を必ず目視できるようにする最低表示時間

/** フォームの初期値(単独版のvalue属性と同じ) */
export const DEFAULT_IOS_URL = 'https://apps.apple.com/jp/app/tiktok-lite/id6447160980';
export const DEFAULT_ANDROID_URL = 'https://play.google.com/store/apps/details?id=com.zhiliaoapp.musically.go';
/** PC向け遷移先は用途がケースバイケースなので既定値は空(=af_web_dp を付けない)にしておく */
export const DEFAULT_WEB_DP_URL = '';

/* TikTok Lite の OneLink とカスタムスキーム。実物の招待LPのHTMLから確認したもの。

   招待リンクが載っている snssdk1180.onelink.me は「通常版TikTok」のOneLinkドメインで、
   iOSのUniversal Link / AndroidのApp Link として通常版アプリに関連付けられている。
   通常版がインストールされた端末では、OSがWebページを読み込む前にURLを横取りして
   通常版を起動してしまう。af_dp などのクエリパラメータは評価すらされないため、
   パラメータ側では防ぎようがない。ホストごとLite側へ載せ替えるしかない。

   4P4E は TikTok自身が Lite の紹介キャンペーンで使っているOneLinkで、
   pid/c も招待リンクと同じ(coin_referral_onelink_scan_code_support_mentor /
   UG_Referral_JP)であることを確認済み。 */
export const LITE_ONELINK_ORIGIN = 'https://snssdk473824.onelink.me';
export const LITE_ONELINK_PATH = '/4P4E';
/* ラッパーが af_dp と一緒に必ず載せている値。実物のLPのHTMLから採取。 */
export const WRAPPER_DOMAIN_SOURCE = 'tiktok';
/* TikTok Lite を開くためのディープリンク。
   実物の招待LPに埋まっている TikTok自身のスキーム(url_schemes)と同じ形にする。

     snssdk473824://roma_redirect/?params_url=<招待LPのURL>&spark_page=scan_code

   これは `wrapper_incentive_share_jump_to_roma` に対応する。テンプレート上は
   `&spark_page={{url}}` というプレースホルダだが、埋まる値は招待LPが
   `inc_target_url`(`aweme://roma_redirect/?spark_page=scan_code`)として持っているものと
   同じなので、そこから読める(sparkPageOf)。**推測ではなくLP自身が答えを持っている。**

   一度 `wrapper_incentive_share_gift`(`snssdk473824://webview?params_url=<LP>&url=<gift_giving.html>?{{query}}`)
   に変えたことがあるが、実機でアプリ内に「不明なエラーが発生しました」が出て止まった。
   こちらの `{{query}}` は**LPのどこにも解決済みの実例が無く**、招待LPのクエリを
   そのまま入れるというのはこちらの推測だった。加えて `url=` はパーセントエンコード
   されない生の値なので、そこに `&` を含むクエリを入れると、以降がすべて
   スキーム側のトップレベルのパラメータとして解釈されて構造が壊れる。
   根拠の無い置き換えだったので撤回した。 */
export const LITE_DEEPLINK_BASE = 'snssdk473824://roma_redirect/';

/* 判定に使うスキームの候補。過去の形式で保存されたURLも「ラッパー形式」として
   認識し、再保存で今の形へ復旧できるようにするため全部を見る。 */
export const LITE_DEEPLINK_BASES = [LITE_DEEPLINK_BASE, 'snssdk473824://webview'];

/* params_url が指す招待LPのURL。実物のHTMLから採取したもの。
   キャンペーンが変わるとパスも変わりうるため、定数として切り出しておく。 */
export const INVITE_LP_URL = 'https://www.tiktok.com/ug/incentive/share/pro_scan_code';

/* ===================== 実測で判明した、公式リンクの実体 =====================

   公式の招待リンク `https://lite.tiktok.com/t/XXXXXXXX/` を iOS Safari の
   アドレスバーに貼って展開すると、着地するのは onelink.me ではなく招待LPそのものだった。

     https://www.tiktok.com/ug/incentive/share/pro_scan_code?...&u_code=...

   このURLには af_dp / af_ios_url / af_force_deeplink / wid / pid といった
   AppsFlyer用のキーが1つも無い。代わりに入っているのが次の3つで、
   これが「アプリを開く／ストアへ送る」を決めている仕組みそのものだった。

     inc_target_url = aweme://roma_redirect/?spark_page=scan_code
     incentive_redirect = 1
     is_inc_roma = 1

   つまり分岐を担っているのは AppsFlyer ではなく LP 側のJSである。
   universal-data から拾える onelink(BAuo)は、LPが内部に持っている
   「他人に共有するための」リンクであって、公式リンクの実体ではなかった。

   ここを取り違えていたために、次が同時に起きていた。
     - 通常版TikTokのOneLink(BAuo)を土台にしてしまい、Universal Linkで通常版が起動する
     - 4P4Eへ載せ替えても wid / c はショートリンク側のサーバー設定にあるため再現できない
     - LPがアプリを開くための仕掛けである inc_target_url / incentive_redirect /
       is_inc_roma を、DEEPLINK_PARAMS として削除していた
   「onelink.me で止まり『TikTok Liteを開く』ボタンが出る」症状の原因はこれ。

   対策は「組み立て直さない」こと。TikTok自身が配っているURLと同じものを遷移先にする。

   一度はここから更に「描画用パラメータを落とす」「inc_target_url のスキームを
   Lite へ差し替える」という改変を加えたが、これが実機で
   「アプリが起動せず、ただ招待LPがブラウザで開くだけ」を引き起こした。
   公式リンクとの差分が11箇所あった。どちらも推測に基づく改変で検証していなかった。
   現在は招待LPのURLを一切改変しない(buildLpUrl のコメントを参照)。
   ========================================================================== */
export const INVITE_LP_HOST_RE = /(^|\.)tiktok\.com$/i;
export const INVITE_LP_PATH_RE = /^\/ug\//i;

/**
 * 招待LPのURL(＝公式の招待リンクが実際に着地する形)かどうか。
 *
 * ホストとパスだけでは `www.tiktok.com/@user` のような通常のページと区別できないため、
 * 招待の宛先そのものである `u_code` があることまで確認する。
 */
export function isInviteLpUrl(url: URL): boolean {
  return (
    INVITE_LP_HOST_RE.test(url.hostname) &&
    INVITE_LP_PATH_RE.test(url.pathname) &&
    url.searchParams.has('u_code')
  );
}

/* ========== 実機で否定された案: OneLinkラッパー(4P4E)で包む ==========

   招待LPのHTMLには、TikTok自身がアプリを開くために使っている設定が埋まっている
   (`tiktok.share.api/tiktok/linker/component/strategy/get/v1/`)。18個ある wrapper はどれも

     "launch_type": "tiktok_lite_app",
     "wrapper_url": {
       "url_fallback": "https://snssdk473824.onelink.me/4P4E?domain_source=tiktok&af_dp={{schema}}",
       "url_schemes": ["snssdk473824://roma_redirect/?params_url=<招待LPのURL+全36キー>&spark_page={{url}}"]
     }

   という形をしている。ここから「Lite の OneLink(4P4E) + af_dp=<ディープリンク>」を
   組み立てれば1タップでアプリが開く、と考えて一度そう実装した。

   **実機で、アプリは起動するがアトリビューションが切れることが判明した。** 差し戻し済み。
   原因は2つあり、どちらも単独で致命的:

   1. 三重エンコードで share_page_data が壊れる。
      share_page_data は `+` と `%2F` を含む500文字のBase64。ラッパーにすると
        LP のクエリ(`+`) → params_url(`%2B`) → af_dp(`%252B`)
      と3層になる。AppsFlyerのクリックサーバ・SDK・アプリ側の roma_redirect ハンドラが
      それぞれ「ちょうど1回ずつ」デコードして初めて元に戻る。1箇所でも `+` を
      空白として扱えば(フォームエンコードの慣習では正しい挙動)Base64が壊れ、
      アプリは招待者を特定できない。招待LPのURLを直接渡せば `+` は1層のままで、
      この危険は存在しない。

   2. AppsFlyerのクリックが招待者に紐づかない。
      `4P4E` を素で叩くとクリックはテンプレート既定の文脈で記録される。招待者を指す
      `wid` / `c` はショートリンク側のサーバー設定にあり、こちらでは再現できない
      (assertOneLink のコメント参照)。TikTok自身の url_fallback が機能するのは、
      彼らのリンクサービスが `{{schema}}` 以外もサーバー側で埋めているため。

   教訓は前回と同じで、より厳しい形で出た。**招待LPのURLを入れ物ごと替えない。**
   このURLは単なるWebページではなく、TikTokの関連ドメイン上にあるHTTPSリンクであり、
   タップすればそれ自体が Universal Link として発火する。しかも招待の文脈
   (u_code / share_page_data / 描画用パラメータ)を素のクエリとして持っているので、
   エンコード層が1つも増えない。**遷移先はこれ以上に良い形にならない。**

   ラッパーを組み立てるコードは削除したが、`isLiteWrapperUrl()` /
   `wrapperPayloadUrl()` は残してある。この実装で保存されてしまったURLをDBから
   見つけ出し、中の params_url を取り出して招待LPのURLへ戻すために使う。
   ==================================================================== */

/** どの経路で組み立てたか */
export type BuildMode = 'lp' | 'onelink';
/**
 * 保存済みURLの形から後追いで判定した結果。
 * `wrapper` は撤回済みの形式で、見つけたら再保存を促すためだけに存在する。
 */
export type DetectedBuildMode = BuildMode | 'wrapper' | 'unknown';

/* かつて `buildLiteWrapperUrl()` がここにあり、OneLink のラッパーを組み立てていた。
   実機でトラッキングが消えるため撤去した(理由は buildLpUrl のコメントを参照)。
   ラッパー形式で保存済みのURLを見つけて招待LPのURLへ戻すために、
   判定(`isLiteWrapperUrl`)と取り出し(`wrapperPayloadUrl` / `unwrapLiteWrapperUrl`)だけを残す。 */

/**
 * ラッパーURLから、アプリへ直接渡すカスタムスキーム(`af_dp` の値)を取り出す。
 *
 * アプリ内ブラウザ(X など)では、この文字列をそのまま <a href> に入れる。
 * 利用者のタップで WKWebView がOSへ渡し、アプリが**直接**受け取る。
 * AppsFlyer のクリックサーバを経由しないぶん、招待の文脈が途中で解釈し直されない。
 * 通常のブラウザでは使わない(OSの確認ダイアログが出るため)。
 */
export function schemeFromWrapperUrl(rawUrl: string): string | null {
  const url = parseHttpUrl(rawUrl);
  if (!url) return null;

  const deepLink = url.searchParams.get('af_dp') || '';
  return LITE_DEEPLINK_BASES.some((b) => deepLink.startsWith(b)) ? deepLink : null;
}

/**
 * ラッパーURLの `af_dp` から、中に包まれている招待LPのURL(params_url)を取り出す。
 *
 * 撤回済みのラッパー形式で保存されてしまったURLを、招待LPのURLへ戻すために使う。
 */
export function wrapperPayloadUrl(rawUrl: string): URL | null {
  const url = parseHttpUrl(rawUrl);
  if (!url) return null;

  const deepLink = url.searchParams.get('af_dp') || '';
  const marker = '?params_url=';
  const at = deepLink.indexOf(marker);
  if (at < 0) return null;

  /* params_url の後ろには兄弟キー(spark_page)が続く。`&` の手前で切らないと
     それまで招待LPのURLの一部として取り込んでしまう。
     URLSearchParams を使わないのは、値に含まれうる `+` を空白に変換されないため。 */
  let raw = deepLink.slice(at + marker.length);
  const amp = raw.indexOf('&');
  if (amp >= 0) raw = raw.slice(0, amp);

  try {
    return parseHttpUrl(decodeURIComponent(raw));
  } catch {
    return null;
  }
}

/**
 * 撤回済みのラッパー形式のURLか。
 *
 * OneLink再構築(フォールバック)も同じホストの `4P4E` を返すのでホストだけでは
 * 区別できない。ラッパーは外側に `domain_source` と `af_dp` しか持たない
 * (フォールバックは `af_ios_url` などを外側に並べる)ので、そこで見分ける。
 */
export function isLiteWrapperUrl(url: URL): boolean {
  if (url.origin !== LITE_ONELINK_ORIGIN || url.pathname !== LITE_ONELINK_PATH) return false;

  const keys = Array.from(url.searchParams.keys()).sort();
  if (keys.length !== 2 || keys[0] !== 'af_dp' || keys[1] !== 'domain_source') return false;

  const payload = wrapperPayloadUrl(url.toString());
  return !!payload && payload.searchParams.has('u_code');
}

/**
 * ラッパー形式のURLを、招待LPのURLへ戻す。
 *
 * `params_url` に、過去の実装が足していたキー(`LEGACY_INJECTED_PARAMS`)が
 * 混ざっている場合は取り除く。描画用パラメータ(`__status_bar` など)は**落とさない**。
 * こちらは招待LPが元から持っているクエリで、アプリ内で招待ページを描画するのに要る。
 */
export function unwrapLiteWrapperUrl(url: URL): URL | null {
  const payload = wrapperPayloadUrl(url.toString());
  if (!payload) return null;

  /* `searchParams` を触ると、変更が無くてもクエリ全体が再シリアライズされて
     パーセントエンコードの形が変わる(`+` が `%2B` になるなど)。招待LPのURLは
     1バイトも変えたくないので、直すものが実際にあるときだけ触る。 */
  const legacy = LEGACY_INJECTED_PARAMS.filter((k) => payload.searchParams.has(k));

  /* 古い実装は inc_target_url のスキームを Lite へ差し替えていた。TikTok は書き換えないので、
     Lite のスキームが入っていればこちらが付けた跡。元(aweme://)へ戻す。 */
  const target = payload.searchParams.get('inc_target_url') || '';
  const forced = target.toLowerCase().startsWith(LITE_SCHEME);

  if (legacy.length === 0 && !forced) return payload;

  for (const key of legacy) payload.searchParams.delete(key);
  if (forced) {
    payload.searchParams.set('inc_target_url', REGULAR_TIKTOK_SCHEMES[0] + target.slice(LITE_SCHEME.length));
  }

  return payload;
}

/**
 * 保存済みのURLが、どちらの形式で生成されたものかを見分ける。
 *
 * `BuildResult.mode` は生成した瞬間にしか手に入らないが、DBに入っている値についても
 * 「招待LP直結なのか、フォールバックなのか、撤回済みのラッパー形式のまま残っているのか」を
 * 後から知りたい場面がある(管理画面で当たりURLの状態を表示するなど)。
 * URLの形だけで判定できるので切り出しておく。
 */
export function detectBuildMode(rawUrl: string | null | undefined): DetectedBuildMode {
  const url = parseHttpUrl(rawUrl);
  if (!url) return 'unknown';
  if (isLiteWrapperUrl(url)) return 'wrapper';
  if (isInviteLpUrl(url)) return 'lp';
  if (ONELINK_RE.test(url.hostname)) return 'onelink';
  return 'unknown';
}

/* LPの inc_target_url が指しているのは通常版TikTokのスキーム(aweme://)。
   通常版がインストールされた端末ではそちらが起動してしまう。
   「誰の招待か」はLPのクエリ(u_code / share_page_data)が運んでいて
   inc_target_url のクエリには乗っていないので、スキーム部分だけを差し替えれば
   招待情報を保ったまま Lite を開かせられる。 */
export const LITE_SCHEME = 'snssdk473824://';
export const REGULAR_TIKTOK_SCHEMES = ['aweme://', 'snssdk1180://'];

/** カスタムスキームが通常版TikTokを指していれば、Lite のスキームへ差し替える */
export function toLiteScheme(deepLink: string): string {
  const lower = deepLink.toLowerCase();
  for (const scheme of REGULAR_TIKTOK_SCHEMES) {
    if (lower.startsWith(scheme)) return LITE_SCHEME + deepLink.slice(scheme.length);
  }
  return deepLink;
}

/* LPがアプリを開くために使うキー。削ると「アプリに飛ばずLPで止まる」ため絶対に残す。
   inc_target_url だけはスキームをLiteへ差し替えるが、キー自体は必ず残る。 */
export const INCENTIVE_PARAMS = ['inc_target_url', 'incentive_redirect', 'is_inc_roma'];

/* こちらが管理するAppsFlyer用のキー。OneLinkのWeb遷移を制御するためのもので、
   アプリ内へ渡す params_url には載せない。 */
export const MANAGED_PARAMS = [
  'af_ios_url',
  'af_ipad_url',
  'af_ios_fallback',
  'af_android_url',
  'af_android_fallback',
  'fallback_url',
  'af_web_dp',
  'af_dp',
];

/* かつて params_url へ足していたキー。**今は1つも足さない。**

   「TikTok自身が載せている固定値」だと考えて補完していたが、実物のLPのHTMLにある
   TikTok自身のスキーム(url_schemes)と突き合わせたところ、params_url に載っているのは
   招待LPのクエリ36キーちょうどで、これらは1つも含まれていなかった。
   とくに spark_page は params_url の**中**ではなく**兄弟キー**として置くもので、
   場所を間違えたまま値も入れていた。実機で「アプリは起動するが招待ページが開かない」
   状態になった直接の原因がこれ。

   定義を残してあるのは、この実装で保存されてしまったURLから取り除くため
   (`unwrapLiteWrapperUrl()`)。新しく足すことは二度としない。 */
export const LEGACY_INJECTED_PARAMS = [
  'spark_page',
  'use_spark',
  'bdhm_bid',
  'needlaunchlog',
  'ug_medium',
  'disable_ttnet_proxy',
  'use_mutable_context',
  // ロングリンク化で補完していた。招待LPのクエリには元から無い
  'pid',
];

/* かつて params_url へ補完していた描画用パラメータ(__status_bar / _svg など)。
   これらは招待LPのクエリに**元から入っている**ので、LPのURLをそのまま params_url に
   載せる今の実装では補完する必要がない。定義ごと削除した。 */

/**
 * アプリへ渡すパラメータの元ネタを取り出す。
 *
 * 生成済みのURLをもう一度通すとき(サイトの再保存など)、OneLink側のクエリは
 * 既にサニタイズ済みで inc_target_url / is_inc_roma などが落ちている。
 * そのまま params_url を作り直すと、再保存のたびにアプリ用のデータが削れて
 * 「Liteは開くが誰の紹介か分からない」状態に戻ってしまう。
 *
 * 前回の af_dp の params_url には元のクエリが丸ごと残っているので、そちらを土台にし、
 * 現在のクエリを上書きで重ねる。初回生成(af_dp が無い)ならクエリをそのまま使う。
 */
export function recoverAppParams(source: URL): URLSearchParams {
  const afdp = source.searchParams.get('af_dp') || '';
  const marker = '?params_url=';
  const at = afdp.indexOf(marker);
  if (at < 0) return source.searchParams;

  try {
    const previous = new URL(decodeURIComponent(afdp.slice(at + marker.length)));
    const merged = previous.searchParams;
    source.searchParams.forEach((v, k) => {
      if (k === 'af_dp') return;
      merged.set(k, v);
    });
    return merged;
  } catch {
    return source.searchParams;
  }
}

/**
 * バラバラのクエリから、`params_url` に載せる招待LPのURLを組み立て直す。
 *
 * OneLink を土台にした従来経路(招待LPのURLが取れなかった場合)でしか使わない。
 * 招待LPのURLが手に入っているなら、組み立て直さずそのまま渡すこと。
 */
export function lpUrlFromParams(params: URLSearchParams, lpBase: string = INVITE_LP_URL): URL {
  const lp = new URL(lpBase);
  lp.search = '';

  params.forEach((v, k) => {
    if (k === 'is_retargeting') return;
    if (MANAGED_PARAMS.includes(k)) return;
    lp.searchParams.set(k, v);
  });

  return lp;
}

/**
 * TikTok Lite 向けのディープリンク(`af_dp` の値)を組み立てる。
 *
 *   snssdk473824://roma_redirect/?params_url=<招待LPのURL>&spark_page=scan_code
 *
 *  1. `params_url` は招待LPのURLを**そのまま**載せる。並び順もエンコードも変えない。
 *     TikTok の params_url に載っているのはLPのクエリ36キーちょうどで、
 *     `use_spark` / `bdhm_bid` / `pid` のような値は1つも入っていない。
 *  2. `spark_page` は `params_url` の**中ではなく兄弟キー**。値は `sparkPageOf()` が
 *     招待LPの `inc_target_url` から読む。
 *
 * 唯一 TikTok の文字列と違ってよいのが、`params_url` の中の `inc_target_url` の
 * スキーム(`buildLpUrl` の `forceLite`)。理由はそちらのコメントを参照。
 */
export function buildLiteDeepLink(lpUrl: URL): string {
  let deepLink = LITE_DEEPLINK_BASE + '?params_url=' + encodeURIComponent(lpUrl.toString());

  const sparkPage = sparkPageOf(lpUrl);
  if (sparkPage) deepLink += '&spark_page=' + encodeURIComponent(sparkPage);

  return deepLink;
}

/**
 * 招待LPの `inc_target_url` から `spark_page` を取り出す。
 *
 * `inc_target_url` は `aweme://roma_redirect/?spark_page=scan_code` の形で、
 * 「アプリ内でどのページを開くか」を指している。キャンペーンが変われば
 * `scan_code` 以外になりうるので、固定値にせず毎回ここから読む。
 */
export function sparkPageOf(lpUrl: URL): string | null {
  const target = lpUrl.searchParams.get('inc_target_url');
  if (!target) return null;

  const at = target.indexOf('?');
  if (at < 0) return null;

  return new URLSearchParams(target.slice(at + 1)).get('spark_page');
}

/** クッションページが遷移先を受け取るクエリキー。単独版と同じ `to`。 */
export const CUSHION_PARAM = 'to';

/** ネットワーク層(CORS/DNS/オフライン)で落ちたことを示すフラグ付きエラー */
export interface NetworkLevelError extends Error {
  networkLevel?: boolean;
}

export interface ExtractApiResponse {
  success: boolean;
  trackingUrl: string;
  /**
   * 短縮リンクが実際に着地した招待LPのURL(Stealth API が返してくれる場合)。
   * 公式リンクの実体そのものなので、取れているならこれが最優先。
   * API側が未対応でも `expandShortUrl()` が同じものを取りに行くので必須ではない。
   */
  lpUrl?: string;
  /**
   * TikTok自身が Lite 用に組み立てている OneLink(snssdk473824.onelink.me/4P4E)。
   * 招待LPのレンダリング済みDOMにあり、`wid`(招待者の識別子) / `c`(キャンペーン) /
   * `af_adset` と、`u_code` を含む af_dp を最初から持っている。
   * これらは shareOptions.onelink(BAuo)のクエリには存在せず、こちらで再構築できない。
   * Stealth API が返してくれる場合はそれをそのまま土台に使う(最も確実)。
   */
  liteUrl?: string;
  error?: string;
}

/**
 * 抽出結果のうち、リンク生成の土台に使うURLを選ぶ。
 *
 * 優先順位は「公式リンクの実体にどれだけ近いか」で決める。
 *  1. lpUrl    … 短縮リンクが着地した招待LPそのもの。公式リンクと同一
 *  2. liteUrl  … TikTok自身が組み立てた Lite のOneLink(wid などを持つ)
 *  3. trackingUrl … LPが内部に持っている共有用OneLink(通常版のBAuo。最後の手段)
 */
export function preferSourceUrl(data: ExtractApiResponse): string {
  const lp = parseHttpUrl(data.lpUrl);
  if (lp && isInviteLpUrl(lp)) return lp.toString();

  const lite = parseHttpUrl(data.liteUrl);
  if (lite && ONELINK_RE.test(lite.hostname)) return lite.toString();

  return data.trackingUrl;
}

export interface BuildOptions {
  iosUrl: string;
  androidUrl: string;
  /** PC(デスクトップ)から踏まれたときの遷移先。空なら af_web_dp を設定しない */
  webDpUrl: string;
  /**
   * 通常版TikTokではなく TikTok Lite を開かせるか。
   * - `lp` 方式 … `inc_target_url` のスキームだけを Lite に差し替える(他は公式のまま)
   * - `onelink` 方式 … ホストを Lite の OneLink へ載せ替え、af_dp も Lite で組み立てる
   */
  forceLite: boolean;
  /* is_retargeting はオプションごと廃止した。付与すると招待報酬が付かなくなる恐れがあり、
     残しておくと「うっかりONにする」事故が起きるため(buildUrl は常に除去する)。 */
  stripDeepLinks: boolean;
}

export interface BuildResult {
  /** サニタイズ・再構築を通過した最終的な直接遷移先URL */
  url: string;
  /** 除去したディープリンク系パラメータ名 */
  removed: string[];
  /**
   * どちらの経路で作ったか。
   * - `lp`      … 招待LPのURLをそのまま使う(推奨・既定)。ブラウザでLPが読み込まれ、
   *               そのJSが招待をバインドする。トラッキングが成立する唯一の形
   * - `onelink` … AppsFlyerのOneLinkを組み立て直す(LPのURLが取れなかった場合の従来経路)
   */
  mode: BuildMode;
  /**
   * `params_url` の中の `inc_target_url` のスキームを Lite へ差し替えたかどうか。
   * ここが TikTok の文字列との唯一の差分になるので、実機で挙動が変わったときに
   * 原因を1変数に絞れるよう結果に持たせる。
   */
  liteForced?: boolean;
}

export function parseHttpUrl(raw: unknown): URL | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u;
  } catch {
    /* noop */
  }
  return null;
}

/* APIをどこに投げるかを決める。
   server.js がこのページ自体を配信するので、静的ホスティングでない限り
   「今いるオリジン = API」とみなせる。相対パスならCORSが一切発生しない。

   判定を /healthz の疎通結果に依存させない。依存させると、APIの一部が
   不調なだけで同一オリジン配信まで巻き添えで壊れるため。 */
/* このページを配信しているオリジンがAPIも持っているか。
   APIはCloud Run上にしか無いので、Cloud Run（または同一ホスト、ローカル実行）から
   配信されている場合だけ同一オリジン扱いにする。
   GitHub Pagesなどの静的ホスティングは該当しないので絶対URLで呼ぶ。 */
export function sameOriginServesApi(): boolean {
  if (typeof window === 'undefined') return false;
  const loc = window.location;
  if (loc.protocol !== 'http:' && loc.protocol !== 'https:') return false; // file:// など
  if (loc.origin === API_HOST) return true;
  if (/\.run\.app$/i.test(loc.hostname)) return true; // Cloud Run
  if (loc.hostname === 'localhost' || loc.hostname === '127.0.0.1') return true; // ローカル実行
  return false;
}

export function resolveApiBase(): string {
  return sameOriginServesApi() ? '' : API_HOST;
}

/* ================== 自動抽出エンジン（自作Stealth API連携版） ================== */
export async function callExtractApi(shortUrl: string): Promise<ExtractApiResponse> {
  const url = resolveApiBase() + '/api/extract?url=' + encodeURIComponent(shortUrl);
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_MS) : null;

  let res: Response;
  try {
    res = await fetch(url, ctrl ? { signal: ctrl.signal } : undefined);
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('タイムアウト（' + Math.round(TIMEOUT_MS / 1000) + '秒）。APIが起動中か、応答がありません。');
    }
    // fetch が TypeError で落ちるのは CORS / DNS / オフライン / 混在コンテンツ。
    // Chrome は "Failed to fetch"、Safari は "Load failed" という文言になる。
    const err: NetworkLevelError = new Error(
      'APIに接続できませんでした。（' + (e instanceof Error ? e.message : String(e)) + '）'
    );
    err.networkLevel = true;
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }

  // res.ok を見ずに res.json() すると、HTMLのエラーページが返ったとき
  // 意味不明なパースエラーになるので、本文を読んでから判定する。
  const body = await res.text();
  let data: ExtractApiResponse | null = null;
  try {
    data = JSON.parse(body) as ExtractApiResponse;
  } catch {
    /* noop */
  }

  if (!res.ok) {
    throw new Error('APIがHTTP ' + res.status + ' を返しました。' + ((data && data.error) || body.slice(0, 200)));
  }
  if (!data) throw new Error('APIの応答がJSONではありません。' + body.slice(0, 200));
  if (!data.success) throw new Error(data.error || 'APIが success:false を返しました。');
  if (!data.trackingUrl) throw new Error('APIの応答に trackingUrl が含まれていません。');
  return data;
}

/* ================== 短縮リンクの展開 ==================

   公式の招待リンク `https://lite.tiktok.com/t/XXXX/` は、ただのリダイレクトで
   招待LPへ着地する(実測)。JSの実行もDOMの解析も要らないので、Puppeteer(Stealth API)を
   経由せずここで展開できる。Stealth API は universal-data から
   「共有用のOneLink」を取り出す実装のため、公式リンクの実体である
   LPのURLは返してくれない。この関数がそれを直接取りに行く。 */

/** 展開時に名乗るUA。端末別に遷移先が変わるため、iOSのSafariとして問い合わせる。 */
export const IOS_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

export const EXPAND_TIMEOUT_MS = 15000;
export const EXPAND_MAX_HOPS = 10;
export const EXPAND_ENDPOINT = '/api/expand';

/* 展開を許可するホスト。任意のURLを取りに行かせない(SSRF対策)。
   ブラウザから /api/expand 経由でも呼ばれるため、サーバー側でも同じ判定を通す。 */
export const EXPANDABLE_HOST_RE = /(^|\.)(tiktok\.com|tiktokv\.com|onelink\.me)$/i;

export function isExpandableUrl(url: URL): boolean {
  return url.protocol === 'https:' && EXPANDABLE_HOST_RE.test(url.hostname);
}

/**
 * リダイレクトを自前で追って、最終的なURLを返す(サーバー専用)。
 *
 * `redirect: 'follow'` に任せず1ホップずつ追うのは、
 *  - 許可ホストの外へ出る手前で止めるため
 *  - 着地先が招待LP(1.5MB近いHTML)でも本文を読まずに済ませるため
 * の2点による。
 */
export async function followRedirects(raw: string): Promise<string> {
  let current = parseHttpUrl(raw);
  if (!current) throw new Error('URLが不正です。');
  if (!isExpandableUrl(current)) throw new Error('展開の対象外のドメインです: ' + current.hostname);

  for (let hop = 0; hop < EXPAND_MAX_HOPS; hop++) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), EXPAND_TIMEOUT_MS) : null;

    let res: Response;
    try {
      res = await fetch(current.toString(), {
        method: 'GET',
        redirect: 'manual',
        headers: { 'user-agent': IOS_USER_AGENT, accept: 'text/html,application/xhtml+xml' },
        signal: ctrl ? ctrl.signal : undefined,
      });
    } finally {
      if (timer) clearTimeout(timer);
    }

    if (res.status < 300 || res.status >= 400) {
      // 着地。巨大なHTMLを読み込まずに捨てる
      await res.body?.cancel().catch(() => {});
      return current.toString();
    }

    const location = res.headers.get('location');
    await res.body?.cancel().catch(() => {});
    if (!location) return current.toString();

    const next = parseHttpUrl(new URL(location, current).toString());
    // 許可ホストの外(App Store など)へ出るなら、その手前を答えとする
    if (!next || !isExpandableUrl(next)) return current.toString();
    current = next;
  }

  return current.toString();
}

/**
 * 短縮リンクを展開する。ブラウザからは同一オリジンの `/api/expand` を経由する
 * (クロスオリジンのリダイレクトはブラウザからは追えないため)。
 * 失敗しても例外は投げず null を返す。呼び出し側は従来の抽出経路へフォールバックする。
 */
export async function expandShortUrl(raw: string): Promise<string | null> {
  const input = parseHttpUrl(raw);
  if (!input || !isExpandableUrl(input)) return null;

  try {
    if (typeof window === 'undefined') return await followRedirects(input.toString());

    const res = await fetch(EXPAND_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: input.toString() }),
    });
    const data = (await res.json().catch(() => null)) as { url?: unknown } | null;
    return typeof data?.url === 'string' ? data.url : null;
  } catch {
    return null;
  }
}

/* ネットワーク層で落ちたときに、原因を自動で切り分ける。
   no-cors プローブが通れば「サーバには届いているがCORSヘッダが無い」、
   通らなければ「そもそもサーバに届いていない」と判別できる。 */
export async function diagnose(): Promise<string[]> {
  const notes: string[] = [];

  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    notes.push(
      '・このページは file:// で開かれています。SafariやChromeは file:// からの外部API呼び出しを既定でブロックします。' +
        '最も確実なのは ' +
        API_HOST +
        '/ を直接開くことです（APIと同一オリジンになりCORSも不要）。'
    );
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    notes.push('・ブラウザがオフライン状態です。');
  }

  let reachable = false;
  try {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), PROBE_MS) : null;
    try {
      // ヘルスチェックを叩くだけ（Puppeteerを起動させない安いプローブ）
      await fetch(API_HOST + '/healthz', {
        mode: 'no-cors',
        cache: 'no-store',
        signal: ctrl ? ctrl.signal : undefined,
      });
      reachable = true;
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch {
    /* noop */
  }

  if (reachable) {
    notes.push(
      '・サーバへの到達は成功しました（no-corsプローブ）。つまり応答にCORSヘッダが付いていません。' +
        'これはExpressの cors() まで処理が届いていないことを意味します。次の順で確認してください:\n' +
        '  (1) ' +
        API_HOST +
        '/ をブラウザで直接開く。' +
        '「Sorry, this is just a placeholder…」が出るならビルド失敗でコードが未デプロイです。\n' +
        '  (2) 「Error: Forbidden」が出るなら Cloud Run の' +
        '「未認証の呼び出しを許可(allow-unauthenticated)」が無効です。\n' +
        '  (3) 「Service Unavailable」が出るならコンテナの起動失敗です（Chromeはメモリ1GiB以上が必要）。'
    );
  } else {
    notes.push(
      '・サーバへ到達できませんでした（no-corsプローブも失敗）。' +
        'APIのURL誤り / サービス停止・デプロイ失敗 / DNS / 拡張機能・コンテンツブロッカー のいずれかです。' +
        'ターミナルで curl -i "' +
        API_HOST +
        '/healthz" を実行すると切り分けられます。'
    );
  }
  return notes;
}

/* ================== ビルド機能 ================== */
/* 通常版TikTokの起動を誘発しうるパラメータ。
   af_dp だけは削除ではなく空文字で明示的に上書きする（既定値が復活するのを防ぐため）。 */
export const DEEPLINK_PARAMS = [
  'deep_link_value',
  'deep_link_sub1',
  'deep_link_sub2',
  'deep_link_sub3',
  'deep_link_sub4',
  'deep_link_sub5',
  'deep_link_sub6',
  'deep_link_sub7',
  'deep_link_sub8',
  'deep_link_sub9',
  'deep_link_sub10',
  'af_deeplink',
  'af_force_deeplink',
  'af_web_dp',
  'af_og_redirect',
  'fallback_url',
  'af_r',
  'redirect_url',
  'af_ios_fallback',
  'af_android_fallback',
  /* かつては inc_target_url / is_inc_roma / incentive_redirect もここに入れて削除していた。
     「残っていると aweme:// へ勝手に飛ばされる」という理由だったが、実測(Run A)で
     これらが“LPがアプリを開くための仕掛け”そのものだと判明したため削除をやめた。
     飛び先が通常版になる問題は、キーを消すのではなく toLiteScheme() で
     スキームだけをLiteへ差し替えることで解決する(INCENTIVE_PARAMS 参照)。 */
];

/* 成果計測に必要なパラメータ。実物の招待LPの universal-data
   (app_context.query の全36キー)を分類して同定したもの。
   紹介元の特定・アトリビューションに関わるため、絶対に落とさない。
   buildUrl の最後に assertTrackingPreserved() で欠損が無いことを検証する。 */
export const TRACKING_PARAMS = [
  'u_code',            // 招待コード本体
  'share_page_data',   // 暗号化された共有データ(496文字)
  'share_app_id',      // 473824 = TikTok Lite
  'share_link_id',
  'media_source',      // AppsFlyer の pid と同義
  'inc_pid',
  'gd_label',
  'utm_source',
  'utm_campaign',
  'ug_launch_category',
  'share_time',
  'sharer_biz',
  'share_position',
  'share_region',
  'share_scene',
  'share_type',
  'share_enter_from',
  'sharer_os',
  'aid',
  'region',
  '_d',
  // ロングリンク化のときに media_source から補完する。AppsFlyer の正準キー
  'pid',
];

/* TikTokのWebView描画用パラメータ。招待LPの表示制御にしか使われず、
   AppsFlyerのアトリビューションにも紹介元の特定にも関与しない。
   中間ページ(「TikTok-Global Video Community」等)の描画を誘発しうるため、
   最終リンクには残さない。実物の招待リンクには7つとも含まれていることを確認済み。 */
export const INTERSTITIAL_PARAMS = [
  '__status_bar',
  '_pia_',
  '_svg',
  'enable_canvas',
  'enable_canvas_optimize',
  'hide_nav_bar',
  'should_full_screen',
  /* 招待LPのOGPカードを描画するための文言・画像。LPの表示にしか使われず、
     アトリビューションには関与しない。og_image は133文字と長くURLを膨らませる。 */
  'og_desc_text',
  'og_image',
  'og_title_text',
];

export const ONELINK_RE = /(^|\.)onelink\.me$/i;

/**
 * 抽出結果が AppsFlyer の OneLink であることを確認する。違えば例外を投げて生成を止める。
 *
 * 以前はテンプレート(`https://snssdk1180.onelink.me/BAuo` 等)のドメイン＋パスに
 * 差し替えるフォールバックを持っていたが、廃止した。実物の招待リンクを解析したところ、
 * OneLink は `https://snssdk1180.onelink.me/BAuo/999140ec` のように
 * 「テンプレートID + ショートリンクID」の2セグメント構成で、後半はシェアごとに異なる。
 * さらに、このリンクのクエリには `pid` も `c` も無く、AppsFlyer側(ショートリンク)が
 * サーバー側に保持していると考えられる。
 *
 * つまりテンプレートへの差し替えは「他人のリンクに、別のショートリンクを当てる」処理であり、
 * pid/c を含むアトリビューション設定ごと失った不完全なリンクを生んでしまう。
 * 黙って壊れたリンクを配るより、生成を止めて作り直させるほうが安全。
 */
export function assertOneLink(url: URL): URL {
  if (ONELINK_RE.test(url.hostname)) return url;

  throw new Error(
    '抽出結果のドメインが ' +
      url.hostname +
      ' で、AppsFlyerのOneLink(*.onelink.me)ではありません。' +
      'この形式ではパラメータが無視されるうえ、pid や u_code などの成果計測IDを引き継げないため、' +
      '不完全なリンクを作らずに中断しました。' +
      '「URLを抽出＆自動生成」からやり直してください。' +
      'それでも直らない場合は、招待LPの構造が変わって抽出に失敗している可能性があります。'
  );
}

/**
 * ショートリンクIDをパスから外し、ロングリンクに戻す。
 * `/BAuo/999140ec` → `/BAuo`
 *
 * AppsFlyerのOneLinkは `/<テンプレートID>/<ショートリンクID>` の2セグメント構成で、
 * ショートリンク側はサーバー(AppsFlyer管理画面)に設定を持つ。その設定がクエリより
 * 優先されると、こちらが付けた af_ios_url / af_dp が無視される。ロングリンク化すると
 * サーバー設定を経由せず、クエリパラメータだけで挙動が決まる。
 *
 * ただしショートリンクが持っていた設定(pid 等)も同時に失われる。実物の招待リンクは
 * クエリに pid を持っておらず、AppsFlyerは pid の無いクリックを原則アトリビュートしない。
 * そこで pid が無い場合に限り、同じ値を指す media_source / inc_pid から補完する。
 * u_code・share_page_data などのトラッキング情報はクエリ側にあるため影響を受けない。
 */
export function toLongLink(url: URL): URL {
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length > 1) {
    url.pathname = '/' + segments[0];
  }

  // ショートリンク側が持っていたはずの pid を、同義のキーから補完する
  const params = url.searchParams;
  if (!params.has('pid')) {
    const mediaSource = params.get('media_source') || params.get('inc_pid');
    if (mediaSource) params.set('pid', mediaSource);
  }

  return url;
}

/**
 * 成果計測パラメータが1つも欠けていないことを検証する。
 *
 * サニタイズは削除リスト方式なので、リストを編集したときに計測用のキーを
 * 巻き込んでも気づけない。「100%保護」を願望ではなく保証にするため、
 * 生成の最後に入力と出力を突き合わせて、失われていれば例外で止める。
 * (値の一致まで見る。空文字への上書きなども検出する)
 */
export function assertTrackingPreserved(before: URL, after: URL): void {
  const lost: string[] = [];
  for (const key of TRACKING_PARAMS) {
    const original = before.searchParams.get(key);
    if (original === null) continue; // 元から無いものは対象外
    if (after.searchParams.get(key) !== original) lost.push(key);
  }
  if (lost.length > 0) {
    throw new Error(
      '成果計測パラメータが失われました: ' +
        lost.join(', ') +
        '。このまま公開すると誰の紹介か記録されないため、生成を中断しました。'
    );
  }
}

/**
 * LPがアプリを開くためのキーが残っていることを検証する。
 *
 * 値までは見ない。inc_target_url はスキームを差し替えるため値が変わるのが正常で、
 * ここで守りたいのは「キーごと消えていないこと」だから。
 */
export function assertIncentivePreserved(before: URL, after: URL): void {
  const lost = INCENTIVE_PARAMS.filter((k) => before.searchParams.has(k) && !after.searchParams.has(k));
  if (lost.length > 0) {
    throw new Error(
      'アプリを開くためのパラメータが失われました: ' +
        lost.join(', ') +
        '。このままだとLPで止まってアプリに遷移しないため、生成を中断しました。'
    );
  }
}

/**
 * 招待LPのURLを **そのまま** 遷移先にする(推奨経路)。
 *
 * ## これがアプリを開く経路として最良である理由
 *
 * 招待の文脈(u_code / share_page_data / 描画用パラメータ)を素のクエリとして持っているため、
 * アプリへ渡るまでに**エンコード層が1つも増えない**。X のアプリ内ブラウザでは、
 * このURLをタップするとアプリが起動して招待も成立することを実機で確認済み。
 *
 * 一度はこれを OneLink(4P4E)のラッパーで包んでみたが、実機で
 * 「アプリは起動するがアトリビューションが切れる」ことが判明して差し戻した。
 * 理由はファイル上部「実機で否定された案」を参照。
 *
 * **このURLは「配ればアプリが開くリンク」ではない。** LINE / Instagram などでは
 * 踏んでも招待LPがブラウザで開くだけになるが、**TikTok公式の招待リンクも同じ挙動**
 * であることを実機で対照確認してある。つまりURLの作りの問題ではなく、その環境では
 * TikTok自身も開けていない。アプリが開く可能性を作れるのは利用者のタップだけなので、
 * 配布用のリンクには必ず黒画面のタップ誘導(`lib/lite-launch.ts`)を経由させること。
 *
 * ## 一切改変しない
 *
 * 以前はここで
 *   - 描画用パラメータ(INTERSTITIAL_PARAMS)を10件ほど削除
 *   - inc_target_url のスキームを aweme:// から snssdk473824:// へ差し替え
 * を行っていた。どちらも「表示専用だから消してよい」「通常版が開くのを防げる」という
 * *推測* に基づくもので、実機で検証したことは一度も無かった。
 *
 * 結果として、公式の招待リンクとの差分が11箇所ある状態でURLを配っており、
 * 実機で「アプリが起動せず、ただ招待LPがブラウザで開くだけ」になっていた。
 * LP側のJSがアプリを開くかどうかを決めているので、そのJSが読む可能性のある
 * パラメータを消したり値を書き換えたりすれば、判断が変わっても不思議はない。
 *
 * この一件の教訓は一貫している。**TikTokが生成したURLを改変しない。**
 * ジェネレーターの価値は「短縮リンクを展開して、その実体を取り出すこと」にあり、
 * 中身をいじることでも、入れ物を替えることでもない(展開だけでも、短縮リンクが
 * 通常版TikTokの Universal Link に横取りされる問題は解消する)。
 *
 * したがってここで落とすのは、**こちらが過去に付けたキーだけ**にする。
 * 落とさなかったことは `assertOfficialParamsPreserved()` で機械的に検証する。
 */
export function buildLpUrl(source: URL, opts: BuildOptions): BuildResult {
  const url = new URL(source.toString());
  const params = url.searchParams;
  const removed: string[] = [];

  /* 落とすのは「こちらが付けたキー」だけ。生成済みURLをもう一度通したとき
     (サイトの再保存など)に、以前の実装が焼き付けた AppsFlyer 用のキーを掃除する。
     TikTokが出す招待LPのURLにこれらが載ることはないので、公式のURLには影響しない。 */
  [...MANAGED_PARAMS, 'is_retargeting'].forEach((k) => {
    if (params.has(k)) {
      removed.push(k);
      params.delete(k);
    }
  });

  /* ここだけが公式のURLと違ってよい唯一の点。
     公式の `inc_target_url` は通常版TikTokのスキーム(aweme://)を指しているため、
     通常版と Lite の両方が入った端末では通常版が開いてしまう。
     Lite を開かせたいので、スキーム部分だけを差し替える。
     「誰の招待か」は LP のクエリ(u_code / share_page_data)が運んでいて
     inc_target_url のクエリには乗っていないため、招待の成立には影響しない。

     パス・クエリには一切触らず、先頭のスキームだけを置換する(toLiteScheme)。
     以前は これと同時に描画用パラメータ10件も削除しており、まとめて戻したため
     どちらが原因か切り分けられなかった。今は差分をこの1点だけに限定してあるので、
     万一また挙動が変わったら原因はここだと確定できる。 */
  /* ===== TikTokの文字列と違ってよい、唯一の1点 =====

     `inc_target_url` は「アプリの中でどのページへ進むか」を指しており、公式の値は
     通常版TikTokのスキーム(`aweme://roma_redirect/?spark_page=scan_code`)。
     こちらが開かせたいのは Lite なので、**スキーム部分だけ**を差し替える。

     実機の履歴がこの1点を名指ししている。

       A) inc_target_url が Lite のスキーム … 「自身を招待できません」が出た
                                              (＝招待のバインド処理が走った)
       B) inc_target_url が aweme:// のまま … UIは完璧に描画されるがバインドは走らない

     Lite の中でLPのJSが `inc_target_url` / `is_inc_roma` / `incentive_redirect` を読んで
     招待の処理へ進む以上、その行き先が通常版TikTokを指していれば Lite 内では解決できず、
     処理そのものが始まらない。A と B の差はここだけだった
     (A のときは捏造キーが8個混ざっていて、そちらがUIを壊していた。今は入っていない)。

     パス・クエリには触らず、先頭のスキームだけを置換する。「誰の招待か」は
     LPのクエリ(u_code / share_page_data)が運んでいて inc_target_url には乗っていないので、
     招待の成立に必要な情報はここでは動かない。 */
  let liteForced = false;
  if (opts.forceLite) {
    const target = params.get('inc_target_url');
    if (target) {
      const lite = toLiteScheme(target);
      if (lite !== target) {
        params.set('inc_target_url', lite);
        liteForced = true;
      }
    }
  }

  assertTrackingPreserved(source, url);
  assertIncentivePreserved(source, url);
  assertOfficialParamsPreserved(source, url);

  /* ===== 遷移先は招待LPのURLそのもの =====

     一時期ここで OneLink のラッパー(`4P4E?domain_source=tiktok&af_dp=<スキーム>`)を
     被せていた。タップ1回でアプリが起動するという点では確かに優れていて、実機でも
     アプリの起動と招待ページの描画までは成立した。**しかし招待のトラッキングが消えた。**

     実機の観測を並べると理由がはっきりする。

       遷移先 = 招待LPのURL     → ブラウザでLPが読み込まれる → トラッキング成立
       遷移先 = OneLinkラッパー → LPを読み込まずアプリが直接開く → トラッキング消失
                                  (アプリ内に招待ページのUIは出る＝ u_code は届いている)

     **招待のバインドは「招待LPのページがブラウザで読み込まれ、そのJSが走ること」で成立する。**
     LPのクエリにある `incentive_redirect=1` / `is_inc_roma=1` / `inc_target_url` は、
     まさにそのページのJSが読むためのもの。ラッパーはそのページごと飛ばしてしまうので、
     ペイロードとして u_code が届いていてもバインドが起きない。

     af_dp の中身の構造を何度も作り直して確かめたが、どれも結果は変わらなかった。
     `roma_redirect`(TikTokの url_schemes と1バイト一致)、`webview` + `gift_giving.html`
     (アプリ内で「不明なエラー」)、`inc_target_url` を Lite のスキームに差し替えたもの
     ―― いずれもトラッキングは戻らなかった。問題はペイロードの中身ではなく、
     **LPのページを経由するかどうか**だった。

     したがって遷移先は招待LPのURLにする。アプリを開く役目はLP自身のJSに任せる
     (公式の招待リンクと同じ経路)。ワンクリックでアプリが開く形とトラッキングは
     両立しない、というのがここまでの実機の結論。 */
  const untouched = removed.length === 0 && !liteForced;
  return { url: untouched ? source.toString() : url.toString(), removed, mode: 'lp', liteForced };
}



/**
 * 招待LPのURLが持っていたパラメータが、1つも欠けず・書き換わっていないことを検証する。
 *
 * `assertTrackingPreserved()` は成果計測用の、`assertIncentivePreserved()` は
 * アプリ起動用のキーだけを見る。どちらのリストにも載っていないキー
 * (`__status_bar` や `_svg` などの描画用パラメータ＝ INTERSTITIAL_PARAMS)は
 * 素通りしてしまうが、これはアプリ内で招待ページを描画するのに要るもので、
 * 欠けると「アプリは起動するが招待ページが開かない」状態になる(実機で確認済み)。
 *
 * リストを増やし続けるのではなく、**入力に在ったキーは全部残っていること**を
 * 直接検証する。除外するのは、こちらが意図的に触る分だけ。
 */
export function assertOfficialParamsPreserved(before: URL, after: URL): void {
  const lost: string[] = [];

  before.searchParams.forEach((value, key) => {
    // こちらが付けたキー。落とすのが正しい
    if (MANAGED_PARAMS.includes(key) || key === 'is_retargeting') return;
    // スキームだけをLiteへ差し替えるので値は変わってよい。消えていないことだけ見る
    if (key === 'inc_target_url') {
      if (!after.searchParams.has(key)) lost.push(key);
      return;
    }
    if (after.searchParams.get(key) !== value) lost.push(key);
  });

  if (lost.length > 0) {
    throw new Error(
      '招待LPのパラメータが失われました: ' +
        lost.join(', ') +
        '。このまま公開すると、アプリが起動しても招待ページが正しく開かない可能性があるため、生成を中断しました。'
    );
  }
}

export function buildUrl(rawUrl: string, opts: BuildOptions): BuildResult {
  let url = parseHttpUrl(rawUrl);
  if (!url) throw new Error('トラッキング URL が不正です。');

  // 検証用に入力時点のパラメータを控えておく(以降 url は書き換わる)
  const source = new URL(url.toString());

  /* 撤回済みのラッパー形式(4P4E + af_dp)で保存されてしまったURLは、包み直すのではなく
     中の params_url を取り出して招待LPのURLへ戻す。この形式は実機でアトリビューションが
     切れることが判明しているので、再保存のたびに素の招待LPのURLへ復旧させる。 */
  /* 既にラッパーが被っているURLは、中の params_url を取り出して組み立て直す。
     古い実装が作ったものは params_url の構造が壊れている(捏造キーが混ざり、
     spark_page の位置も違う)ので、そのまま通さず作り直すことで復旧させる。 */
  if (isLiteWrapperUrl(url)) {
    const unwrapped = unwrapLiteWrapperUrl(url);
    if (unwrapped) return buildLpUrl(unwrapped, opts);
  }

  /* 招待LPのURLなら、OneLinkを組み立て直さずそのまま遷移先にする。
     公式リンクが着地するのはこの形だと実測で確認済み(ファイル冒頭のコメント参照)。 */
  if (isInviteLpUrl(url)) return buildLpUrl(source, opts);

  // OneLink でなければここで止まる
  url = assertOneLink(url);

  /* ショートリンクIDを外してロングリンク化する。
     サーバー側の設定より、こちらが付けたクエリパラメータを優先させるため。 */
  url = toLongLink(url);

  /* 通常版TikTokのOneLinkドメインは、そのアプリのUniversal Link/App Linkとして
     登録されている。通常版がインストールされた端末ではOSがURLを横取りして通常版を
     起動してしまうため、ホストとパスをLite側のOneLinkへ載せ替える。
     クエリ(u_code / share_page_data / media_source 等)はそのまま引き継ぐ。 */
  if (opts.forceLite && url.origin !== LITE_ONELINK_ORIGIN) {
    const lite = new URL(LITE_ONELINK_ORIGIN + LITE_ONELINK_PATH);
    url.searchParams.forEach((v, k) => lite.searchParams.set(k, v));
    url = lite;
  }

  const params = url.searchParams;

  // ディープリンク系を除去する。これをしないと deep_link_value 等が
  // af_dp の空文字より優先され、通常版が直接起動してしまう。
  const removed: string[] = [];
  if (opts.stripDeepLinks) {
    [...DEEPLINK_PARAMS, ...INTERSTITIAL_PARAMS].forEach((k) => {
      if (params.has(k)) {
        removed.push(k);
        params.delete(k);
      }
    });
  }

  /* is_retargeting は付与せず、逆に必ず除去する。
     AppsFlyerはこれが true だとクリックを「リターゲティング(再エンゲージメント)」として
     記録する。招待報酬は「新規インストール＋初回起動」で発火するのが前提なので、
     リターゲティング扱いになると発火条件を外れて報酬が付かない恐れがある。

     TikTok Liteの招待リンクにはそもそも is_retargeting が入っていない。
     削除しているのは、この対応より前に生成した(is_retargeting=true が焼き付いた)URLを
     再保存したときに確実に落とすため。除去はディープリンクのサニタイズとは別の目的なので、
     stripDeepLinks のON/OFFに関係なく常に実行する。

     af_dp を組み立てる前に実行する。後回しにすると、既存URLに焼き付いていた値が
     params_url の中へ取り込まれてアプリ側にまで渡ってしまうため。 */
  if (params.has('is_retargeting')) {
    removed.push('is_retargeting');
    params.delete('is_retargeting');
  }

  /* inc_target_url は削除せず、スキームだけをLiteへ差し替える。
     削除すると「アプリを開く仕掛け」ごと失われるため(INCENTIVE_PARAMS のコメント参照)。 */
  const incTarget = params.get('inc_target_url');
  if (opts.forceLite && incTarget) params.set('inc_target_url', toLiteScheme(incTarget));

  /* ===== 遷移先とフォールバック先を明示する =====
     フォールバック系は「削除するだけ」にしない。削除するとOneLinkテンプレート側
     (AppsFlyerのサーバー設定)の既定値が発動し、通常版TikTokのWebページへ落ちてしまう。
     上の除去ループで元の値を落としたうえで、ここでLite版のストアURLを明示的に入れ直す。

     いずれも「除去 → 設定」の順序が前提。DEEPLINK_PARAMS に含まれるキーでも、
     ここで設定した値が最終的に残る。 */

  const managed: Array<[string, string]> = [];

  if (opts.iosUrl) {
    managed.push(['af_ios_url', opts.iosUrl]);

    /* iPadOSのSafariは既定で「デスクトップ用サイトを要求」するため、UserAgentがmacOSと
       見分けがつかず、AppsFlyer側がiOS端末として扱ってくれない。その結果 af_ios_url が
       使われず、OneLinkの既定のWeb遷移先(サイトのトップページ)が開いてしまう。
       af_ipad_url を iOS向け遷移先と同じ値で明示しておくと、iPadと判定された場合でも
       同じストアページへ送れる。 */
    managed.push(['af_ipad_url', opts.iosUrl]);

    managed.push(['af_ios_fallback', opts.iosUrl]);
  }

  if (opts.androidUrl) {
    managed.push(['af_android_url', opts.androidUrl]);
    managed.push(['af_android_fallback', opts.androidUrl]);
  }

  /* 端末を判定できなかった場合の汎用フォールバック。
     iOS向けを既定にしている(Android端末がここに落ちるとApp Storeへ飛ぶことになるが、
     端末別の af_android_url / af_android_fallback が先に効くため通常は到達しない)。 */
  const genericFallback = opts.iosUrl || opts.androidUrl;
  if (genericFallback) managed.push(['fallback_url', genericFallback]);

  /* PC(デスクトップ)から踏まれた場合の遷移先。
     利用者が「af_web_dp(PC向け遷移先)」を入力していればそれを使い、
     空欄ならストアURLで埋める(空のままだとテンプレート側の既定値が発動するため)。 */
  const webDp = opts.webDpUrl || opts.iosUrl || opts.androidUrl;
  if (webDp) managed.push(['af_web_dp', webDp]);

  /* こちらが管理するキーは、いったん全部消してから決まった順に入れ直す。
     - 並び順を固定するため。これらは DEEPLINK_PARAMS に含まれるもの(af_web_dp 等)と
       含まれないもの(af_ios_url 等)が混在しており、消さずに set すると生成のたびに
       順序が変わって、同じURLを再保存したときに文字列が一致しなくなる。
     - af_dp を組み立てる前に消しておく必要もある。生成済みURLを再度通したときに、
       前回の af_dp や af_ios_url が params_url の中へ入れ子で取り込まれてしまうため。 */
  managed.forEach(([k]) => params.delete(k));
  params.delete('af_dp');

  /* af_dp はアプリを開くときのディープリンク。
     Lite の OneLink に載せ替えている場合は、TikTok自身と同じ形
     (snssdk473824://roma_redirect/?params_url=<LPのURL+識別子>)で組み立てる。
     スキームだけだとアプリが起動するだけで紹介元が伝わらない。
     載せ替えない場合は空文字にして、通常版が開くのをブロックする。

     params_url にはサニタイズ「前」の元のクエリを載せる(buildLiteDeepLink 参照)。
     inc_target_url などはWeb遷移では邪魔だが、アプリ内では招待インセンティブの
     識別子として必要なため。 */
  /* 元のリンクが既に「中身の詰まった」Liteディープリンクを持っているなら、
     こちらで組み立て直さずそのまま使う。TikTokが生成したものには wid など
     こちらでは再現できない値が入っているため、触らないのが最も確実。
     中身が空(u_code が無い)ものは、古い実装で作った不完全なものなので作り直す。 */
  const sourceDeepLink = source.searchParams.get('af_dp') || '';
  const keepSourceDeepLink =
    LITE_DEEPLINK_BASES.some((b) => sourceDeepLink.startsWith(b)) &&
    decodeURIComponent(sourceDeepLink).includes('u_code=');

  managed.push([
    'af_dp',
    opts.forceLite
      ? keepSourceDeepLink
        ? sourceDeepLink
        : buildLiteDeepLink(lpUrlFromParams(recoverAppParams(source)))
      : '',
  ]);

  managed.forEach(([k, v]) => params.set(k, v));

  /* 成果計測パラメータが1つも欠けていないことを確認してから返す。
     ここで止めることで、未サニタイズどころか「誰の紹介か分からないURL」が
     世に出るのを防ぐ。 */
  assertTrackingPreserved(source, url);

  return { url: url.toString(), removed, mode: 'onelink' };
}

/**
 * 遷移先URLにジェネレーターを適用する(展開＋サニタイズ)。
 *
 * サイト編集画面(`app/dashboard/dashboard-form.tsx`)から、保存時に呼び出すための入口。
 * ツール単体(`/tools/link-generator`)の「URLを抽出＆自動生成」と同じ処理を、
 * 入力欄1つぶんの操作にまとめただけで、内部で呼んでいるのは
 * `callExtractApi()` と `buildUrl()`(いずれも単独版からの移植)そのもの。
 *
 * 土台にするURLは、公式リンクの実体にどれだけ近いかで決める。
 *  1. 入力がすでに招待LPのURLなら、展開せずそのまま使う
 *  2. 短縮リンクなら自前でリダイレクトを追って展開する(公式リンクは招待LPへ着地する)
 *  3. 入力が OneLink 形式なら、展開は不要なのでサニタイズだけ行う
 *  4. どれにも当てはまらなければ Stealth API で抽出する(従来経路)
 *
 * 展開・サニタイズのいずれかに失敗した場合は例外を投げる(呼び出し側で保存を中断する)。
 */
export async function generateDestinationUrl(
  rawUrl: string,
  overrides: Partial<BuildOptions> = {}
): Promise<BuildResult> {
  const input = parseHttpUrl(rawUrl);
  if (!input) throw new Error('遷移先URLが不正です。http(s):// で始まるURLを入力してください。');

  let source = input.toString();

  if (!isInviteLpUrl(input) && !ONELINK_RE.test(input.hostname)) {
    // まずリダイレクトを追うだけで済ませる。公式リンクはこれで招待LPに着地する。
    const expanded = parseHttpUrl(await expandShortUrl(source));

    if (expanded && (isInviteLpUrl(expanded) || ONELINK_RE.test(expanded.hostname))) {
      source = expanded.toString();
    } else {
      // 展開できなかった(JS経由の遷移など)場合だけ Stealth API に頼る
      source = preferSourceUrl(await callExtractApi(source));
    }
  }

  return buildUrl(source, {
    iosUrl: DEFAULT_IOS_URL,
    androidUrl: DEFAULT_ANDROID_URL,
    webDpUrl: DEFAULT_WEB_DP_URL,
    forceLite: true,
    stripDeepLinks: true,
    ...overrides,
  });
}

/* ================== 最終出力の出し分け ==================
   サニタイズ処理そのものは buildUrl() が終えている。ここでやるのは
   「クッションページを挟むかどうか」による出力URLの差し替えだけ。 */

/**
 * クッションページ(遅延リダイレクト画面)を経由するURLを組み立てる。
 * 単独版と同じく、今いるページ自身のURLから query/hash を落として `?to=` を付ける。
 *
 * @param builtUrl        buildUrl() が返したサニタイズ済みの最終遷移先
 * @param cushionPageHref クッションページのURL(通常は window.location.href)
 */
export function buildCushionUrl(builtUrl: string, cushionPageHref: string): string {
  const relayUrl = new URL(cushionPageHref);
  relayUrl.search = '';
  relayUrl.hash = '';
  relayUrl.searchParams.set(CUSHION_PARAM, builtUrl);
  return relayUrl.toString();
}

/**
 * UIに表示する最終出力URLを決める。
 * - useCushion = true  … 従来通りクッションページ経由のURL
 * - useCushion = false … サニタイズ処理を通過した直後の直接遷移先URLそのまま
 */
export function resolveOutputUrl(built: BuildResult, useCushion: boolean, cushionPageHref: string): string {
  return useCushion ? buildCushionUrl(built.url, cushionPageHref) : built.url;
}
