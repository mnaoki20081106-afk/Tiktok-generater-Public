/**
 * @fingerprintjs/fingerprintjs のUMDビルドを public/ 配下へコピーする。
 * 公開ページ(app/[slug]/route.ts)は素のHTML文字列を返すRoute Handlerで、
 * Next.jsの通常のJSバンドル(コード分割・ハッシュ付きファイル名)を経由しないため、
 * <script src="/fp.js"> で直接読み込めるように静的ファイルとして配置する。
 * `npm install` のたびに自動実行され、public/fp.js はgit管理しない(package-lock.jsonのバージョンが真実)。
 */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', '@fingerprintjs', 'fingerprintjs', 'dist', 'fp.umd.min.js');
const destDir = path.join(__dirname, '..', 'public');
const dest = path.join(destDir, 'fp.js');

if (!fs.existsSync(src)) {
  console.warn('[copy-fingerprintjs] node_modules に @fingerprintjs/fingerprintjs が見つかりません。スキップします。');
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log('[copy-fingerprintjs] public/fp.js を更新しました。');
