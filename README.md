# Tiktok-generater

## profile-saas (Next.js + Supabase)

不特定多数向けに公開するプロフィール/ポートフォリオサイト作成SaaSのプロトタイプです。リポジトリ直下の `app/`, `lib/`, `components/`, `supabase/` がこのアプリ本体です(旧Cloudflare Worker版とは独立して動作します)。

### アーキテクチャ

- ユーザーごとに物理ファイルやWorkerを作らず、`sites` テーブル(Supabase/PostgreSQL)にテキストと画像URLを保存し、`/[slug]` へのアクセス時にDBから取得して1つの共通テンプレートで動的にレンダリングします。
- 認証・DB・画像ストレージはすべてSupabase(Auth / Postgres / Storage)。
- Row Level Security (RLS) が前提で、各ユーザーは自分の `sites` レコードしかINSERT/UPDATE/DELETEできません(`supabase/schema.sql` 参照)。閲覧(SELECT)のみ全員に公開しています。
- ダッシュボードでの編集内容は、保存ボタンを押すまでの間 `localStorage` にも自動保存されます(端末ごとの下書き)。DBへの保存が正となり、下書きは通信断・誤操作時のフォールバックです。

### セットアップ

1. Supabaseプロジェクトを作成し、SQL Editorで `supabase/schema.sql` を実行する(`sites` テーブル・RLSポリシー・`site-images` Storageバケットが作成されます)。
2. `.env.local.example` を `.env.local` にコピーし、SupabaseのURL/anonキーを設定する(`.env.local` は `.gitignore` 済みなのでリポジトリにはコミットされません)。
   ```
   cp .env.local.example .env.local
   ```
3. 依存関係をインストールして開発サーバーを起動する。
   ```
   npm install
   npm run dev
   ```
4. `/login` からアカウントを作成し、`/dashboard` でslug・タイトル・自己紹介・画像を設定すると `/そのslug` で公開されます。

### 主なページ

| パス | 内容 |
| --- | --- |
| `/` | サービス説明とログイン導線 |
| `/login` | Email/Passwordのログイン・新規登録 |
| `/dashboard` | 自分のサイト設定の編集(要ログイン) |
| `/[slug]` | 公開用ページ。存在しないslugは404 |

---

TikTokプロフィール誘導用のランディングサイトを、Cloudflare Workers上に自動デプロイ/上書きするジェネレーターです(旧バージョン。並行して残しています)。

## 構成

- **操作画面（このリポジトリの `docs/index.html`）**: GitHub Pagesで配信する静的HTML。中央の大きなプレビューが公開サイトの見た目そのものになっており、背景画像・プロフィール画像はタップして選択、アカウント名・説明文（ハッシュタグ・「続きを見る」対応）・BGM名・いいね/コメント/シェアの数値はタップして直接編集できるWYSIWYGエディタ。
- **デプロイAPI（`generater-worker.js`）**: Cloudflare Worker。Cloudflare APIを叩いて実際のサイト用Workerを作成/更新する。CORS対応済みで、GitHub Pagesからのクロスオリジン呼び出しを受け付ける。
- **公開されるサイト（`VIEWER_CODE`）**: デプロイAPIが動的に生成し、Cloudflare上の別Workerとしてデプロイするコード。実際にユーザーが閲覧するTikTok誘導ページ本体。プロフィール・いいね・コメント・シェア・BGMの右レール、アカウント名・説明文・BGM名のキャプション、下部ナビゲーションバー（ホーム/トレンド/＋/メッセージ/プロフィール）、任意で表示できる見た目だけのページインジケーターを含むTikTok風レイアウト。

## セットアップ

### 1. デプロイAPI用Workerをデプロイ

1. `generater-worker.js` の内容でCloudflare Workerを新規作成（例: `tiktok-generator-api`）。
2. Worker の Settings → Variables and Secrets に以下を設定:
   - `CF_ACCOUNT_ID`: CloudflareアカウントID
   - `CF_API_TOKEN`: Workers編集権限を持つAPIトークン
3. デプロイ後、`https://tiktok-generator-api.<subdomain>.workers.dev` のようなURLが発行される。これを操作画面から使用する。

### 2. 操作画面をGitHub Pagesで公開

1. このリポジトリの Settings → Pages で、Source を `docs/` フォルダに設定。
2. 公開されたURL（例: `https://<user>.github.io/Tiktok-generater/`）にアクセス。
3. 「デプロイAPIのURL」欄に手順1で発行されたWorkerのURLを入力（ブラウザに保存されるので初回のみでOK）。
4. 中央のプレビューをタップして、背景画像（ドラッグで位置調整・スライダーで拡大縮小、端に寄せると自動スナップ）・プロフィール画像・アカウント名・説明文（ハッシュタグ含む）・BGM名・いいね/コメント/シェア数を編集。右側の設定でWorker名・TikTokプロフィールURL・OGPタイトル・OGP画像・アプリアイコン画像を入力。プレビュー下の「誘導ダイアログをプレビュー表示」をONにすると、実際のサイトで常時表示される誘導ダイアログの見た目をプレビュー上で確認しながらアプリアイコン画像をタップして編集できる（下部の入力欄と連動）。ページインジケーター（見た目のみ、最大6個）もここで設定。
5. 未入力の必須項目があると赤枠とデプロイボタン上の警告欄で知らせてくれる。
6. 「自動デプロイ」を押すと、公開サイトがCloudflare上に作成/上書きされる。

入力内容（テキストと画像）はブラウザに自動保存され、次回このページを開いたときに復元される。保存内容をリセットしたい場合は「保存内容をクリア」ボタンを使う。

## デプロイが失敗する場合

デプロイAPIはCloudflareの管理APIとKV書き込みAPIのみを叩く構成になっており、新規作成直後のサイト用Worker（`workers.dev`）自体には直接アクセスしないため、ネットワーク瞬断は起きにくくなっています。
それでも失敗する場合は、エラーメッセージの `[〇〇]` の部分（どのステップで失敗したか）を確認のうえ、時間を置いて再度「自動デプロイ」を実行してください（同名Workerは上書きされます）。
