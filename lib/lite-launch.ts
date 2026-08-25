/**
 * 遷移先(招待LP)へ送り出すシーケンス。
 *
 * クッションページ(`app/tools/link-generator/cushion-relay.tsx`)と
 * 公開ページのクッションOFF版(`lib/tiktok-viewer.ts` の `renderRedirectHtml()`)の
 * 両方から使う。後者は文字列でHTMLを組み立てるため、この関数を
 * `liteLaunchScript()` でそのまま直列化して <script> に埋め込む。
 * 直列化する都合上、`startLiteLaunch()` は**モジュール内の他の識別子を参照しない**
 * 完全に自己完結した関数にしてある(参照するとインライン化時に未定義になる)。
 *
 * ## どの環境でも「利用者のタップ」を経由させる
 *
 * 遷移先(招待LP)のURLは TikTok の関連ドメイン上のHTTPSリンクで、それ自体が
 * Universal Link として登録されている。**ただし発火するのは利用者がリンクを
 * タップしたときだけ。** iOSは次のいずれでもアプリを開かず、素のWebページを表示する。
 *
 *   - `location.href` / `location.replace` によるJS遷移
 *   - サーバーの 301/302 リダイレクト
 *
 * 後者は「公式の招待リンク(`https://lite.tiktok.com/t/XXXX/`)を踏んでも
 * アプリが起動せず招待LPがブラウザで開くだけ」という既知の症状の正体でもある
 * (短縮リンクはリダイレクトで招待LPへ着地するため)。
 *
 * つまり**アプリを開けるかどうかを決めているのはURLの形ではなく、遷移のさせ方**である。
 * 一時期この分岐は「アプリ内ブラウザだけタップに委ね、通常のブラウザでは
 * `location.replace()` で自動遷移させる」形だったが、後者は上記のとおり
 * 原理的にアプリが開かない。カスタムスキームを直接叩くのをやめた時点で
 * 自動遷移にする理由も無くなったので、**全環境でタップを経由させる**。
 *
 * ### 画面
 *
 * 画面全体を1枚の <a> にした真っ黒な画面を出し、利用者のタップでリンクを辿らせる。
 * スピナーもプログレスバーも出さない。Xのアプリ内ブラウザは黒背景なので、
 * 装飾を足さないほうが「読み込み中の画面」として自然に見える。
 * 2秒たってもタップが無ければ、読み込みが止まったことを伝える文言だけを出す。
 *
 * **遷移は <a> のネイティブな挙動に任せる。** スクリプトで飛ばすとユーザー操作の
 * 文脈から外れ、Universal Link が発火しなくなるため。
 *
 * ### 通常のブラウザだけ、最後の保険を持つ
 *
 * それでもタップされないまま時間が過ぎた場合に限り、`location.replace()` で
 * 遷移先へ送る。この経路ではアプリは開かず招待LPがブラウザで開くだけだが、
 * 黒い画面のまま放置されるよりはよい。アプリ内ブラウザではこの保険を使わない
 * (自動遷移そのものがブロックされるうえ、フォールバック先の招待LPが内部で
 * `onelink.me` へ飛ぼうとしてそこでも止まるため)。
 */

/** 通常のブラウザで、タップされないまま自動遷移させるまでの時間(最後の保険) */
export const WEB_FALLBACK_MS = 6000;

/** アプリ内ブラウザで、何も出さずに待つ時間。これを過ぎたらエラー文言を出す */
export const IAB_HOLD_MS = 2000;

/** アプリ内ブラウザ用の画面(画面全体を覆う <a>)のid */
export const IAB_SCREEN_ID = 'lite-iab';
/** 「エラーが発生しました。タップして再実行」のid */
export const ERROR_TEXT_ID = 'lite-error-text';

/** エラー時に出す文言。マークアップ側と揃えるため定数にしてある */
export const ERROR_TEXT = 'エラーが発生しました。タップして再実行';

/**
 * アプリ内ブラウザ(In-App Browser)のUserAgent。
 *
 * X(Twitter)のアプリ内ブラウザは、カスタムスキームの起動もページ遷移も両方ブロックする。
 * さらにフォールバック先の公式LPが内部で `onelink.me` へ飛ぼうとして、そこでも止まる。
 * 自動遷移を試みるほど手詰まりになるので、これらの環境では利用者のタップに委ねる。
 *
 * 文字列で持っているのは、`startLiteLaunch()` が直列化のためモジュール内の識別子を
 * 参照できず、オプション経由で受け取る必要があるため。
 */
export const IN_APP_BROWSER_PATTERN = 'Twitter|FBAN|FBAV|FB_IAB|Instagram|Line/|MicroMessenger';

/** 現在の環境がアプリ内ブラウザか(React側から使う。判定内容は startLiteLaunch と同じ) */
export function isInAppBrowser(userAgent?: string): boolean {
  const ua = userAgent ?? (typeof navigator === 'undefined' ? '' : navigator.userAgent);
  return new RegExp(IN_APP_BROWSER_PATTERN, 'i').test(ua || '');
}

export interface LiteLaunchOptions {
  /** 遷移先(招待LPのURL) */
  webUrl: string;
  /** 通常のブラウザで、タップされないまま自動遷移させるまでの時間 */
  fallbackMs: number;
  /** アプリ内ブラウザ判定に使う正規表現。空文字なら判定しない */
  inAppBrowserPattern: string;
  /** 画面全体を覆う <a> のid */
  iabScreenId: string;
  /** エラー文言のid */
  errorTextId: string;
  /** 何も出さずに待つ時間 */
  holdMs: number;
}

/**
 * 遷移シーケンスを開始する。詳細はファイル冒頭のコメントを参照。
 */
export function startLiteLaunch(opts: LiteLaunchOptions): void {
  var ua = (window.navigator && window.navigator.userAgent) || '';
  var inApp = !!opts.inAppBrowserPattern && new RegExp(opts.inAppBrowserPattern, 'i').test(ua);

  /* 画面全体が <a> になっているので、遷移そのものはブラウザに任せる。
     ここでやるのは「画面を出す」「2秒後にエラー文言を出す」だけ。 */
  var screen = document.getElementById(opts.iabScreenId);

  if (!screen) {
    /* 画面が無い(この対応より前に配信されたHTMLなど)。タップさせる先が無いので、
       アプリは開かないが、せめて遷移先までは送る。 */
    try {
      window.location.replace(opts.webUrl);
    } catch (e) {}
    return;
  }

  // 遷移先は呼び出し時点のもの(抽選で差し替わっている場合がある)
  screen.setAttribute('href', opts.webUrl);
  screen.removeAttribute('hidden');

  var errorText = document.getElementById(opts.errorTextId);
  var errorTimer = setTimeout(function () {
    if (errorText) errorText.removeAttribute('hidden');
  }, opts.holdMs);

  /* 通常のブラウザだけが持つ最後の保険。タップされないまま時間が過ぎたら遷移先へ送る。
     この経路ではアプリは開かない(JS遷移では Universal Link が発火しない)が、
     黒い画面のまま放置されるよりはよい。
     アプリ内ブラウザでは張らない。自動遷移がブロックされるうえ、
     フォールバック先の招待LPが内部で onelink.me へ飛ぼうとしてそこでも止まるため。 */
  var fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  if (!inApp) {
    fallbackTimer = setTimeout(function () {
      // 既にアプリへ移った(タップが効いた)なら何もしない
      if (document.visibilityState === 'hidden') return;
      try {
        window.location.replace(opts.webUrl);
      } catch (e) {}
    }, opts.fallbackMs);
  }

  /* タップされたら遷移が始まるので、その途中でエラー文言が出たり、
     保険の自動遷移がタップを追い越したりしないように両方止める。
     ここで preventDefault したり location を触ったりはしない。ユーザー操作の文脈から
     外れると Universal Link が発火しなくなるため、遷移は <a> に任せる。 */
  function onTap() {
    clearTimeout(errorTimer);
    if (fallbackTimer) clearTimeout(fallbackTimer);
  }
  screen.addEventListener('touchstart', onTap, { passive: true });
  screen.addEventListener('click', onTap);
}

/** 既定のタイミングでオプションを組み立てる */
export function liteLaunchOptions(webUrl: string): LiteLaunchOptions {
  return {
    webUrl,
    fallbackMs: WEB_FALLBACK_MS,
    inAppBrowserPattern: IN_APP_BROWSER_PATTERN,
    iabScreenId: IAB_SCREEN_ID,
    errorTextId: ERROR_TEXT_ID,
    holdMs: IAB_HOLD_MS,
  };
}

/**
 * 文字列HTMLへ埋め込むための、呼び出し可能な形の `startLiteLaunch`。
 *
 * `</script>` でスクリプトが閉じてしまわないよう、そのシーケンスだけを潰す
 * (`<` を一律にエスケープすると比較演算子まで壊れるため対象を絞っている)。
 */
export function liteLaunchScript(): string {
  const source = startLiteLaunch.toString();

  /* ビルド時のミニファイで関数名や変数名は変わるが、関数式であることは変わらない。
     万一 toString() が実体を返さなくなった場合は、壊れたHTMLを配る前にここで止める。 */
  if (!/^function\b/.test(source.trim())) {
    throw new Error('startLiteLaunch を直列化できませんでした: ' + source.slice(0, 60));
  }

  return source.replace(/<\/(script)/gi, '<\\/$1');
}

/** アプリ内ブラウザ用の画面のCSS(文字列HTML側で使う)。装飾はせず黒一色。 */
export const LITE_IAB_CSS = `
#${IAB_SCREEN_ID}{position:fixed;inset:0;z-index:9999;display:flex;
  align-items:center;justify-content:center;background:#000;
  text-decoration:none;-webkit-tap-highlight-color:transparent;}
#${IAB_SCREEN_ID}[hidden]{display:none;}
#${ERROR_TEXT_ID}{margin:0;padding:0 24px;font-size:14px;line-height:1.6;
  color:#8a8b91;text-align:center;}
#${ERROR_TEXT_ID}[hidden]{display:none;}
`;
