# Tiktok-generater

## profile-saas (Next.js + Supabase)

TikTok風プロフィールページをGoogleアカウントでログインして作成・公開できるツールです。リポジトリ直下の `app/`, `lib/`, `components/`, `supabase/` がこのアプリ本体です(旧Cloudflare Worker版とは独立して動作します)。

### アーキテクチャ

- 認証はSupabase Auth(Googleログインのみ)。ログインセッションはCookieに保存され、ブラウザを閉じても次回アクセス時に自動で復元される。
- 1人のユーザーが複数のサイトを作成できる。`/dashboard` がマイページで、自分のサイトの一覧・新規作成・削除ができる。
- Row Level Security (RLS) が前提で、各ユーザーは自分の `sites` レコードしかINSERT/UPDATE/DELETEできない(`supabase/schema.sql` 参照)。閲覧(SELECT)は`/[slug]`の公開ページ用に全員へ許可している。
- `/[slug]` へのアクセス時にDBから取得して1つの共通テンプレート(旧Cloudflare Worker版のTikTok風レイアウトを移植)で動的にレンダリングする。
- 編集中の内容は、保存ボタンを押すまでの間 `localStorage`(テキスト)/`IndexedDB`(画像)にも「ユーザー+サイト」単位で端末に自動保存される。保存ボタンを押すまでは下書き扱いで、押すとDBへ反映される。
- 公開ページの「TikTokを開く」ボタンには、管理者が `/admin` で設定した確率でユーザー入力のURLの代わりに「サプライズの当たりURL」(TikTok Liteの招待リンク)が使われることがある。端末識別Cookie(`dvid`)により、サイト作成者本人の端末・同一アカウントでログイン済みの端末からのアクセスは常にユーザー入力のURLへ100%遷移し、自作自演での不正取得を防ぐ(詳細は下記「サプライズ抽選機能」を参照)。
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
| `/tools/link-generator` | リンクジェネレーター(招待リンクの展開・ディープリンクのサニタイズ)。`?to=` 付きで開くとクッションページとして動作する |
| `/admin` | サプライズ抽選(当選確率・当たりURL)の管理画面。`ADMIN_EMAILS` のアカウントのみアクセス可 |

### リンクジェネレーター (`/tools/link-generator`)

単独で動いていたツール(`index.html` 1ファイル + Cloud Run上のStealth API)をこのアプリへ取り込んだもの。

- **2モード**: 単独版と同じく1つのURLで分岐する。`?to=` なしならビルダー(生成フォーム)、`?to=<url>` 付きならクッションページ(1〜2秒の遅延後に遷移先へ飛ばす黒画面)。
- **コアロジック**: Stealth APIへのFetch・URLオブジェクトの再構築・`DEEPLINK_PARAMS` によるサニタイズは `lib/link-generator.ts` に単独版のまま移植してある(コメント含めて挙動は不変)。UI(`link-generator-form.tsx`)は入力値の受け渡しと表示だけを担当する。
- **端末ごとの遷移先**: `af_ios_url`(iOS) / `af_android_url`(Android) / `af_ipad_url`(iPad) / `af_web_dp`(PC) を付与する。
  - `af_ipad_url` は `af_ios_url` と同じ値が自動でセットされる。iPadOSのSafariは既定で「デスクトップ用サイトを要求」するためUserAgentがmacOSと見分けがつかず、AppsFlyer側がiOS端末として扱ってくれない。指定が無いとOneLinkの既定のWeb遷移先(サイトのトップページ)が開いてしまうため。
  - `af_web_dp` はPC(Windows/Mac)から踏まれたときの遷移先で、フォームの「af_web_dp(PC向け遷移先)」に任意のURL(キャンペーンLP等)を入力する。空欄なら付与しない。なお `af_web_dp` は `DEEPLINK_PARAMS` にも含まれるため、リンク元に埋まっていた値は一度除去され、入力した値だけが最終的に残る。
- **抽出結果がOneLinkでなければエラーで止める**: 以前は「OneLink テンプレート」欄の値でドメイン＋パスを差し替えるフォールバックを持っていたが、廃止した(`assertOneLink()`)。実物の招待リンクは `https://snssdk1180.onelink.me/BAuo/999140ec` のように「テンプレートID + ショートリンクID」の2セグメント構成で、後半はシェアごとに異なる。さらにこのリンクのクエリには `pid` も `c` も無く、AppsFlyer側(ショートリンク)がサーバー側に保持していると考えられる。つまりテンプレートへの差し替えは「他人のリンクに別のショートリンクを当てる」処理であり、アトリビューション設定ごと失った不完全なリンクを生む。黙って壊れたリンクを配るより、生成を止めて作り直させるほうが安全。
  - パスに**ショートリンクID**が付いている場合(`/BAuo/999140ec`)は、それを外してロングリンク化する(`toLongLink()`)。ショートリンク側はAppsFlyerのサーバーに設定を持ち、その設定がクエリより優先されると `af_ios_url` / `af_dp` が無視されて通常版TikTokのWebページが開いてしまうため。テンプレートID(`/BAuo`)は残す。
  - ロングリンク化するとショートリンク側の `pid` も失われる。AppsFlyerは `pid` の無いクリックを原則アトリビュートしないため、`pid` が無い場合に限り同じ値を指す `media_source` / `inc_pid` から補完する。`u_code` / `share_page_data` はクエリ側にあるので影響を受けない。
- **成果計測パラメータの完全保護**: 実物の招待LPの `universal-data`(`app_context.query` の全36キー)を分類して同定した20件を `TRACKING_PARAMS` として定義し、生成の最後に `assertTrackingPreserved()` で入力と出力を突き合わせる。1つでも欠けていれば例外で止める。サニタイズは削除リスト方式なので、リストを編集したときに計測用のキーを巻き込んでも気づけない。「100%保護」を願望ではなく保証にするための仕組み。
  - 対象: `u_code` / `share_page_data` / `share_app_id` / `share_link_id` / `media_source` / `inc_pid` / `gd_label` / `utm_source` / `utm_campaign` / `ug_launch_category` / `share_time` / `sharer_biz` / `share_position` / `share_region` / `share_scene` / `share_type` / `share_enter_from` / `sharer_os` / `aid` / `region` / `_d` / `pid`
- **中間ページ描画パラメータの除去**: `__status_bar` / `_pia_` / `_svg` / `enable_canvas` / `enable_canvas_optimize` / `hide_nav_bar` / `should_full_screen` に加え、招待LPのOGPカードを描画するための `og_desc_text` / `og_image` / `og_title_text` を `INTERSTITIAL_PARAMS` として除去する。いずれも招待LPの表示にしか使われず、アトリビューションにも紹介元の特定にも関与しない(`og_image` は133文字あり、URLを無用に膨らませる)。
- **フォールバック先は削除せず明示的に上書きする**: `fallback_url` / `af_ios_fallback` / `af_android_fallback` / `af_web_dp` は、除去したうえでLite版のストアURLを入れ直す。削除するだけだとOneLinkテンプレート側(AppsFlyerのサーバー設定)の既定値が発動し、通常版TikTokのWebページへ落ちてしまうため。`af_web_dp` は「PC向け遷移先」欄が入力されていればそちらを優先する。
  - これらのキーは除去対象と非対象が混在するため、いったん全部消してから決まった順に入れ直して並び順を固定している(同じURLを再保存したときに文字列が一致するようにするため)。
- **Refererの匿名化**: 遷移先へこのサイトのドメインをRefererとして渡さない。クッションページ・公開ページ(ON/OFF両方)の `<head>` に `<meta name="referrer" content="no-referrer">` を入れ、リンクにも `rel="noreferrer noopener"` を付けている。metaタグは `location.replace()` による遷移にも効く。
- **TikTok Lite の OneLink に載せ替える**: 招待リンクが載っている `snssdk1180.onelink.me` は**通常版TikTok**のOneLinkドメインで、iOSのUniversal Link / AndroidのApp Link として通常版アプリに関連付けられている。通常版がインストールされた端末では、**OSがWebページを読み込む前にURLを横取りして通常版を起動する**。`af_dp` などのクエリパラメータは評価すらされないため、パラメータ側では防ぎようがない。ホストとパスを Lite 側の `snssdk473824.onelink.me/4P4E` へ載せ替えることでのみ解決する。
  - `4P4E` は TikTok自身が Lite の紹介キャンペーンで使っているOneLinkで、`pid` / `c` も招待リンクと同じ(`coin_referral_onelink_scan_code_support_mentor` / `UG_Referral_JP`)であることを実物のLPで確認済み。
  - 載せ替え時は `af_dp` に **TikTok自身と同じ形のディープリンク**を入れる。

    ```
    af_dp = snssdk473824://roma_redirect/?params_url=<招待LPのURL + 識別子>
    ```

    単なるスキーム(`snssdk473824://`)だけだと**アプリが起動するだけで「誰の紹介か」がアプリに伝わらない**(実機でLiteは開くが招待トラッキングが消える、という不具合が実際に起きた)。TikTok自身は `params_url` のクエリに `u_code` / `share_page_data` などの識別子を載せてアプリへ渡しており(実物のLPのHTMLで確認)、同じ構造で組み立てる。`params_url` が指す招待LPのURLは `INVITE_LP_URL` に定数として切り出してある(キャンペーンが変わるとパスも変わりうるため)。
  - **`params_url` にはサニタイズ「前」の元のクエリを載せる。** サニタイズ(`DEEPLINK_PARAMS` / `INTERSTITIAL_PARAMS` の除去)はOneLink側のWeb遷移を止めるためのもので、アプリ内へ渡すペイロードとは文脈が違う。実物のHTMLでは TikTok自身が `inc_target_url`(`aweme://roma_redirect/...`) / `is_inc_roma` / `incentive_redirect` を含む66件すべてをアプリへ渡しており、これらは招待インセンティブの識別子そのもの。ここで削ると「Liteは開くが誰の紹介か分からない」状態になる(実機で発生した)。
  - 除くのは `is_retargeting`(TikTokも渡していない)と、こちらが足したAppsFlyer用のキー(`MANAGED_PARAMS`)だけ。
  - TikTok自身が必ず付けているアプリ内コンテナの設定値(`spark_page` / `use_spark` / `bdhm_bid` / `needlaunchlog` / `ug_medium` / `disable_ttnet_proxy` / `use_mutable_context`)を `LITE_DEEPLINK_CONTEXT` として再現する。招待LPのクエリには含まれず、リンク生成側で付けている固定値。
  - **再保存しても削れない**: 生成済みURLをもう一度通すとき、OneLink側のクエリは既にサニタイズ済みで `inc_*` が落ちている。そのまま作り直すと再保存のたびにアプリ用のデータが削れるため、`recoverAppParams()` で前回の `af_dp` の `params_url` から元のクエリを復元し、現在のクエリを上書きで重ねる(5回再保存してもキー構成・URL長が変わらないことを検証済み)。
  - `is_retargeting` の除去も `af_dp` の組み立て前に行う。後回しにすると既存URLに焼き付いていた値が `params_url` 経由でアプリまで渡ってしまう。
  - Liteがインストール済みなら `af_dp` でLiteが開き、未インストールなら `af_ios_url` / `af_android_url` のストアへ落ちる。
  - クエリ(`u_code` / `share_page_data` / `media_source` / `pid` 等)はすべてそのまま引き継ぐ。
  - フォームのチェックボックスでOFFにすると従来どおり元のドメインのまま生成し、`af_dp` は空文字(通常版の起動ブロック)になる。挙動を比較したいときに使う。
- **`is_retargeting` は付与せず、必ず除去する**: AppsFlyerはこれが `true` だとクリックを「リターゲティング(再エンゲージメント)」として記録する。招待報酬は「新規インストール＋初回起動」で発火するのが前提なので、リターゲティング扱いになると発火条件を外れて報酬が付かない恐れがある。TikTok Liteの招待リンクにはそもそも `is_retargeting` が入っていないため、付与していたのはこちら側だった。
  - うっかりONにする事故を防ぐため、フォームのチェックボックスと `BuildOptions.retargeting` ごと廃止した。
  - 除去は `stripDeepLinks` のON/OFFに関係なく常に実行する。この対応より前に生成した(`is_retargeting=true` が焼き付いた)URLを再保存したときに確実に落とすため。
- **クッションページのON/OFF**: フォームのチェックボックスで切り替える。切り替えているのは最終出力URLだけ(`resolveOutputUrl()`)で、サニタイズ処理には影響しない。
  - ON … `/tools/link-generator?to=<サニタイズ済みURL>` を出力する(従来どおり)。
  - OFF … サニタイズ処理を通過した直後の直接遷移先URLをそのまま出力する。
- **OGP**: クッションページのURLをSNS/メッセージアプリでシェアしたときのカード表示は、`page.tsx` の `generateMetadata`(`og:title` / `og:description`)と `opengraph-image.tsx`(1200×630のカード画像を動的生成)で出力する。分岐をサーバー側で行っているのは、JSを実行しないクローラーにもメタタグを見せるため。文言はページ冒頭の `CUSHION_OG_TITLE` / `CUSHION_OG_DESCRIPTION` で変更できる。
- **必要な環境変数**: `NEXT_PUBLIC_SITE_URL`(og:imageを絶対URLに展開するための本番ドメイン)、`NEXT_PUBLIC_STEALTH_API_HOST`(Stealth APIのURL。未設定なら既定のCloud RunサービスURL)。どちらも `.env.local.example` に記載してある。

| ファイル | 役割 |
| --- | --- |
| `lib/link-generator.ts` | 抽出・サニタイズのコアロジック(単独版からの移植)+ 出力URLの出し分け |
| `lib/clipboard.ts` | コピー処理(iOS Safari向けのフォールバック付き) |
| `app/tools/tools-shell.tsx` | `/tools/*` 共通のヘッダー・フッター |
| `app/tools/link-generator/page.tsx` | ルーティング・モード分岐・OGPメタタグ |
| `app/tools/link-generator/link-generator-form.tsx` | ビルダー画面(フォーム・結果表示) |
| `app/tools/link-generator/cushion-relay.tsx` | クッションページ(遅延リダイレクト画面) |
| `app/tools/link-generator/opengraph-image.tsx` | シェア時のカード画像 |

### サイト編集画面からの利用(クッションページの有無)

サイト編集画面(`/dashboard/[id]`)の「TikTok Liteの招待リンク(ボタンの遷移先)」欄に、サイトごとの「クッションページを挟む」チェックボックスがある。設定は `content_data.useCushionPage` に保存する。

この設定が決めるのは**公開ページを表示するかどうかだけ**で、遷移先URLの最適化には影響しない。

| 設定 | 公開ページ(`/[slug]`)の挙動 |
| --- | --- |
| **ON**(既定) | TikTok風ページを表示し、ボタンのタップで遷移先へ移動する(従来どおり)。 |
| **OFF** | TikTok風ページを表示せず、アクセスした人を遷移先へ直接送る。 |

**ON/OFFに関わらず**、保存時に入力されたURLへ `generateDestinationUrl()`(展開＋サニタイズ)を適用し、その結果を `content_data.tiktokUrl` に保存する。訪問者が最終的に踏むURLが未サニタイズでよい理由は無いため。生成結果は入力欄にも反映され、何が公開されるか目視できる。

そのため遷移先URLの欄には **TikTok Liteの招待リンク(または `*.onelink.me` のURL)しか保存できない**。それ以外のURLは変換に失敗し、保存が中断される。

#### OFFのときの公開ページ

`app/[slug]/route.ts` が `renderViewerHtml()` ではなく `renderRedirectHtml()`(`lib/tiktok-viewer.ts`)を返す。

単純な HTTP 302 にはしていない。リダイレクトするとSNSのクローラーまで遷移先へ飛んでしまい、サイトに設定したOGPタイトル・OGP画像ではなく遷移先のカードが表示されてしまうため。クローラーはJSを実行しないので、OGPタグを含むHTMLを返したうえで `location.replace()` で飛ばすことで、カード表示と自動遷移を両立させている(同じ理由で `meta http-equiv="refresh"` も使っていない。追従するクローラーがいるため)。JSが無効な環境では `<noscript>` の手動リンクが避難口になる。

PV/UUの記録とサプライズ抽選(`resolveDestinationUrl()`)はONのときと同じく動作する。

フィンガープリントによる作成者判定(`/api/visit`)も働く。ONの版が「TikTokを開く」のタップ時に照合するのに対し、OFFの版はタップを挟まないため、**遷移の直前に照合結果を待つ**。照合が終わり次第すぐ遷移し(実測 約300ms)、遅くとも `WAIT_MS`(1.5秒)で打ち切って遷移する。これにより、`dvid` Cookieを削除された場合でも作成者本人・同一アカウントの端末には当たりURLが出ない。

**手動リンク(「タップして続行」)は出さない。** 以前は自動遷移が働かなかった場合の避難口として4.5秒後に表示していたが、遷移自体は始まっているのに遷移先(OneLink)の応答が遅いだけのケースでも出てしまい、実機で「タップして続行」が見えていた。現在はタップ無しで飛ばし、JSが無効な環境向けの `<noscript>` だけ残している(クッションページも同じ)。

遷移手段は重ねがけしない。`location.replace()` が「効いていないのではなく遷移先の応答が遅いだけ」のときに別の遷移をかけると、進行中の遷移を中断してかえって到達が遅れるため。まず1回だけ投げ、本当に何も起きなかった場合の保険として `RETRY_MS`(6秒)後にもう一度だけ試す。このリトライはページ離脱(`pagehide` / `beforeunload`)が始まった時点で取り消すので、遅いだけの遷移を中断することはない。

照合を「当選したときだけ」待つ実装にはしていない。待ち時間の有無で当選したことが分かってしまい、抽選機能の存在を訪問者に示唆することになるため。

#### 当たりURLの最適化

当たりURLにもリンクジェネレーター(展開＋サニタイズ)を通したものを使う。当たりURLは全サイト共通のグローバル設定(`surprise_config`)なので、次の2つを持たせている。

| 列 | 中身 | 使う場面 |
| --- | --- | --- |
| `prize_url` | 管理者が `/admin` で入力したURL | 入力値の記録用(配信には使わない) |
| `prize_url_optimized` | `prize_url` にジェネレーターを適用した結果 | **全サイト**(クッションページの有無に関わらず) |

変換は `/admin` での保存時に一度だけ行う(`updateSurpriseConfig()`)。訪問者のアクセスごとに変換すると、当選した人ほどStealth APIの応答(コールドスタート時は最大60秒)を待たされるため、待ち時間は管理者の保存操作の側に寄せている。変換に失敗した場合は保存自体を行わない(生のURLだけ更新されると、未サニタイズのURLが当たりとして配られてしまうため)。

`prize_url_optimized` が未設定の行(この対応より前に保存されたもの)は `prize_url` にフォールバックするので、抽選が黙って止まることはない。

当たりURLはTikTok Liteの招待リンクであることが前提。ジェネレーターはTikTokのLPからOneLinkを抽出する専用の仕組みなので、それ以外のURL(PayPayの受け取りリンク等)を入れると変換に失敗する。

#### OFFのときの編集画面

公開ページを表示しなくなるため、TikTok風ページの見た目に使う設定は不要になる。欄ごと消すと入力済みの内容が失われたように見えるので、**暗くして操作だけを止める**(値・画像・下書きはそのまま保持され、ONに戻せば元どおり編集できる)。

| 項目 | ON | OFF |
| --- | --- | --- |
| 公開URL(slug) / 遷移先URL / OGPタイトル / OGP画像 | 必須・編集可 | 必須・編集可 |
| 背景画像 / アプリアイコン画像 | 必須・編集可 | 任意・暗くして操作不可 |
| プレビュー(ユーザー名・説明・各カウント・ページインジケーター等) | 編集可 | 暗くして操作不可 |

- `useCushionPage` が未設定の既存サイトはONとして扱うため、これまでに作成されたサイトの挙動は変わらない。
- 処理は「入力がOneLink形式ならサニタイズのみ」「そうでなければStealth APIで展開してからサニタイズ」。同じURLを再保存しても結果は変わらない(冪等)。
- 展開・サニタイズに失敗した場合(例: `https://www.tiktok.com/@username` のようにOneLinkへ展開できないURL)は**保存を中断**してエラーを表示する。これはON/OFFどちらでも同じ。未サニタイズのURLがそのまま公開されるのを防ぐため、画像のアップロードより前に実行している。
- OGPタイトル(`sites.title`)・OGP画像(`content_data.images.ogpImage`)はこの処理の影響を受けず、従来どおり保存される。

### サプライズ抽選機能

- 各サイトの `content_data.tiktokUrl` はサイト作成者が入力する本来の遷移先。`/admin` で設定した確率が有効な場合、公開ページの訪問者は代わりに運営指定の当たりURLへ遷移することがある。当たりURLはクッションページの有無で使い分ける(上記「当たりURLの最適化」を参照)。
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
