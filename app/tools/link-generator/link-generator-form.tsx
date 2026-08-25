'use client';

import { useRef, useState } from 'react';
import { Link2, Loader2, ExternalLink, Copy } from 'lucide-react';
import {
  BTN_LABEL,
  DEFAULT_ANDROID_URL,
  DEFAULT_IOS_URL,
  DEFAULT_WEB_DP_URL,
  MIN_BUSY_MS,
  ONELINK_RE,
  buildUrl,
  callExtractApi,
  diagnose,
  expandShortUrl,
  isInviteLpUrl,
  parseHttpUrl,
  preferSourceUrl,
  resolveOutputUrl,
  type BuildResult,
  type NetworkLevelError,
} from '@/lib/link-generator';
import { copyToClipboard, selectElementText } from '@/lib/clipboard';

/**
 * ジェネレーターのビルダー画面。
 *
 * 抽出・整形のコアロジックは `lib/link-generator.ts`(単独版からの移植)に置いてあり、
 * このコンポーネントは入力値の受け渡しと表示だけを担当する。
 * 単独版との唯一の機能差は「クッションページを挟む/挟まない」の切り替えで、
 * 切り替えているのは最終出力URLの出し分けのみ(サニタイズ処理には手を入れていない)。
 */
export function LinkGeneratorForm() {
  const [shortUrl, setShortUrl] = useState('');
  const [srcUrl, setSrcUrl] = useState('');
  const [iosUrl, setIosUrl] = useState(DEFAULT_IOS_URL);
  const [androidUrl, setAndroidUrl] = useState(DEFAULT_ANDROID_URL);
  const [webDpUrl, setWebDpUrl] = useState(DEFAULT_WEB_DP_URL);

  const [optLite, setOptLite] = useState(true);
  const [optStrip, setOptStrip] = useState(true);
  // 新機能: クッションページ(遅延リダイレクト画面)を挟むかどうか
  const [useCushion, setUseCushion] = useState(true);

  const [extractLabel, setExtractLabel] = useState(BTN_LABEL);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');
  const [built, setBuilt] = useState<BuildResult | null>(null);
  const [outputUrl, setOutputUrl] = useState('');
  const [copyStatus, setCopyStatus] = useState<{ text: string; ok: boolean }>({ text: '', ok: true });

  const outRef = useRef<HTMLPreElement>(null);
  const errRef = useRef<HTMLDivElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showError(msg: string) {
    setError(msg);
    setBuilt(null);
    setOutputUrl('');
    // 「無反応」に見えないよう、エラーはボタン直下に出したうえで視界に入れる
    requestAnimationFrame(() => errRef.current?.scrollIntoView({ block: 'nearest' }));
  }

  /**
   * 生成処理。`srcOverride` は抽出直後にstate反映を待たずに使うための引数。
   * `cushionOverride` はチェックボックス操作直後の再生成用。
   */
  function runBuild(srcOverride?: string, cushionOverride?: boolean) {
    setError('');
    try {
      const result = buildUrl(srcOverride ?? srcUrl, {
        iosUrl: iosUrl.trim(),
        androidUrl: androidUrl.trim(),
        webDpUrl: webDpUrl.trim(),
        forceLite: optLite,
        stripDeepLinks: optStrip,
      });

      setBuilt(result);
      setOutputUrl(resolveOutputUrl(result, cushionOverride ?? useCushion, window.location.href));
    } catch (e) {
      showError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleExtract() {
    const value = shortUrl.trim();

    setError('');
    if (!value) {
      showError('短縮URLを入力してください。');
      return;
    }
    if (!parseHttpUrl(value)) {
      showError('http(s):// で始まる正しいURLを入力してください。');
      return;
    }

    const startedAt = Date.now();
    setExtractLabel('抽出中...');
    setExtracting(true);

    const restore = () => {
      setExtractLabel(BTN_LABEL);
      setExtracting(false);
    };

    try {
      /* まずリダイレクトを追うだけで済ませる。公式の招待リンクは、これだけで
         招待LP(www.tiktok.com/ug/incentive/...)へ着地する。
         Stealth API が返すのはLPが内部に持つ「共有用のOneLink」であって
         公式リンクの実体ではないため、こちらを先に試す。 */
      const parsed = parseHttpUrl(value);
      let extracted: string | null = null;

      if (parsed && (isInviteLpUrl(parsed) || ONELINK_RE.test(parsed.hostname))) {
        extracted = parsed.toString(); // 既に展開済みのURLを貼られた場合
      } else {
        const expanded = parseHttpUrl(await expandShortUrl(value));
        if (expanded && (isInviteLpUrl(expanded) || ONELINK_RE.test(expanded.hostname))) {
          extracted = expanded.toString();
        }
      }

      // 展開できなかった(JS経由の遷移など)場合だけ Stealth API に頼る
      if (!extracted) extracted = preferSourceUrl(await callExtractApi(value));

      setSrcUrl(extracted);
      setExtractLabel('抽出成功！');
      setTimeout(restore, 1500);
      runBuild(extracted); // そのままリダイレクトURL生成へ
    } catch (e) {
      let msg = '抽出失敗: ' + (e instanceof Error ? e.message : String(e));

      if ((e as NetworkLevelError)?.networkLevel) {
        setExtractLabel('原因を診断中...');
        const notes = await diagnose();
        msg += '\n\n【自動診断】\n' + notes.join('\n');
      }

      // 即座に失敗すると「抽出中...」が一瞬すぎて無反応に見えるため、最低時間だけ表示を保つ
      const wait = Math.max(0, MIN_BUSY_MS - (Date.now() - startedAt));
      setTimeout(() => {
        restore();
        showError(msg);
      }, wait);
    }
  }

  function handleClear() {
    setShortUrl('');
    setSrcUrl('');
    setBuilt(null);
    setOutputUrl('');
    setError('');
  }

  /** クッションページの有無を切り替えたら、生成済みの結果もその場で切り替える */
  function handleCushionToggle(next: boolean) {
    setUseCushion(next);
    if (built) setOutputUrl(resolveOutputUrl(built, next, window.location.href));
  }

  function showCopyStatus(text: string, ok: boolean) {
    setCopyStatus({ text, ok });
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopyStatus({ text: '', ok: true }), 2000);
  }

  async function handleCopy() {
    if (!outputUrl) return;
    const ok = await copyToClipboard(outputUrl);
    if (ok) {
      showCopyStatus('コピーしました', true);
    } else {
      showCopyStatus('コピーできません。長押しして選択してください', false);
      if (outRef.current) selectElementText(outRef.current);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ===== ステップ1: 短縮URLから自動展開 ===== */}
      <section className="rounded-xl border border-slate-900 bg-white p-6">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Link2 size={16} />
          ステップ1: 短縮URLから自動展開
        </h2>

        <label htmlFor="shortUrl" className="mb-1.5 block text-sm font-medium text-slate-900">
          TikTok Liteの招待リンク(例: https://lite.tiktok.com/t/...)
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="shortUrl"
            type="text"
            spellCheck={false}
            value={shortUrl}
            onChange={(e) => setShortUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleExtract();
              }
            }}
            placeholder="ここにアプリからコピーしたURLをペースト"
            className="min-w-0 flex-1 basis-64 rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleExtract}
            disabled={extracting}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
          >
            {extracting && <Loader2 size={14} className="animate-spin" />}
            {extractLabel}
          </button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          専用のStealth APIを経由して公式LPを裏で取得し、生のトラッキングURLを復元します。
        </p>
      </section>

      {/* エラー表示はボタンの直下に置く(スクロールしないと見えない位置だと「無反応」に見えるため) */}
      {error && (
        <div
          ref={errRef}
          className="whitespace-pre-wrap rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* ===== ステップ2: 詳細パラメータ ===== */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">ステップ2: 詳細パラメータ(自動入力されます)</h2>

        <div className="mb-4">
          <label htmlFor="srcUrl" className="mb-1.5 block text-sm font-medium text-slate-900">
            元のトラッキング URL(抽出結果)
          </label>
          <textarea
            id="srcUrl"
            spellCheck={false}
            value={srcUrl}
            onChange={(e) => setSrcUrl(e.target.value)}
            placeholder="抽出すると自動で入力されます"
            className="min-h-[70px] w-full resize-y rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 placeholder:font-sans placeholder:text-sm placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
          />
        </div>

        <div className="mb-4">
          <label htmlFor="iosUrl" className="mb-1.5 block text-sm font-medium text-slate-900">
            af_ios_url(iOS 向け遷移先)
          </label>
          <input
            id="iosUrl"
            type="text"
            spellCheck={false}
            value={iosUrl}
            onChange={(e) => setIosUrl(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
          />
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            同じ値が <code className="rounded bg-slate-100 px-1 py-0.5 font-mono">af_ipad_url</code>{' '}
            にも自動でセットされます。iPadOSのSafariは既定でデスクトップ用サイトを要求するためiOS端末として判定されず、
            指定が無いとサイトのトップページが開いてしまうためです。
          </p>
        </div>

        <div className="mb-4">
          <label htmlFor="androidUrl" className="mb-1.5 block text-sm font-medium text-slate-900">
            af_android_url(Android 向け遷移先)
          </label>
          <input
            id="androidUrl"
            type="text"
            spellCheck={false}
            value={androidUrl}
            onChange={(e) => setAndroidUrl(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
          />
        </div>

        <div className="mb-4">
          <label htmlFor="webDpUrl" className="mb-1.5 block text-sm font-medium text-slate-900">
            af_web_dp(PC向け遷移先)
          </label>
          <input
            id="webDpUrl"
            type="text"
            spellCheck={false}
            value={webDpUrl}
            onChange={(e) => setWebDpUrl(e.target.value)}
            placeholder="https://example.com/campaign （空欄ならPC向けの指定なし）"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
          />
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            PC(Windows/Mac)から踏まれたときに開くページ。キャンペーンLPなど任意のURLを指定できます。
            空欄の場合は iOS向け遷移先(App Store)が使われます。空のままにするとOneLinkテンプレート側の
            既定値(通常版TikTokのWebページ)が発動してしまうため、必ず何かで埋めます。
          </p>
        </div>

        {/* 「OneLink テンプレート」欄は廃止した。抽出結果がOneLinkでなかった場合に
            ドメイン＋パスを差し替えるフォールバック用だったが、OneLinkのパス
            (テンプレートID/ショートリンクID)はアトリビューション設定そのもので、
            差し替えると pid や u_code の紐付けを失った不完全なリンクになる。
            現在は差し替えずエラーで止める。 */}

        <div className="mb-4 flex flex-col gap-2.5">
          <Check checked={optLite} onChange={setOptLite}>
            <span className="font-medium text-slate-900">TikTok Lite を強制する(通常版TikTokが開くのを防ぐ)</span>
            <span className="mt-1 block text-xs leading-relaxed text-slate-500">
              招待LPがアプリを開くときの飛び先(
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono">inc_target_url</code>)は、
              公式のリンクでは通常版TikTokのスキーム(
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono">aweme://</code>
              )を指しています。両方インストールされた端末では通常版が開いてしまうため、
              スキーム部分だけを Lite(
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono">snssdk473824://</code>
              )へ差し替えます。
              <strong className="text-slate-700">
                公式のURLと違うのはこの1点だけで、他のパラメータは1つも変えません。
              </strong>
              招待の宛先(<code className="rounded bg-slate-100 px-1 py-0.5 font-mono">u_code</code>)は
              LPのクエリが運んでいるため、差し替えても招待は成立します。
              {'\u000a'}
              もし実機でアプリが起動しなくなった場合は、ここをOFFにすると公式と完全に同一のURLになります。
            </span>
          </Check>
          <Check checked={optStrip} onChange={setOptStrip}>
            ディープリンク系・中間ページ描画系パラメータ(
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">deep_link_value</code> /{' '}
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">enable_canvas</code> 等)を削除
          </Check>
        </div>

        {/* is_retargeting のチェックボックスは廃止した。付与するとAppsFlyerがクリックを
            リターゲティング(再エンゲージメント)として記録し、新規インストール前提の
            招待報酬が付かなくなる恐れがあるため。buildUrl() 側で常に除去している。 */}

        {/* ===== 新機能: クッションページの ON / OFF ===== */}
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <Check checked={useCushion} onChange={handleCushionToggle}>
            <span className="font-medium text-slate-900">クッションページを挟む</span>
          </Check>
          <p className="mt-2 pl-6 text-xs leading-relaxed text-slate-500">
            {useCushion
              ? 'ON(友達に送る用): 黒画面のローディング画面を経由するURLを出力します。タップでアプリを起動させる仕掛けはこの画面が持っています。SNSでシェアするとこのサイトのカードが表示されます。'
              : 'OFF(サイトに貼る用): 招待LPのURLをそのまま出力します。サイト編集画面の「招待リンク」欄に入れる値がこれです。'}
          </p>
          {/* OFFのURLは配布用ではない。踏んでもアプリは起動せずブラウザで招待LPが開くだけで、
              過去にここを取り違えて「生のURLに飛ぶだけ」と判断された経緯がある。 */}
          {!useCushion && (
            <p className="mt-2 pl-6 text-xs leading-relaxed text-amber-700">
              <strong>このURLを友達に送っても、アプリは起動しません。</strong>
              ブラウザで招待LPが開くだけです(TikTok公式の招待リンクも同じ挙動)。アプリを起動させる
              黒画面のタップ誘導は、クッションページON か 公開ページ(/slug) 側にあります。
              配布用のリンクが欲しい場合はONにしてください。
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => runBuild()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            手動で生成
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            クリア
          </button>
        </div>
      </section>

      {/* ===== 結果 ===== */}
      {built && outputUrl && (
        <section className="rounded-xl border-2 border-emerald-500 bg-white p-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            {useCushion ? '✅ 完了！友達に送る最強リンク(クッションページ経由)' : '✅ 完了！サイトに貼る用の遷移先URL'}
          </h2>

          <pre
            ref={outRef}
            role="button"
            tabIndex={0}
            title="タップでコピー"
            aria-label="生成されたリンク。タップするとコピーします"
            onClick={handleCopy}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCopy();
              }
            }}
            className="max-h-56 cursor-pointer overflow-auto whitespace-pre-wrap break-all rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-900 transition hover:border-slate-900"
          >
            {outputUrl}
          </pre>
          <p className="mt-2 text-xs text-slate-500">リンクを直接タップしてもコピーできます。</p>

          {/* どちらの経路で作ったか / 何を除去したかを見せる。原因追跡に必要。 */}
          <div className="mt-2 space-y-1">
            <p className="text-xs leading-relaxed text-slate-500">
              {built.mode === 'lp'
                ? '生成方式: 招待LP直結(推奨)。公式の招待リンクが着地するURLと同じ形です。タップするとブラウザで招待LPが読み込まれ、そのJSが招待をバインドしてアプリを開きます。トラッキングが成立するのはこの経路だけです。'
                : '生成方式: OneLink再構築(フォールバック)。招待LPのURLが取得できなかったため、AppsFlyerのOneLinkを組み立て直しています。'}
            </p>
            {built.liteForced && (
              <p className="text-xs leading-relaxed text-slate-500">
                アプリへ渡すペイロードのうち、inc_target_url のスキームだけを Lite
                に差し替えています(TikTokの文字列との差分はこの1点だけ)。
              </p>
            )}
            <p className="text-xs leading-relaxed text-slate-500">
              {built.removed.length
                ? '除去したパラメータ: ' + built.removed.join(', ')
                : '除去対象のパラメータはありませんでした。'}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              <Copy size={14} />
              クリップボードにコピーする
            </button>
            <a
              href={outputUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              <ExternalLink size={14} />
              自分でテストする
            </a>
            {copyStatus.text && (
              <span
                aria-live="polite"
                className={`text-xs font-semibold ${copyStatus.ok ? 'text-emerald-600' : 'text-red-600'}`}
              >
                {copyStatus.text}
              </span>
            )}
          </div>

          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            {useCushion
              ? 'このリンクを踏むと黒い画面が出て、タップでアプリが起動します。'
              : 'サイト編集画面の「TikTok Liteの招待リンク」欄に貼る値です。公開ページ側が黒画面のタップ誘導で包むので、この値を直接配る必要はありません。'}
          </p>
        </section>
      )}
    </div>
  );
}

function Check({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0"
      />
      <span className="leading-relaxed">{children}</span>
    </label>
  );
}
