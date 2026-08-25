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

- **2モード**: 単独版と同じく1つのURLで分岐する。`?to=` なしならビルダー(生成フォーム)、`?to=<url>` 付きならクッションページ(タップで遷移先へ送る黒画面)。
- **コアロジック**: Stealth APIへのFetch・URLオブジェクトの再構築・`DEEPLINK_PARAMS` によるサニタイズは `lib/link-generator.ts` に単独版のまま移植してある(コメント含めて挙動は不変)。UI(`link-generator-form.tsx`)は入力値の受け渡しと表示だけを担当する。

#### 生成方式は2つ。既定は「招待LP直結」

実機での実測により、**公式の招待リンクの実体は OneLink ではなく招待LPそのもの**だと判明した。
`https://lite.tiktok.com/t/XXXXXXXX/` を iOS Safari のアドレスバーで展開すると、着地するのは

```
https://www.tiktok.com/ug/incentive/share/pro_scan_code?...&u_code=...
```

で、`af_dp` / `af_ios_url` / `af_force_deeplink` / `wid` / `pid` といった **AppsFlyer用のキーは1つも無い**。
代わりに入っているのが次の3つで、これが「アプリを開く／ストアへ送る」を決めている仕組みそのものだった。

```
inc_target_url     = aweme://roma_redirect/?spark_page=scan_code
incentive_redirect = 1
is_inc_roma        = 1
```

つまり分岐を担っているのは AppsFlyer ではなく **LP側のJS**。
`universal-data` から拾える OneLink(`BAuo`)は、LPが内部に持っている「他人に共有するための」リンクであって、
公式リンクの実体ではなかった。ここを取り違えていたために、次が同時に起きていた。

- 通常版TikTokのOneLink(`BAuo`)を土台にしてしまい、Universal Linkで通常版が起動する
- `4P4E` へ載せ替えても `wid` / `c` はショートリンク側のサーバー設定にあるため再現できない
- LPがアプリを開くための仕掛けである `inc_target_url` / `incentive_redirect` / `is_inc_roma` を、
  `DEEPLINK_PARAMS` として削除していた

「`onelink.me` で止まり『TikTok Liteを開く』ボタンが出る」症状の原因はこれ。
対策は **中身を組み立て直さないこと**。TikTok自身が配っているパラメータをそのまま運ぶ。

#### ワンクリック招待の実体は、LPが内部に持っているラッパーだった

招待LPのHTMLには、TikTok自身がアプリを開くために使っている設定が埋まっている
（`tiktok.share.api/tiktok/linker/component/strategy/get/v1/`）。18個ある wrapper はどれも同じ形をしている。

```json
"launch_type": "tiktok_lite_app",
"wrapper_url": {
  "url_fallback": "https://snssdk473824.onelink.me/4P4E?domain_source=tiktok&af_dp={{schema}}",
  "url_schemes": ["snssdk473824://roma_redirect/?params_url=<招待LPのURL(36キー)>&spark_page={{url}}"]
}
```

**招待LPのURLをそのまま配ってもアプリは起動しない**（X / Safari の両方で確認済み。TikTok公式の
招待リンクも同じ挙動）。タップでアプリが起動することを実機で確認できているのは、
このラッパー（`4P4E` + `af_dp`）を被せた形だけ。`4P4E` は TikTok Lite の Universal Link なので、
タップした瞬間にOSがURLを横取りしてアプリへ渡す。

##### 一度これで「アプリは起動するが招待ページが開かない」状態になった原因

最初にラッパーを実装したとき、`af_dp` の中身を自前で組み立てていた。実物のLPにある
TikTok自身のスキームと突き合わせたところ、**3点で構造が違っていた**。

| | TikTok自身 | 当時の実装 |
|---|---|---|
| `spark_page` | `params_url` の**兄弟キー** | `params_url` の**中**に混入 |
| `params_url` のキー | LPのクエリ36キーちょうど | **+8キー捏造**（`use_spark` / `bdhm_bid` / `pid` 等） |
| `inc_target_url` | `aweme://` のまま | `snssdk473824://` へ書き換え |

`&spark_page={{url}}` は「URLを入れる場所」ではなく、招待LPが `inc_target_url`
（`aweme://roma_redirect/?spark_page=scan_code`）として持っている値を入れる場所だった。
場所も値も外したまま配っていたので、アプリ側が解釈できず招待ページに到達できなかった。

現在は `buildLiteDeepLink()` が `url_schemes` と同じ構造で組み立てる。
**実物のLPから採取した TikTok自身のスキーム文字列と、生成結果が1バイトも違わないこと**を
検証してある（2894文字が完全一致）。

- `params_url` は招待LPのURLを**そのまま**載せる。並び順もエンコードも変えない
- `spark_page` は `sparkPageOf()` が `inc_target_url` から読む（キャンペーンが変わっても追随する）
- `inc_target_url` は書き換えない。どのアプリが開くかは外側で既に Lite に決まっている
- 外側に載せるのは `domain_source` と `af_dp` の2つだけ。ストアへの振り分けは
  AppsFlyer側（4P4Eテンプレート）のサーバー設定が持つので `af_ios_url` などは足さない

| 方式 | 条件 | 何をするか |
|---|---|---|
| **`wrapper`（既定・推奨）** | 土台が招待LPのURL（`isInviteLpUrl()`）で `forceLite` ON | TikTok自身と同じ `4P4E?domain_source=tiktok&af_dp=<スキーム>` を組み立てる |
| `lp`（比較・切り分け用） | 土台が招待LPのURLで `forceLite` OFF | 招待LPのURLをそのまま返す。**タップしてもアプリは起動しない** |
| `onelink`（フォールバック） | 土台がOneLinkのURL | 従来どおり `4P4E` へ載せ替えて `af_dp` を組み立てる |

壊れた構造のまま保存されてしまったURLは、`buildUrl()` が `unwrapLiteWrapperUrl()` で
中の `params_url` を取り出し、捏造キー（`LEGACY_INJECTED_PARAMS`）を落として
`inc_target_url` を `aweme://` へ戻したうえで組み立て直す（＝保存し直すだけで直る）。
描画用パラメータは**落とさない**。これはLPが元から持っているクエリで、
欠けると「アプリは起動するが招待ページが開かない」状態になる。

サニタイズは削除リスト方式なので、リストを編集したときに必要なキーを巻き込んでも気づけない。
`assertOfficialParamsPreserved()` が「入力に在ったキーは全部残っていること」を直接検証し、
1つでも欠けていれば生成を中断する（`TRACKING_PARAMS` / `INCENTIVE_PARAMS` のような
リストに載っていない描画用パラメータもこれで守られる）。

- **招待LPのURLは、`inc_target_url` のスキーム以外を一切改変しない**（`buildLpUrl()`）。一度はここで「描画用パラメータ（`INTERSTITIAL_PARAMS`）を10件削除」も同時に行っていたが、**どちらも推測に基づく改変で、実機で検証していなかった**。結果として公式リンクとの差分が11箇所ある状態でURLを配っており、実機で「アプリが起動せず、ただ招待LPがブラウザで開くだけ」になっていた。アプリを開くかどうかを決めているのはLP側のJSなので、そのJSが読む可能性のあるパラメータを消せば判断が変わっても不思議はない。**削除はすべて取りやめた。**
  - 唯一残した差分が `inc_target_url` のスキーム差し替え（`aweme://` → `snssdk473824://`、`forceLite` オプション）。公式のままだと通常版TikTokと Lite の両方が入った端末で通常版が開いてしまうため。パス・クエリには触らず先頭のスキームだけを置換する。「誰の招待か」は LP のクエリ（`u_code` / `share_page_data`）が運んでいて `inc_target_url` のクエリには乗っていないので、招待の成立には影響しない。
  - **差分を意図的に1点だけに絞ってある。** 以前は削除と差し替えをまとめて戻したため、どちらが原因か切り分けられなかった。今の形なら、万一また実機で挙動が変わったら原因は `inc_target_url` だと確定できる。`forceLite` を OFF にすれば公式と1バイトも違わないURLになるので、その場で比較できる。
  - `BuildResult.liteForced` に差し替えの有無が入り、ツールの結果画面にも「公式との差分はこの1点だけ」と表示される。
  - 落とすのは**こちらが過去に付けたキーだけ**（`MANAGED_PARAMS` と `is_retargeting`）。TikTokが出すLPのURLにこれらが載ることはないので、公式のURLには影響しない。
  - 何も変えていなければ URL を組み立て直さず入力の文字列をそのまま返す。`URLSearchParams` を経由すると並び順やパーセントエンコードが変わりうるため、「公式と1バイトも違わない」ことを保証するにはこの分岐が必要。
  - `stripDeepLinks` は `lp` 方式では効かない。
  - ジェネレーターの価値は「短縮リンクを展開して実体を取り出すこと」にあり、中身をいじることではない。展開だけでも、短縮リンクが通常版TikTokの Universal Link に横取りされる問題は解消する。
- **短縮リンクは自前で展開する**(`followRedirects()` / `app/api/expand/route.ts`): 公式の招待リンクは
  ただのリダイレクトで招待LPへ着地するので、Puppeteer(Stealth API)を経由する必要がない。
  Stealth API は `universal-data` から「共有用のOneLink」を取り出す実装のため、公式リンクの実体である
  LPのURLは返してくれない。ブラウザからはクロスオリジンのリダイレクトを追えないので、
  同一オリジンの `/api/expand` を挟む。
  - リダイレクトは `redirect: 'manual'` で1ホップずつ追う。許可ホストの外(App Store等)へ出る手前で止め、
    着地先が1.5MB近い招待LPでも本文を読まずに済ませるため。最大10ホップ。
  - 取りに行けるのは `tiktok.com` / `tiktokv.com` / `onelink.me` のみ(`EXPANDABLE_HOST_RE`)。
    任意のURLを取得させないため(SSRF対策)。返すのは最終URLだけで、本文は返さない。
  - 展開に失敗した場合(JS経由の遷移など)だけ、従来どおり Stealth API へフォールバックする。

#### どの環境でも「利用者のタップ」を経由させる

**アプリを開けるかどうかを決めているのは、URLの形ではなく遷移のさせ方だった。**

実機で分かっている範囲は次のとおり（推測を混ぜない）。

| 環境 | 招待LPのURLをタップ | 備考 |
|---|---|---|
| X のアプリ内ブラウザ | **アプリが起動し招待も成立** | 「自身を招待できません」が出る＝トラッキング成功 |
| LINE / Instagram など | 生の招待LPがブラウザで開くだけ | **TikTok公式の招待リンクも同じ**（実機で対照確認済み） |
| Safari | 成功した記録が無い | 同上と思われるが未確認 |

重要なのは2行目で、**公式の招待リンクと挙動が一致している**こと。
その環境で開かないのはこちらのURLの作りが悪いからではなく、TikTok自身も開けていない。
**URLを作り替えて解決できる問題ではない。**

加えて、JS遷移（`location.href` / `location.replace`）とサーバーの 301/302 では iOSはそもそも
Universal Link を発火させない。公式の招待リンク（`https://lite.tiktok.com/t/XXXX/`）を踏んでも
アプリが起動しないのは、短縮リンクがリダイレクトで招待LPへ着地するためでもある。
**つまりアプリが開く可能性があるのは「利用者がタップしたとき」だけで、自動遷移させている限り可能性はゼロになる。**

一時期この分岐は「アプリ内ブラウザだけタップに委ね、通常のブラウザでは `location.replace()` で自動遷移」という形だった。
後者は上記のとおり原理的にアプリが開かず、実機で「生のURLが開くだけ」になっていた。
カスタムスキーム（`snssdk473824://`）を直接叩くのをやめた時点で自動遷移にする理由も無くなったので、
**全環境でタップを経由させる**（カスタムスキームを直接叩いていた頃は、iOSが「"TikTok Lite"で開きますか？」の
確認ダイアログを出し、そこから開くとアトリビューションが切れることが実機で判明していた）。

画面は黒一色（`#000`）。スピナーもプログレスバーも出さない。Xのアプリ内ブラウザは黒背景なので、装飾を足さないほうが「読み込み中の画面」として自然に見える。画面全体（`position:fixed; inset:0`）が1枚の `<a>` になっている。

```
1. 真っ黒な画面のまま2秒待つ（IAB_HOLD_MS）。テキストもスピナーも出さない
2a. 2秒以内にタップされたら、そのジェスチャーで <a> が遷移する
2b. タップが無ければ「エラーが発生しました。タップして再実行」だけを中央に表示
3.  その後タップされたら、同じく <a> が遷移する
4.  通常のブラウザに限り、6秒（WEB_FALLBACK_MS）たっても
    タップされなければ location.replace() で遷移先へ送る（最後の保険）
```

- **`<a href>` に入れるURLは環境で出し分ける（`launchHref()`）。** 判定は**サーバー側**で UserAgent から行う（`href` はDOM構築の時点で確定していなければならないため）。

  | 環境 | `href` | 理由 |
  |---|---|---|
  | アプリ内ブラウザ（X など） | **カスタムスキーム**（`snssdk473824://roma_redirect/?params_url=...`） | https のラッパー（Universal Link）だと、アプリは起動し招待ページも描画されるが**招待トラッキングが成立しない**（実機で確認）。Universal Link で開くとOSはHTTPリクエストを一切行わずURLをアプリへ渡し、アプリ側は AppsFlyer 経由の起動として解釈するため、招待の文脈がそこで解決し直される。カスタムスキームならアプリのディープリンクハンドラが `params_url` を直接受け取る |
  | 通常のブラウザ（Safari など） | **https のラッパー** | カスタムスキームを踏むとiOSが「"TikTok Lite"で開きますか？」の確認ダイアログを出し、そこから開くとアトリビューションが切れる（実機で確認済み） |

  アプリ内ブラウザでは、利用者の物理タップがあれば WKWebView がカスタムスキームをOSへ渡すので、確認ダイアログを挟まずアプリが開く。
- **アプリ内ブラウザでは、リンクにJSを一切紐づけない。** リスナーも張らないし、タップ由来のタイマーも持たない（`startLiteLaunch()` は `inApp` なら早期 return する）。WKWebView がカスタムスキームをOSへ渡すのは「純粋な物理タップ」に対してだけで、タップにJSが紐づいているとアプリ起動の判定に割り込んでしまう。
  - 一度、未インストール端末向けに「タップ後2.5秒で https のラッパーへ逃がす」保険を入れたことがあるが、**アプリ起動の判定中にそれが発火して `onelink.me` で止まる**という不具合を実機で起こした。保険ごと撤廃してある。
  - **未インストール端末はスキームを踏んでも何も起きないが、それは許容する。** このツールは「インストール済みの利用者を、招待の文脈を保ったままアプリへ渡す」ことに振り切ってチューニングしてあり、そのためにタップの純度を最優先する。
  - 2秒後のエラー文言だけは出す。これはリンクにもタップにも紐づいておらず、`<span>` の `hidden` を外すだけなので遷移には影響しない。
- **遷移は `<a>` のネイティブな挙動に任せる。** スクリプトで遷移させるとユーザー操作の文脈から外れ、**Universal Link が発火しなくなる**ため。アプリ内ブラウザ（WKWebView）からOSへ処理を渡してもらうには、純粋な物理タップとして解釈される必要がある。この `<a>` は次の3つを必ず満たすこと。
  1. **`target="_top"` を持つ。** フレーム内に閉じ込めず、最上位のコンテキストで辿らせる。
  2. **`click` / `touchstart` で `preventDefault()` を呼ばない。** JSでルーティングしない。リスナーはタイマーを止めるだけで、遷移には一切関与しない。
  3. **`href` はDOM構築の時点で入っている**（サーバー側 / JSX側でセット済み）。**JSからは上書きしない**（`startLiteLaunch()` は `href` が空のときだけ補う）。タップの瞬間に `href` を差し替えると、スクリプト由来のナビゲーションとみなされうる。
- **最後の保険（4.）ではアプリは開かない。** JS遷移なので Universal Link は発火せず、招待LPがブラウザで開くだけ。それでも黒い画面のまま放置されるよりはよい、という位置づけ。タップされたらタイマーごと取り消す。
- **アプリ内ブラウザ（X など）ではこの保険を張らない。**（`IN_APP_BROWSER_PATTERN` / `isInAppBrowser()`）自動遷移そのものがブロックされるうえ、フォールバック先の招待LPが内部で `onelink.me` へ飛ぼうとしてそこでも止まるため。検知対象は X / Facebook / Messenger / Instagram / LINE / WeChat。
- `touchstart` / `click` を拾うのは、タップで遷移が始まったあとにエラー文言が割り込んだり、保険の自動遷移がタップを追い越したりしないよう、タイマーを止めるためだけ。
- **画面はどの環境でも即座に出す。** 遅らせるとその間のタップが `<a>` に届かず取りこぼしになる（画面が `hidden` のままなので）。以前クッションページが持っていた1〜2秒のランダム遅延は廃止した。
- **公開ページ（クッションOFF）では、黒画面をサーバー側で `href` を入れた状態で最初から出す。** JSの完了を待たない。待たせるとその間のタップが `<a>` に届かず取りこぼしになる（以前はフィンガープリント照合の完了まで最大1.5秒 `hidden` のままだった）。照合は裏で走らせ、当たりURLが本人向けに差し替わったときだけ `href` を書き換える。
- **クッションON（TikTok風ページ）の「TikTokを開く」も同じ扱い。** 以前はこのリンクの `click` を `preventDefault()` で横取りし、照合の完了を待ってから `location.href` で飛ばしていた。これはJS由来のナビゲーションになるため **Universal Link が発火せず、アプリが起動しない原因になっていた**。現在は横取りをやめ、照合結果は `href` の差し替えだけで反映する。
- `startLiteLaunch()` はクッションページ（React）と公開ページ（文字列HTML）の両方から使う。後者へは `liteLaunchScript()` で関数をそのまま直列化して埋め込むため、**この関数はモジュール内の他の識別子を参照しない**自己完結した実装にしてある。CSSは `LITE_IAB_CSS`（文字列HTML用）と `cushion-relay.module.css`（React用）に同じ見た目で置いてある。

#### アプリ内WebViewの描画設定（`onelink` 方式の `af_dp` 用）

`__status_bar` / `_pia_` / `_svg` / `enable_canvas` / `enable_canvas_optimize` / `hide_nav_bar` / `should_full_screen` の7件は、Web側では `INTERSTITIAL_PARAMS` として除去している。ブラウザで踏んだときに中間ページ然とした描画を誘発するためで、そこでは不要なもの。一方**アプリ内では招待ページを描画するコンテナ（Spark）の設定そのもの**で、これが無いと「アプリは起動するが招待ページへ画面が切り替わらない」状態になる（実機で確認）。`LITE_INAPP_RENDER` として Run A の値のまま補完する。

- `og_desc_text` / `og_image` / `og_title_text` は同じく除去しているが、こちらは招待LPのOGPカード（SNSでシェアしたときの見た目）用でアプリ内の描画には関与しないため補完しない。

以下は **`onelink` 方式（フォールバック）のときの挙動**。`lp` 方式では `af_*` を一切付与しないため適用されない。

- **端末ごとの遷移先**: `af_ios_url`(iOS) / `af_android_url`(Android) / `af_ipad_url`(iPad) / `af_web_dp`(PC) を付与する。
  - `af_ipad_url` は `af_ios_url` と同じ値が自動でセットされる。iPadOSのSafariは既定で「デスクトップ用サイトを要求」するためUserAgentがmacOSと見分けがつかず、AppsFlyer側がiOS端末として扱ってくれない。指定が無いとOneLinkの既定のWeb遷移先(サイトのトップページ)が開いてしまうため。
  - `af_web_dp` はPC(Windows/Mac)から踏まれたときの遷移先で、フォームの「af_web_dp(PC向け遷移先)」に任意のURL(キャンペーンLP等)を入力する。空欄なら付与しない。なお `af_web_dp` は `DEEPLINK_PARAMS` にも含まれるため、リンク元に埋まっていた値は一度除去され、入力した値だけが最終的に残る。
- **抽出結果が招待LPでもOneLinkでもなければエラーで止める**(招待LPのURLはこの判定に到達せず、そのまま `lp` 方式で処理される): 以前は「OneLink テンプレート」欄の値でドメイン＋パスを差し替えるフォールバックを持っていたが、廃止した(`assertOneLink()`)。実物の招待リンクは `https://snssdk1180.onelink.me/BAuo/999140ec` のように「テンプレートID + ショートリンクID」の2セグメント構成で、後半はシェアごとに異なる。さらにこのリンクのクエリには `pid` も `c` も無く、AppsFlyer側(ショートリンク)がサーバー側に保持していると考えられる。つまりテンプレートへの差し替えは「他人のリンクに別のショートリンクを当てる」処理であり、アトリビューション設定ごと失った不完全なリンクを生む。黙って壊れたリンクを配るより、生成を止めて作り直させるほうが安全。
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
  - **`params_url` にはサニタイズ「前」の元のクエリを載せる。** サニタイズ(`DEEPLINK_PARAMS` / `INTERSTITIAL_PARAMS` の除去)はOneLink側のWeb遷移を止めるためのもので、アプリ内へ渡すペイロードとは文脈が違う。実物のHTMLでは TikTok自身が `inc_target_url` / `is_inc_roma` / `incentive_redirect` を含む66件すべてをアプリへ渡しており、これらは招待インセンティブの識別子そのもの。ここで削ると「Liteは開くが誰の紹介か分からない」状態になる(実機で発生した)。`inc_target_url` だけは `aweme://` → `snssdk473824://` にスキームを差し替えて載せる(アプリ内でも通常版を開かせないため)。
  - 除くのは `is_retargeting`(TikTokも渡していない)と、こちらが足したAppsFlyer用のキー(`MANAGED_PARAMS`)だけ。
  - TikTok自身が必ず付けているアプリ内コンテナの設定値(`spark_page` / `use_spark` / `bdhm_bid` / `needlaunchlog` / `ug_medium` / `disable_ttnet_proxy` / `use_mutable_context`)を `LITE_DEEPLINK_CONTEXT` として再現する。招待LPのクエリには含まれず、リンク生成側で付けている固定値。
  - **再保存しても削れない**: 生成済みURLをもう一度通すとき、OneLink側のクエリは既にサニタイズ済みで `inc_*` が落ちている。そのまま作り直すと再保存のたびにアプリ用のデータが削れるため、`recoverAppParams()` で前回の `af_dp` の `params_url` から元のクエリを復元し、現在のクエリを上書きで重ねる(5回再保存してもキー構成・URL長が変わらないことを検証済み)。
  - `is_retargeting` の除去も `af_dp` の組み立て前に行う。後回しにすると既存URLに焼き付いていた値が `params_url` 経由でアプリまで渡ってしまう。
  - Liteがインストール済みなら `af_dp` でLiteが開き、未インストールなら `af_ios_url` / `af_android_url` のストアへ落ちる。
  - クエリ(`u_code` / `share_page_data` / `media_source` / `pid` 等)はすべてそのまま引き継ぐ。
  - フォームのチェックボックスでOFFにすると従来どおり元のドメインのまま生成し、`af_dp` は空文字(通常版の起動ブロック)になる。挙動を比較したいときに使う。
- **土台に使うURLの優先順位**(`preferSourceUrl()`): `lpUrl`(招待LPの実体。最優先) → `liteUrl` → `trackingUrl`。`/api/expand` で展開できた場合はAPIを呼ばずにLPのURLを直接使う。Stealth API が `liteUrl`(TikTok が Lite 用に組み立てた `snssdk473824.onelink.me/4P4E`)を返す場合は、それを土台にする。このリンクは `wid`(招待者の識別子) / `c`(キャンペーン) / `af_adset` と、`u_code` を含む `af_dp` を最初から持っている。**これらは `shareOptions.onelink`(BAuo)のクエリには存在せず、こちらで再構築できない。** 招待LPのレンダリング済みDOMにしか無く、`universal-data` 内の18件はすべて値が空のテンプレート。
  - 土台が既に「中身の詰まった」Liteディープリンクを持っている場合、`af_dp` は作り直さずそのまま使う。TikTokが生成したものには再現できない値が入っているため。
  - `liteUrl` が返ってこない場合は従来どおり `trackingUrl`(BAuo)から再構築するが、`wid` / `af_adset` が欠けるため招待が成立しない可能性がある(実機で確認)。**Stealth API 側(`server.js`)の対応が必要。**
- **`is_retargeting` は付与せず、必ず除去する**: AppsFlyerはこれが `true` だとクリックを「リターゲティング(再エンゲージメント)」として記録する。招待報酬は「新規インストール＋初回起動」で発火するのが前提なので、リターゲティング扱いになると発火条件を外れて報酬が付かない恐れがある。TikTok Liteの招待リンクにはそもそも `is_retargeting` が入っていないため、付与していたのはこちら側だった。
  - うっかりONにする事故を防ぐため、フォームのチェックボックスと `BuildOptions.retargeting` ごと廃止した。
  - 除去は `stripDeepLinks` のON/OFFに関係なく常に実行する。この対応より前に生成した(`is_retargeting=true` が焼き付いた)URLを再保存したときに確実に落とすため。
- **クッションページのON/OFF**: フォームのチェックボックスで切り替える。切り替えているのは最終出力URLだけ(`resolveOutputUrl()`)で、サニタイズ処理には影響しない。**この2つは用途が違う。**
  - **ON(友達に送る用)**: `/tools/link-generator?to=<招待LPのURL>` を出力する。黒画面のタップ誘導(`startLiteLaunch()`)を持っているのはこの画面なので、**配布用のリンクは必ずこちら**。
  - **OFF(サイトに貼る用)**: 招待LPのURLをそのまま出力する。サイト編集画面の「TikTok Liteの招待リンク」欄に入れる値で、公開ページ側が黒画面のタップ誘導で包む。**この値を直接配ってもアプリは起動しない**(踏むとブラウザで招待LPが開くだけ。TikTok公式の招待リンクも同じ挙動)。過去にここを取り違えて「生成されたURLをタップしても生のURLにアクセスするだけ」と判断された経緯があるため、OFFのときはUIにも警告を出している。
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

**通常のブラウザでもタップを経由させる。** 自動遷移ではアプリが開かないため(上記「どの環境でも『利用者のタップ』を経由させる」を参照)。誰もタップしなかった場合の保険として `WEB_FALLBACK_MS`(6秒)後に `location.replace()` で送るが、この経路ではアプリは開かず招待LPがブラウザで開くだけになる。JSが無効な環境向けの `<noscript>` の手動リンクもそのまま残している(クッションページも同じ)。

遷移手段は重ねがけしない。保険の自動遷移はタップされた時点で取り消すので、進行中の遷移を中断することはない。

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
