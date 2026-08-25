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
 * 真っ白な画面にプログレスバーだけを出し、画面全体を1枚の <a> にしておく。
 * 利用者のタップでリンクを辿らせることで、Universal Link を自然に発火させる。
 * バーは意図的に手前で止め、一定時間タップが無ければ再実行を促す文言を出す。
 *
 * タップ時のアニメーションは視覚的なフィードバックのためだけのもので、遷移は
 * <a> のネイティブな挙動に任せる(`preventDefault` もしないし `setTimeout` でも飛ばさない)。
 * スクリプトで遷移させるとユーザー操作の文脈から外れ、Universal Link が発火しなくなるため。
 */

/** Web遷移が始まらなかったときに、もう一度だけ試すまでの時間 */
export const WEB_RETRY_MS = 6000;

/** 真っ白な画面を見せてから、プログレスバーを出現させるまでの時間 */
export const PROGRESS_APPEAR_MS = 400;

/** バーが 0% から `PROGRESS_HOLD_PCT` まで進むのにかける時間 */
export const PROGRESS_HOLD_MS = 1400;

/** 意図的に進捗を止めておく位置(%) */
export const PROGRESS_HOLD_PCT = 86;

/** ホールドに入ってから「エラーが発生しました」を出すまでの時間 */
export const ERROR_AFTER_MS = 2500;

/** タップされてから 100% になるまでの時間(1秒未満) */
export const PROGRESS_FINISH_MS = 450;

/** アプリ内ブラウザ用の画面(画面全体を覆う <a>)のid */
export const IAB_SCREEN_ID = 'lite-iab';
/** プログレスバーの外枠(トラック)のid。既定では透明で、遅れて出現させる */
export const PROGRESS_WRAP_ID = 'lite-progress-wrap';
/** プログレスバーの中身(進捗)のid */
export const PROGRESS_BAR_ID = 'lite-progress-bar';
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

  /* --- アプリ内ブラウザ用のローディングUI --- */
  iabScreenId: string;
  progressWrapId: string;
  progressBarId: string;
  errorTextId: string;
  progressAppearMs: number;
  progressHoldMs: number;
  progressHoldPct: number;
  errorAfterMs: number;
  progressFinishMs: number;
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

  /* ===== アプリ内ブラウザ ===== */
  var screen = document.getElementById(opts.iabScreenId);
  var wrap = document.getElementById(opts.progressWrapId);
  var bar = document.getElementById(opts.progressBarId);
  var errorText = document.getElementById(opts.errorTextId);
  if (!screen) return;

  // 遷移先は呼び出し時点のもの(抽選で差し替わっている場合がある)
  screen.setAttribute('href', opts.webUrl);
  screen.removeAttribute('hidden');

  function grow(pct: number, ms: number) {
    if (!bar) return;
    bar.style.transitionDuration = ms + 'ms';
    bar.style.width = pct + '%';
  }

  // 1. 真っ白な画面を少し見せてから、バーを出現させて手前まで進める
  setTimeout(function () {
    if (wrap) wrap.style.opacity = '1';
    grow(opts.progressHoldPct, opts.progressHoldMs);
  }, opts.progressAppearMs);

  // 2. ホールドしたままタップされなければ、再実行を促す
  var errorTimer = setTimeout(
    function () {
      if (errorText) errorText.removeAttribute('hidden');
    },
    opts.progressAppearMs + opts.progressHoldMs + opts.errorAfterMs
  );

  /* 3. タップされたら一気に 100% まで進める。
        遷移そのものは <a> のネイティブな挙動に任せる。ここで preventDefault したり
        setTimeout で飛ばしたりすると、ユーザー操作の文脈から外れて
        Universal Link が発火しなくなる。 */
  var tapped = false;
  function onTap() {
    if (tapped) return;
    tapped = true;
    clearTimeout(errorTimer);
    if (errorText) errorText.setAttribute('hidden', '');
    grow(100, opts.progressFinishMs);
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
    progressWrapId: PROGRESS_WRAP_ID,
    progressBarId: PROGRESS_BAR_ID,
    errorTextId: ERROR_TEXT_ID,
    progressAppearMs: PROGRESS_APPEAR_MS,
    progressHoldMs: PROGRESS_HOLD_MS,
    progressHoldPct: PROGRESS_HOLD_PCT,
    errorAfterMs: ERROR_AFTER_MS,
    progressFinishMs: PROGRESS_FINISH_MS,
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

/** アプリ内ブラウザ用ローディング画面のCSS(文字列HTML側で使う) */
export const LITE_IAB_CSS = `
#${IAB_SCREEN_ID}{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:20px;background:#fff;
  text-decoration:none;-webkit-tap-highlight-color:transparent;}
#${IAB_SCREEN_ID}[hidden]{display:none;}
#${PROGRESS_WRAP_ID}{width:60%;max-width:280px;height:4px;border-radius:999px;
  background:#eee;overflow:hidden;opacity:0;transition:opacity .3s ease;}
#${PROGRESS_BAR_ID}{display:block;width:0;height:100%;border-radius:999px;
  background:#161823;transition-property:width;transition-timing-function:ease-out;}
#${ERROR_TEXT_ID}{margin:0;font-size:13px;color:#8a8b91;text-align:center;padding:0 24px;}
#${ERROR_TEXT_ID}[hidden]{display:none;}
`;
