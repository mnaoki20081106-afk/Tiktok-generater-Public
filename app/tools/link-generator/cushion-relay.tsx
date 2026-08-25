'use client';

import { useEffect } from 'react';
import {
  ERROR_TEXT,
  ERROR_TEXT_ID,
  IAB_SCREEN_ID,
  isInAppBrowser,
  liteLaunchOptions,
  startLiteLaunch,
} from '@/lib/lite-launch';
import styles from './cushion-relay.module.css';

/**
 * クッションページ(遅延リダイレクト画面)。
 * 単独版 index.html の `runRelay()` を移植したもの。
 *
 * 遷移先の検証(http/https のみ許可)はサーバー側(page.tsx)で済ませてあり、
 * ここには検証済みのURLだけが渡ってくる。
 *
 * 遷移そのものは `startLiteLaunch()`(公開ページのクッションOFF版と共通)に任せる。
 *  - 通常のブラウザ … 少し待ってから遷移先へそのまま飛ばす
 *  - アプリ内ブラウザ(X など) … 自動遷移は効かないので、画面全体を1枚のリンクにした
 *    黒い画面を出し、タップで遷移させる(Universal Link を発火させるため)
 */
export function CushionRelay({ to }: { to: string | null }) {
  useEffect(() => {
    if (!to) return;

    /* アプリ内ブラウザでは自動遷移が効かないので、タップを待つ画面をすぐ出す。
       通常のブラウザではクッションページらしく1〜2秒おいてから遷移する。 */
    if (isInAppBrowser()) {
      startLiteLaunch(liteLaunchOptions(to));
      return;
    }

    const delay = 1000 + Math.random() * 1000;
    const timer = setTimeout(() => startLiteLaunch(liteLaunchOptions(to)), delay);

    return () => clearTimeout(timer);
  }, [to]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      {!to && (
        <p className="break-all px-6 py-6 text-center text-sm text-[#b9b9b9]">
          リンクが不正です。生成し直してください。
        </p>
      )}
      {to && (
        <>
          {/* アプリ内ブラウザ専用の読み込み画面。画面全体が1枚のリンクになっていて、
              利用者のタップで Universal Link を発火させる。通常のブラウザでは表示されない。 */}
          <a id={IAB_SCREEN_ID} href={to} rel="noreferrer noopener" hidden className={styles.iabScreen}>
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
