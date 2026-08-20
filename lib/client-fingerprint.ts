/**
 * ブラウザフィンガープリント(@fingerprintjs/fingerprintjs)を計算するクライアント専用ユーティリティ。
 * ダッシュボード配下のクライアントコンポーネントからのみ呼び出す想定
 * (公開ページ側は lib/tiktok-viewer.ts が生成する素のHTML内で /fp.js を直接読み込んでいる)。
 * 同一タブ内での再計算を避けるため、結果をモジュール内でキャッシュする。
 */
let cached: Promise<string> | null = null;

export function getBrowserFingerprint(): Promise<string> {
  if (!cached) {
    cached = import('@fingerprintjs/fingerprintjs').then(async (mod) => {
      const agent = await mod.default.load();
      const result = await agent.get();
      return result.visitorId;
    });
  }
  return cached;
}
