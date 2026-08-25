'use client';

import { useEffect } from 'react';
import { toLiteAppLink } from '@/lib/link-generator';
import { MANUAL_ESCAPE_ID, isInAppBrowser, liteLaunchOptions, startLiteLaunch } from '@/lib/lite-launch';

/**
 * クッションページ(遅延リダイレクト画面)。
 * 単独版 index.html の `runRelay()` を移植したもの。
 *
 * 遷移先の検証(http/https のみ許可)はサーバー側(page.tsx)で済ませてあり、
 * ここには検証済みのURLだけが渡ってくる。
 *
 * 遷移そのものは `startLiteLaunch()`(公開ページのクッションOFF版と共通)に任せる。
 * 招待LPをただ開くだけだと、Liteがインストール済みでもストアへ飛ばされてしまうため、
 * 先にカスタムスキームでアプリを直接起動しにいく(`toLiteAppLink()` を参照)。
 *
 * 手動リンクは既定では出さない。表示するのは次の2つの場合だけ。
 *  - アプリ内ブラウザ(X など)… 自動遷移が裏目に出るため、待たずに即表示してタップに委ねる
 *  - それ以外で自動遷移が全部ブロックされた場合 … 一定時間ページに留まっていれば表示する
 */
export function CushionRelay({ to }: { to: string | null }) {
  useEffect(() => {
    if (!to) return;

    /* アプリ内ブラウザ(X など)では自動遷移を一切行わず、すぐ手動リンクを出す。
       待たせても状況が良くなることはないため、ランダム待機も挟まない。 */
    if (isInAppBrowser()) {
      startLiteLaunch(liteLaunchOptions(to, toLiteAppLink(to)));
      return;
    }

    /* アプリ起動の待ち(1.2秒)がこのあとに乗るため、以前の 1〜2秒 から短くしてある。
       合計で従来と同じ体感(2秒前後)に収めるため。 */
    const delay = 600 + Math.random() * 600;
    const timer = setTimeout(() => startLiteLaunch(liteLaunchOptions(to, toLiteAppLink(to))), delay);

    return () => clearTimeout(timer);
  }, [to]);

  // 遷移中は何も表示せず全面を黒くする
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      {!to && (
        <p className="break-all px-6 py-6 text-center text-sm text-[#b9b9b9]">
          リンクが不正です。生成し直してください。
        </p>
      )}
      {to && (
        <>
          {/* 自動遷移が全部ブロックされる環境向けの避難口。既定では hidden。 */}
          <a
            id={MANUAL_ESCAPE_ID}
            href={to}
            rel="noreferrer noopener"
            hidden
            className="px-6 py-6 text-center text-sm text-[#8ab4f8] underline [&[hidden]]:hidden"
          >
            タップして続行
          </a>
          {/* JSが無効な環境だけの避難口。JSが動く通常の閲覧では表示されない。 */}
          <noscript>
            <a href={to} rel="noreferrer noopener" className="text-sm text-[#8ab4f8] underline">
              続行
            </a>
          </noscript>
        </>
      )}
    </div>
  );
}
