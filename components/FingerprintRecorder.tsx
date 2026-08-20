'use client';

import { useEffect } from 'react';
import { getBrowserFingerprint } from '@/lib/client-fingerprint';
import { recordFingerprint } from '@/app/dashboard/actions';

/**
 * ログイン中ユーザーの端末フィンガープリントを known_fingerprints へ記録する(画面には何も表示しない)。
 * dvid Cookieが削除された場合でも、サプライズ抽選で作成者本人・同一アカウントの端末と
 * 判定できるようにするための補助シグナル。ダッシュボード配下のページに配置する。
 */
export function FingerprintRecorder() {
  useEffect(() => {
    getBrowserFingerprint()
      .then((fingerprint) => recordFingerprint(fingerprint))
      .catch(() => {});
  }, []);

  return null;
}
