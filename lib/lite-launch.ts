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
 * ## 環境で挙動を2つに分ける
 *
 * ### 通常のブラウザ(Safari など)
 * 招待LPのURLへそのまま遷移するだけ。**カスタムスキーム(`snssdk473824://`)は使わない。**
 * 一時期これをJSから直接叩いていたが、iOSが「"TikTok Lite"で開きますか？」の確認ダイアログを
 * 出し、そこから開くとアトリビューションが切れることが実機で判明した(招待が無効になる)。
 * 公式リンクと同じく素直にURLへ飛ばすのが、トラッキングを保ったままアプリへ入る唯一の経路。
 *
 * ### アプリ内ブラウザ(X など)
 * 自動遷移はスキームもページ遷移も両方ブロックされるため、最初から試さない。
 * 画面全体を1枚の <a> にした真っ黒な画面を出し、利用者のタップでリンクを辿らせる。
 * タップというユーザー操作を経由することで Universal Link を自然に発火させられる。
 *
 * スピナーもプログレスバーも出さない。Xのアプリ内ブラウザは黒背景なので、
 * 装飾を足さないほうが「読み込み中の画面」として自然に見える。
 * 2秒たってもタップが無ければ、読み込みが止まったことを伝える文言だけを出す。
 *
 * **遷移は <a> のネイティブな挙動に任せる。** スクリプトで飛ばすとユーザー操作の
 * 文脈から外れ、Universal Link が発火しなくなるため。
 */

/** Web遷移が始まらなかったときに、もう一度だけ試すまでの時間 */
export const WEB_RETRY_MS = 6000;

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
  retryMs: number;
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

  if (!inApp) {
    /* ===== 通常のブラウザ =====
       カスタムスキームは使わず、そのまま遷移先へ。 */
    var left = false;
    window.addEventListener('pagehide', function () {
      left = true;
    });

    try {
      window.location.replace(opts.webUrl);
    } catch (e) {}

    /* 遷移が始まらなかった場合の保険。1回だけ。
       ページ離脱が始まっていれば何もしない(遅いだけの遷移を中断しないため)。 */
    setTimeout(function () {
      if (left || document.visibilityState === 'hidden') return;
      try {
        window.location.href = opts.webUrl;
      } catch (e) {}
    }, opts.retryMs);
    return;
  }

  /* ===== アプリ内ブラウザ =====
     画面全体が <a> になっているので、遷移そのものはブラウザに任せる。
     ここでやるのは「画面を出す」「2秒後にエラー文言を出す」だけ。 */
  var screen = document.getElementById(opts.iabScreenId);
  if (!screen) return;

  // 遷移先は呼び出し時点のもの(抽選で差し替わっている場合がある)
  screen.setAttribute('href', opts.webUrl);
  screen.removeAttribute('hidden');

  var errorText = document.getElementById(opts.errorTextId);
  var errorTimer = setTimeout(function () {
    if (errorText) errorText.removeAttribute('hidden');
  }, opts.holdMs);

  /* タップされたら遷移が始まるので、その途中でエラー文言が出てこないように止める。
     ここで preventDefault したり location を触ったりはしない。ユーザー操作の文脈から
     外れると Universal Link が発火しなくなるため、遷移は <a> に任せる。 */
  function onTap() {
    clearTimeout(errorTimer);
  }
  screen.addEventListener('touchstart', onTap, { passive: true });
  screen.addEventListener('click', onTap);
}

/** 既定のタイミングでオプションを組み立てる */
export function liteLaunchOptions(webUrl: string): LiteLaunchOptions {
  return {
    webUrl,
    retryMs: WEB_RETRY_MS,
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
