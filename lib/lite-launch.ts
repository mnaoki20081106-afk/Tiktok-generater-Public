/**
 * 「TikTok Lite を確実に開く」ための遷移シーケンス。
 *
 * クッションページ(`app/tools/link-generator/cushion-relay.tsx`)と
 * 公開ページのクッションOFF版(`lib/tiktok-viewer.ts` の `renderRedirectHtml()`)の
 * 両方から使う。後者は文字列でHTMLを組み立てるため、この関数を
 * `liteLaunchScript()` でそのまま直列化して <script> に埋め込む。
 * 直列化する都合上、`startLiteLaunch()` は**モジュール内の他の識別子を参照しない**
 * 完全に自己完結した関数にしてある(参照するとインライン化時に未定義になる)。
 */

/** カスタムスキームを投げてから「アプリが開かなかった」と判断するまでの時間 */
export const APP_LAUNCH_TIMEOUT_MS = 1200;

/** Web遷移が始まらなかったときに、もう一度だけ試すまでの時間 */
export const WEB_RETRY_MS = 6000;

/** 自動遷移が全部ブロックされる環境(アプリ内ブラウザ)向けに、手動リンクを出すまでの時間 */
export const MANUAL_ESCAPE_MS = 8000;

/** 手動リンクに付けるDOMのid */
export const MANUAL_ESCAPE_ID = 'lite-manual-escape';

/**
 * アプリ内ブラウザ(In-App Browser)のUserAgent。
 *
 * X(Twitter)のアプリ内ブラウザは、カスタムスキームの起動もページ遷移も両方ブロックする。
 * さらにフォールバック先の公式LPが内部で `onelink.me` へ飛ぼうとして、そこでも止まる。
 * 自動遷移を試みるほど手詰まりになるので、これらの環境では**最初から何も自動で行わず**、
 * 利用者のタップに委ねる。実タップは Universal Link を発火させられる唯一の手段でもある。
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
  /** 最終的な遷移先(招待LPのURL)。アプリ未インストールならここからストアへ落ちる */
  webUrl: string;
  /** アプリを直接起動するためのカスタムスキーム。作れない場合は null */
  appLink: string | null;
  appTimeoutMs: number;
  retryMs: number;
  manualEscapeMs: number;
  /** 手動リンクの要素id。空文字なら手動リンクを出さない */
  manualId: string;
  /** アプリ内ブラウザ判定に使う正規表現。空文字なら判定しない */
  inAppBrowserPattern: string;
}

/**
 * 起動シーケンスを開始する。
 *
 *  1. カスタムスキームでアプリを直接起動する(スクリプトからでも実行できる)
 *  2. `appTimeoutMs` 以内にページが背面へ回らなければ「開かなかった」とみなしてLPへ
 *  3. LPへの遷移すらブロックされる環境では、`manualEscapeMs` 後に手動リンクを表示する
 *
 * 「アプリが開いたか」はページが背面に回ったか(pagehide / blur / visibilitychange)で見る。
 * アプリが前面に出た場合はここで打ち切り、進行中の起動をWeb遷移で妨害しない。
 */
export function startLiteLaunch(opts: LiteLaunchOptions): void {
  var left = false;
  function markLeft() {
    left = true;
  }
  function gone() {
    return left || document.visibilityState === 'hidden';
  }

  /* 手動リンクを表示する。遷移先は呼び出し時点のもの(抽選で差し替わっている場合がある)。 */
  function showManual() {
    if (!opts.manualId) return;
    var el = document.getElementById(opts.manualId);
    if (!el) return;
    el.setAttribute('href', opts.webUrl);
    el.removeAttribute('hidden');
  }

  /* アプリ内ブラウザ(X など)では自動遷移が裏目に出るので、一切試さずタップに委ねる。 */
  var ua = (window.navigator && window.navigator.userAgent) || '';
  if (opts.inAppBrowserPattern && new RegExp(opts.inAppBrowserPattern, 'i').test(ua)) {
    showManual();
    return;
  }

  window.addEventListener('pagehide', markLeft);
  window.addEventListener('blur', markLeft);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') markLeft();
  });

  var webStarted = false;
  function goWeb() {
    if (webStarted) return;
    webStarted = true;

    /* 遷移手段を重ねがけしない。location.replace が「効いていないのではなく
       遷移先の応答が遅いだけ」のときに別の遷移をかけると、進行中の遷移を中断して
       かえって到達が遅れるため。まず1回だけ投げる。 */
    try {
      window.location.replace(opts.webUrl);
    } catch (e) {}

    var retry = setTimeout(function () {
      if (gone()) return;
      try {
        window.location.href = opts.webUrl;
      } catch (e) {}
    }, opts.retryMs);
    window.addEventListener('pagehide', function () {
      clearTimeout(retry);
    });
  }

  /* アプリ内ブラウザ(X など)は、カスタムスキームもページ遷移もブロックすることがある。
     その場合だけ手動リンクを出す。自動で抜けられた環境では表示されない。 */
  setTimeout(function () {
    if (gone()) return;
    showManual();
  }, opts.manualEscapeMs);

  if (opts.appLink) {
    try {
      window.location.href = opts.appLink;
    } catch (e) {}

    setTimeout(function () {
      if (gone()) return; // アプリが前面に出た
      goWeb();
    }, opts.appTimeoutMs);
    return;
  }

  goWeb();
}

/** 既定のタイミングでオプションを組み立てる */
export function liteLaunchOptions(webUrl: string, appLink: string | null): LiteLaunchOptions {
  return {
    webUrl,
    appLink,
    appTimeoutMs: APP_LAUNCH_TIMEOUT_MS,
    retryMs: WEB_RETRY_MS,
    manualEscapeMs: MANUAL_ESCAPE_MS,
    manualId: MANUAL_ESCAPE_ID,
    inAppBrowserPattern: IN_APP_BROWSER_PATTERN,
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
