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
  if (opts.manualId) {
    setTimeout(function () {
      if (gone()) return;
      var el = document.getElementById(opts.manualId);
      if (el) el.removeAttribute('hidden');
    }, opts.manualEscapeMs);
  }

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
