'use client';

import { useEffect, useState } from 'react';

/**
 * クッションページ(遅延リダイレクト画面)。
 * 単独版 index.html の `runRelay()` をそのまま移植したもの。
 *
 * 遷移先の検証(http/https のみ許可)はサーバー側(page.tsx)で済ませてあり、
 * ここには検証済みのURLだけが渡ってくる。
 */
export function CushionRelay({ to }: { to: string | null }) {
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    if (!to) return;

    const delay = 1000 + Math.random() * 1000;
    const t1 = setTimeout(() => {
      window.location.href = to;
    }, delay);

    // 自動遷移が働かなかった場合の避難口。
    // 遷移が成功していればページは既に離れているので表示されることはない。
    const t2 = setTimeout(() => setShowFallback(true), delay + 4000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [to]);

  // 遷移中は何も表示せず全面を黒くする
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      {!to && (
        <p className="break-all px-6 py-6 text-center text-sm text-[#b9b9b9]">
          リンクが不正です。生成し直してください。
        </p>
      )}
      {to && showFallback && (
        <a
          href={to}
          rel="noopener"
          className="break-all px-6 py-6 text-center text-sm text-[#8ab4f8] underline"
        >
          タップして続行
        </a>
      )}
    </div>
  );
}
