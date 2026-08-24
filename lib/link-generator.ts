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

/** クッションページが遷移先を受け取るクエリキー。単独版と同じ `to`。 */
export const CUSHION_PARAM = 'to';

/** ネットワーク層(CORS/DNS/オフライン)で落ちたことを示すフラグ付きエラー */
export interface NetworkLevelError extends Error {
  networkLevel?: boolean;
}

export interface ExtractApiResponse {
  success: boolean;
  trackingUrl: string;
  error?: string;
}

export interface BuildOptions {
  iosUrl: string;
  androidUrl: string;
  /** PC(デスクトップ)から踏まれたときの遷移先。空なら af_web_dp を設定しない */
  webDpUrl: string;
  emptyDp: boolean;
  /* is_retargeting はオプションごと廃止した。付与すると招待報酬が付かなくなる恐れがあり、
     残しておくと「うっかりONにする」事故が起きるため(buildUrl は常に除去する)。 */
  stripDeepLinks: boolean;
}

export interface BuildResult {
  /** サニタイズ・再構築を通過した最終的な直接遷移先URL */
  url: string;
  /** 除去したディープリンク系パラメータ名 */
  removed: string[];
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
  // 過去のインセンティブ系キャンペーンの残骸。
  // 残っていると aweme:// 等のカスタムスキームへ勝手に飛ばされる。
  'inc_target_url',
  'is_inc_roma',
  'incentive_redirect',
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

export function buildUrl(rawUrl: string, opts: BuildOptions): BuildResult {
  let url = parseHttpUrl(rawUrl);
  if (!url) throw new Error('トラッキング URL が不正です。');

  // OneLink でなければここで止まる
  url = assertOneLink(url);

  /* ショートリンクIDを外してロングリンク化する。
     サーバー側の設定より、こちらが付けたクエリパラメータを優先させるため。 */
  url = toLongLink(url);

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

  if (opts.emptyDp) managed.push(['af_dp', '']);

  /* いったん全部消してから決まった順に入れ直す。
     これらのキーは DEEPLINK_PARAMS に含まれるもの(af_web_dp 等)と含まれないもの
     (af_ios_url 等)が混在しており、消さずに set すると生成のたびに並び順が変わる。
     同じURLを再保存したときに文字列が一致しなくなるため、順序を固定する。 */
  managed.forEach(([k]) => params.delete(k));
  managed.forEach(([k, v]) => params.set(k, v));

  /* is_retargeting は付与せず、逆に必ず除去する。
     AppsFlyerはこれが true だとクリックを「リターゲティング(再エンゲージメント)」として
     記録する。招待報酬は「新規インストール＋初回起動」で発火するのが前提なので、
     リターゲティング扱いになると発火条件を外れて報酬が付かない恐れがある。

     TikTok Liteの招待リンクにはそもそも is_retargeting が入っていない。
     削除しているのは、この対応より前に生成した(is_retargeting=true が焼き付いた)URLを
     再保存したときに確実に落とすため。除去はディープリンクのサニタイズとは別の目的なので、
     stripDeepLinks のON/OFFに関係なく常に実行する。 */
  if (params.has('is_retargeting')) {
    removed.push('is_retargeting');
    params.delete('is_retargeting');
  }

  return { url: url.toString(), removed };
}

/**
 * 遷移先URLにジェネレーターを適用する(展開＋サニタイズ)。
 *
 * サイト編集画面(`app/dashboard/dashboard-form.tsx`)から、保存時に呼び出すための入口。
 * ツール単体(`/tools/link-generator`)の「URLを抽出＆自動生成」と同じ処理を、
 * 入力欄1つぶんの操作にまとめただけで、内部で呼んでいるのは
 * `callExtractApi()` と `buildUrl()`(いずれも単独版からの移植)そのもの。
 *
 * - 入力が OneLink 形式なら、展開は不要なのでサニタイズだけ行う。
 * - そうでなければ Stealth API で元のトラッキングURLへ展開してからサニタイズする。
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
  if (!ONELINK_RE.test(input.hostname)) {
    const data = await callExtractApi(source);
    source = data.trackingUrl;
  }

  return buildUrl(source, {
    iosUrl: DEFAULT_IOS_URL,
    androidUrl: DEFAULT_ANDROID_URL,
    webDpUrl: DEFAULT_WEB_DP_URL,
    emptyDp: true,
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
