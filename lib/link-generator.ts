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
export const DEFAULT_ONELINK_TEMPLATE = 'https://snssdk1180.onelink.me/BAuo';

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
  emptyDp: boolean;
  retargeting: boolean;
  stripDeepLinks: boolean;
  onelinkTemplate: string;
}

export interface BuildResult {
  /** サニタイズ・再構築を通過した最終的な直接遷移先URL */
  url: string;
  /** 除去したディープリンク系パラメータ名 */
  removed: string[];
  /** ドメイン補正などの注意書き */
  notes: string[];
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

export const ONELINK_RE = /(^|\.)onelink\.me$/i;

/* 抽出結果が OneLink でなかった場合にドメインを補正する。
   lite.tiktok.com / vt.tiktok.com のような短縮ドメインは AppsFlyer のパラメータを
   解釈しないため、後からいくら付与しても無視されてしまう。 */
export function coerceToOneLink(url: URL, templateRaw: string, notes: string[]): URL {
  if (ONELINK_RE.test(url.hostname)) return url;

  const tpl = parseHttpUrl(templateRaw);
  if (!tpl || !ONELINK_RE.test(tpl.hostname)) {
    throw new Error(
      '抽出URLのドメインが ' +
        url.hostname +
        ' で OneLink ではありません。' +
        'この形式ではパラメータを付けても無視されるため、中継リンクが機能しません。' +
        '「OneLink テンプレート」に *.onelink.me のURLを入力してください。'
    );
  }

  const merged = new URL(tpl.origin + tpl.pathname);
  tpl.searchParams.forEach((v, k) => {
    merged.searchParams.set(k, v);
  });

  let carried = 0;
  url.searchParams.forEach((v, k) => {
    merged.searchParams.set(k, v);
    carried++;
  });

  notes.push('ドメインを ' + url.hostname + ' → ' + merged.hostname + ' に補正しました。');
  if (carried === 0) {
    notes.push(
      '警告: 元URLにクエリパラメータが1つもないため、招待コード等の識別情報を引き継げていません。' +
        'このままだと誰の紹介か記録されない可能性があります。抽出をやり直してください。'
    );
  }
  return merged;
}

export function buildUrl(rawUrl: string, opts: BuildOptions): BuildResult {
  let url = parseHttpUrl(rawUrl);
  if (!url) throw new Error('トラッキング URL が不正です。');

  const notes: string[] = [];
  url = coerceToOneLink(url, opts.onelinkTemplate, notes);

  const params = url.searchParams;

  // ディープリンク系を除去する。これをしないと deep_link_value 等が
  // af_dp の空文字より優先され、通常版が直接起動してしまう。
  const removed: string[] = [];
  if (opts.stripDeepLinks) {
    DEEPLINK_PARAMS.forEach((k) => {
      if (params.has(k)) {
        removed.push(k);
        params.delete(k);
      }
    });
  }

  if (opts.iosUrl) params.set('af_ios_url', opts.iosUrl);
  if (opts.androidUrl) params.set('af_android_url', opts.androidUrl);
  if (opts.emptyDp) params.set('af_dp', '');
  if (opts.retargeting) params.set('is_retargeting', 'true');

  return { url: url.toString(), removed, notes };
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
