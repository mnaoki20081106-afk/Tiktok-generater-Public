'use client';

import { useEffect } from 'react';

/**
 * クッションページ(遅延リダイレクト画面)。
 * 単独版 index.html の `runRelay()` を移植したもの。
 *
 * 遷移先の検証(http/https のみ許可)はサーバー側(page.tsx)で済ませてあり、
 * ここには検証済みのURLだけが渡ってくる。
 *
 * 手動リンク(「タップして続行」)は出さない。以前は自動遷移が働かなかった場合の
 * 避難口として遅れて表示していたが、遷移自体は始まっているのに遷移先(OneLink)の
 * 応答が遅いだけのケースでも出てしまっていた。タップ無しで飛ばす。
 * JSが無効な環境向けの <noscript> だけ残している。
 */
export function CushionRelay({ to }: { to: string | null }) {
  useEffect(() => {
    if (!to) return;

    const RETRY_MS = 6000; // 遷移が始まらなかったときに、もう一度だけ試すまでの時間
    const timers: ReturnType<typeof setTimeout>[] = [];
    let navigated = false;

    function go(href: string) {
      if (navigated) return;
      navigated = true;

      /* 遷移手段を重ねがけしない。location.replace が「効いていないのではなく
         遷移先の応答が遅いだけ」のときに別の遷移をかけると、進行中の遷移を中断して
         かえって到達が遅れるため。まず1回だけ投げる。 */
      try {
        window.location.replace(href);
      } catch {
        /* noop */
      }

      /* 本当に何も起きなかった場合の保険。ページ離脱が始まったら取り消すので、
         遅いだけの遷移を中断してしまうことはない。 */
      const retry = setTimeout(() => {
        try {
          window.location.href = href;
        } catch {
          /* noop */
        }
      }, RETRY_MS);
      timers.push(retry);
      const cancelRetry = () => clearTimeout(retry);
      window.addEventListener('pagehide', cancelRetry);
      window.addEventListener('beforeunload', cancelRetry);
    }

    const delay = 1000 + Math.random() * 1000;
    timers.push(setTimeout(() => go(to), delay));

    return () => timers.forEach(clearTimeout);
  }, [to]);

  // 遷移中は何も表示せず全面を黒くする
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      {!to && (
        <p className="break-all px-6 py-6 text-center text-sm text-[#b9b9b9]">
          リンクが不正です。生成し直してください。
        </p>
      )}
      {/* JSが無効な環境だけの避難口。JSが動く通常の閲覧では表示されない。 */}
      {to && (
        <noscript>
          <a href={to} rel="noreferrer noopener" className="text-sm text-[#8ab4f8] underline">
            続行
          </a>
        </noscript>
      )}
    </div>
  );
}
