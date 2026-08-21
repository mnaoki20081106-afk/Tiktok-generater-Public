# Tiktok-generater

## profile-saas (Next.js + Supabase)

TikTok風プロフィールページをGoogleアカウントでログインして作成・公開できるツールです。リポジトリ直下の `app/`, `lib/`, `components/`, `supabase/` がこのアプリ本体です(旧Cloudflare Worker版とは独立して動作します)。

### アーキテクチャ

- 認証はSupabase Auth(Googleログインのみ)。ログインセッションはCookieに保存され、ブラウザを閉じても次回アクセス時に自動で復元される。
- 1人のユーザーが複数のサイトを作成できる。`/dashboard` がマイページで、自分のサイトの一覧・新規作成・削除ができる。
- Row Level Security (RLS) が前提で、各ユーザーは自分の `sites` レコードしかINSERT/UPDATE/DELETEできない(`supabase/schema.sql` 参照)。閲覧(SELECT)は`/[slug]`の公開ページ用に全員へ許可している。
- `/[slug]` へのアクセス時にDBから取得して1つの共通テンプレート(旧Cloudflare Worker版のTikTok風レイアウトを移植)で動的にレンダリングする。
- 編集中の内容は、保存ボタンを押すまでの間 `localStorage`(テキスト)/`IndexedDB`(画像)にも「ユーザー+サイト」単位で端末に自動保存される。保存ボタンを押すまでは下書き扱いで、押すとDBへ反映される。
- 公開ページの「TikTokを開く」ボタンには、管理者が `/admin` で設定した確率でユーザー入力のURLの代わりに「サプライズの当たりURL」(PayPayの受け取りリンク等)が使われることがある。端末識別Cookie(`dvid`)により、サイト作成者本人の端末・同一アカウントでログイン済みの端末からのアクセスは常にユーザー入力のURLへ100%遷移し、自作自演での不正取得を防ぐ(詳細は下記「サプライズ抽選機能」を参照)。
- 公開ページが閲覧されるたびに `page_views` テーブルへ1行記録され、サイト作成者は `/dashboard/[id]/analytics` で自分のサイトのPV(ページビュー)・UU(訪問者数)・前週/前月比・日別推移グラフを見られる。管理者は `/admin` でジェネレーター全体の利用状況(登録ユーザー数・作成サイト数・全体PV/UU)を見られる(詳細は下記「アクセス解析」を参照)。

### セットアップ

1. Supabaseプロジェクトを作成し、SQL Editorで `supabase/schema.sql` を実行する(`sites` / `known_devices` / `surprise_config` / `page_views` テーブル・RLSポリシー・`site-images` Storageバケットが作成されます)。
2. Supabaseダッシュボードの **Authentication > Providers > Google** を有効化する。Google Cloud ConsoleでOAuthクライアントID/シークレットを発行し、リダイレクトURIにSupabaseが指定するURL(`https://<project>.supabase.co/auth/v1/callback`)を登録すること。
3. `.env.local.example` を `.env.local` にコピーし、SupabaseのURL/anonキー・Service Roleキー・管理者メールアドレス(`ADMIN_EMAILS`)を設定する(`.env.local` は `.gitignore` 済みなのでリポジトリにはコミットされません)。
   ```
   cp .env.local.example .env.local
   ```
4. 依存関係をインストールして開発サーバーを起動する。
   ```
   npm install
   npm run dev
   ```
5. `/login` からGoogleでログインすると `/dashboard` に移動する。「新しいサイトを作成」→編集画面でTikTok風プレビューを直接タップして内容を設定し、「公開する」を押すと `/そのslug` で公開される。
6. `ADMIN_EMAILS` に指定したアカウントでログインすると `/admin` からサプライズ抽選(当選確率・当たりURL)を設定できる。

### 主なページ

| パス | 内容 |
| --- | --- |
| `/` | サービス説明とログイン導線 |
| `/login` | Googleログイン |
| `/dashboard` | 自分のサイト一覧(新規作成・削除) |
| `/dashboard/[id]` | 個別サイトの編集(タップ編集UI) |
| `/dashboard/[id]/analytics` | そのサイトのPV/UU・推移グラフ(サイト作成者本人のみ) |
| `/[slug]` | 公開用ページ(TikTok風レイアウト)。存在しないslugは404 |
| `/admin` | サプライズ抽選(当選確率・当たりURL)の管理画面。`ADMIN_EMAILS` のアカウントのみアクセス可 |

### サプライズ抽選機能

- 各サイトの `content_data.tiktokUrl` はサイト作成者が入力する本来の遷移先。`/admin` で設定した確率が有効な場合、公開ページの訪問者は代わりに運営指定の当たりURLへ遷移することがある。
- 判定はすべて `/[slug]` のサーバー側(`lib/surprise.ts`)で行い、当選確率・当たりURLはService Roleキー(`surprise_config` テーブル、RLSでanon/authenticatedからのアクセスを一切禁止)経由でのみ読み書きされるため、サイト作成者や訪問者からは値そのものを見ることができない。
- 端末識別は `dvid` という長期間有効なCookieで行う(`proxy.ts` → `lib/supabase/middleware.ts` で自動発行)。
  - サイト作成時の端末IDを `sites.creator_device_id` に記録し、公開ページ閲覧時の `dvid` と一致すれば常に本来のURLへ遷移する。
  - ログイン中ユーザーが `/dashboard` にアクセスするたびに、その端末IDを `known_devices` テーブルへ記録する。公開ページ閲覧時の `dvid` がサイト所有者の `known_devices` に含まれていれば、同じく常に本来のURLへ遷移する。
  - Cookie削除やブラウザの使い分けで回避され得る簡易的な識別であり、厳密な不正防止手段ではない点に留意すること。
- `dvid` Cookieが削除された場合の保険として、ブラウザフィンガープリント(`@fingerprintjs/fingerprintjs`、外部通信なしの自前バンドル版)による補助判定も行う。
  - ダッシュボードの読み込み時に端末のフィンガープリントを計算し、`known_fingerprints` テーブルへ記録する(`components/FingerprintRecorder.tsx`)。サイト作成時にも作成端末のフィンガープリントを `sites.creator_fingerprint` に保存する。
  - 公開ページ読み込み時、`/fp.js`(`public/fp.js`、`npm install` 時に自動生成)でフィンガープリントを計算し `/api/visit` へ送信する。作成者本人・同一アカウントの端末と一致した場合のみ本来のURLに上書きする(一致しない場合は何も起きず、抽選結果にも一切影響しない)。
  - この照合は「TikTokを開く」ボタンをタップした瞬間に間に合うよう非同期でバックグラウンド実行され、一般の閲覧者には見た目・挙動の変化は一切ない。フィンガープリントもCookie同様100%の精度を保証するものではなく、あくまで保険的な補助策。

### アクセス解析

- 公開ページ(`/[slug]`)が閲覧されるたびに、`app/[slug]/route.ts` がレスポンス送信後(`next/server` の `after()`)に `page_views`(`site_id` / `device_id` / `viewed_at`)へ1行記録する。検索エンジン等の主要クローラーはUser-Agentで簡易的に除外する(`lib/analytics.ts` の `isLikelyBot`)。
- **サイト作成者向け**(`/dashboard/[id]/analytics`): 自分のサイトのPV(ページビュー)・UU(`device_id`のユニーク数)を、過去7日間/過去30日間で切り替えて確認できる。直前の同じ長さの期間との比較で増減率バッジ(「↑15%」等)を表示し、日別の推移を面グラフで表示する。読み取りはRLSにより「自分が所有するサイトの `page_views` のみ」に制限されている(`page_views` の SELECT ポリシー参照)。
- **管理者向け**(`/admin`): 全サイト合算のPV/UUに加えて、登録ユーザー数・作成サイト数を表示する。`ADMIN_EMAILS` のアカウントのみアクセス可能。
- 集計ロジックは `lib/analytics.ts`(`getSiteAnalytics` / `getGlobalAnalytics`)に集約し、グラフ表示は `components/TrendChart.tsx`(単一系列の面グラフ、ホバー/タップでツールチップ表示)・`components/StatCard.tsx`・`components/AnalyticsPanel.tsx`(期間切り替え)で行う。

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
