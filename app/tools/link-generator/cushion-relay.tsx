'use client';

import { useEffect } from 'react';
import { ERROR_TEXT, ERROR_TEXT_ID, IAB_SCREEN_ID, liteLaunchOptions, startLiteLaunch } from '@/lib/lite-launch';
import styles from './cushion-relay.module.css';

/**
 * クッションページ(遅延リダイレクト画面)。
 * 単独版 index.html の `runRelay()` を移植したもの。
 *
 * 遷移先の検証(http/https のみ許可)はサーバー側(page.tsx)で済ませてあり、
 * ここには検証済みのURLだけが渡ってくる。
 *
 * 遷移そのものは `startLiteLaunch()`(公開ページのクッションOFF版と共通)に任せる。
 * 画面全体を1枚のリンクにした黒い画面を出し、利用者のタップで遷移させる
 * (Universal Link はJS遷移では発火せず、タップを経由したときだけ効くため)。
 */
export function CushionRelay({ to, storeFallback }: { to: string | null; storeFallback?: string | null }) {
  useEffect(() => {
    if (!to) return;

    /* タップを待つ画面はどの環境でもすぐ出す。遅らせると、その間のタップが
       <a> に届かず取りこぼしになる(画面は hidden のままなので)。
       通常のブラウザで誰もタップしなかった場合の自動遷移は startLiteLaunch 側が持つ。 */
    startLiteLaunch({ ...liteLaunchOptions(to), storeFallbackUrl: storeFallback ?? undefined });
  }, [to, storeFallback]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      {!to && (
        <p className="break-all px-6 py-6 text-center text-sm text-[#b9b9b9]">
          リンクが不正です。生成し直してください。
        </p>
      )}
      {to && (
        <>
          {/* 読み込み画面。画面全体が1枚のリンクになっていて、
              利用者のタップで Universal Link を発火させる。 */}
          {/* href は最初から入れておき、JSからは書き換えない。target="_top" を付けるのは、
              アプリ内ブラウザ(WKWebView)から最上位のコンテキストで辿らせるため。 */}
          <a
            id={IAB_SCREEN_ID}
            href={to}
            target="_top"
            rel="noreferrer noopener"
            className={styles.iabScreen}
          >
            <span id={ERROR_TEXT_ID} hidden className={styles.errorText}>
              {ERROR_TEXT}
            </span>
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
