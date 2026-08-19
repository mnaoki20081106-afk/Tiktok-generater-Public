'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * フォームの入力内容を端末(localStorage)に自動保存し、次回アクセス時に復元するフック。
 * DB保存とは独立した「下書き」レイヤーとして機能する(ネットワーク切断・誤操作対策)。
 */
export function useLocalDraft<T extends object>(key: string, initialValue: T) {
  const [draft, setDraft] = useState<T>(initialValue);
  const [restoredFromDraft, setRestoredFromDraft] = useState(false);
  const isFirstRun = useRef(true);

  // 初回マウント時のみ、端末に保存された下書きがあれば復元する。
  // localStorageはSSR中に参照できないブラウザAPIのため、lazy initializerではなくeffectでの読み込みが必要。
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(key);
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- ブラウザ専用APIからの初期復元のため
        setDraft(JSON.parse(saved));
        setRestoredFromDraft(true);
      }
    } catch {
      // localStorageが使えない/壊れている場合は無視してinitialValueのまま
    }
  }, [key]);

  // draftが変わるたびに端末へ保存する(初回マウント直後の書き込みはスキップ)
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(draft));
    } catch {
      // 保存失敗(容量超過など)は致命的ではないため無視
    }
  }, [key, draft]);

  function clearDraft() {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // noop
    }
  }

  return { draft, setDraft, restoredFromDraft, clearDraft };
}
