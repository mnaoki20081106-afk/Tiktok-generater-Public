# re-0.link の招待リンク処理の調査

調査日: 2026-09-16。対象: https://re-0.link/ と https://re-0.link/login の公開HTML。

## 公開ソースから確認した事実

- 編集画面は `https://snssdk473824.onelink.me/...` を入力例にし、その公式OneLinkを加工せず貼り付けるよう案内している。
- `collect()` は `target_url: el('f_target').value.trim()` を保存用JSONに入れる。ブラウザ側でURLを再構築する処理は、この保存処理にはない。
- 新規リンクの初期値は `mode: 'page'`, `deeplink: 0`, `escape_webview: 0`。アプリ起動用フィールドの存在だけで、その処理が有効とは判断できない。
- 公開プレビューを開く処理は、保存済みの `CUR.slug` を使い `window.open('/'+CUR.slug, '_blank')` を呼ぶ。
- トップに表示された例 `/example` はHTTP 404だった。正常な生成済み公開URLは今回取得できていない。

## 未確認

サーバーが保存時にURLを加工するか、生成済みページの実際のHTML/JavaScript、端末別の遷移、TikTok側の招待認定・報酬付与は未確認。ログインや新規アカウント作成、リンクの公開、招待の実行は行っていない。

したがって「招待成立を保証する仕組みを完全再現した」とは言えない。生成済み公開URLを1本入手し、そのHTMLとリダイレクトを確認する必要がある。

## 今回の変更

以前は入力済みのLite OneLinkも `buildUrl()` で再構築し、`af_dp` やストア指定などを書き換えていた。既定の `generateDestinationUrl()` では、HTTPSの `snssdk473824.onelink.me` の非ルートパスを指定したURLを、前後の空白を除いてそのまま返すように変更した。ユーザー情報付きURLや非標準ポートはこの扱いに含めない。

opaqueな短縮ID、重複クエリ、未認識のパラメータ、エンコードを保持し、事前のネットワークアクセスも行わない。公式ドメインの判定は、有効な招待であることの検証ではない。明示的な生成オプション指定時は従来の変換処理を使う。

`lite.tiktok.com/t/...` の展開と既存LPの処理は今回は変更していない。公開ページは既存の通常のリンクタップで保存先へ遷移する。一般のApp Storeリンクを新たに生成することはしない。

## 検証

- `scripts/check-official-onelink.ts`: 公式ホストの限定、短縮ID・すべてのパラメータ・エンコードの保持、再保存の同一性、ネットワークアクセスなし。
- 既存の招待LP・テンプレート・セッションの回帰テスト。
- 招待成立の実機検証は別途必要。

## 関連する一次資料

- https://support.appsflyer.com/hc/en-us/articles/207032066-Basic-SDK-integration-guide
- https://dev.appsflyer.com/hc/docs/dl_ios_unified_deep_linking

OneLinkは端末・インストール状態・設定に応じたアプリ起動やストア誘導、アプリ側SDKとの連携を提供する。ただしこれはTikTokの個別キャンペーンでの招待認定を保証する資料ではない。

## 追加調査: 実際の公開ページ（2026-09-16）

ユーザー提供の https://safari-mp4-video.link/egvkvxs を、PC・iPhone Safari・Android ChromeのUser-Agentで取得。いずれもHTTP 200でLocationヘッダーなし。取得HTMLには外部遷移用JavaScript、meta refresh、iframeはなかった。

ページは画像と再生マーク、その上の透明な `<a class="el hotspot">` で構成される。リンク先はすべて `https://lite.tiktok.com/t/.../` 形式の短縮招待URLで、最前面のリンクは画面のほぼ全体を覆う。リンクは通常の同一タブ遷移で、ページ側では招待URLを展開・OneLink化していない。取得時点のソースから確認できるのはここまでで、TikTok側の招待認定や実機のアプリ起動は未確認。

前節の「短縮URLの展開処理は変更していない」はこの追加対応で更新した。既定の保存処理ではHTTPSの `lite.tiktok.com/t/<識別子>` もそのまま保持する。独立した詳細生成ツールや、明示的な変換オプションによる処理は引き続き利用できる。

すでに展開・加工済みの保存データは、元の短縮URLを復元できないため自動変更しない。新しい挙動を既存ページで使うには、TikTokから取得した元の招待リンクを入力して保存し直す。これを「招待成立の保証」や「自動的にアプリへ転送する処理」とは説明しない。
