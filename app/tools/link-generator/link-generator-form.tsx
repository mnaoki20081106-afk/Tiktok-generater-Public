'use client';

import { useRef, useState } from 'react';
import { Link2, Loader2, ExternalLink, Copy } from 'lucide-react';
import {
  BTN_LABEL,
  DEFAULT_ANDROID_URL,
  DEFAULT_IOS_URL,
  DEFAULT_ONELINK_TEMPLATE,
  MIN_BUSY_MS,
  buildUrl,
  callExtractApi,
  diagnose,
  parseHttpUrl,
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
  const [onelinkTpl, setOnelinkTpl] = useState(DEFAULT_ONELINK_TEMPLATE);

  const [optDp, setOptDp] = useState(true);
  const [optStrip, setOptStrip] = useState(true);
  const [optRt, setOptRt] = useState(true);
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
        emptyDp: optDp,
        retargeting: optRt,
        stripDeepLinks: optStrip,
        onelinkTemplate: onelinkTpl.trim(),
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
      const data = await callExtractApi(value);
      setSrcUrl(data.trackingUrl);
      setExtractLabel('抽出成功！');
      setTimeout(restore, 1500);
      runBuild(data.trackingUrl); // そのままリダイレクトURL生成へ
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
          <label htmlFor="onelinkTpl" className="mb-1.5 block text-sm font-medium text-slate-900">
            OneLink テンプレート(ドメイン補正用)
          </label>
          <input
            id="onelinkTpl"
            type="text"
            spellCheck={false}
            value={onelinkTpl}
            onChange={(e) => setOnelinkTpl(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
          />
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            抽出結果が <code className="rounded bg-slate-100 px-1 py-0.5 font-mono">lite.tiktok.com</code>{' '}
            などの短縮ドメインだった場合、このURLのドメイン＋パスに差し替えます。手動で取得できた正しい OneLink
            を入れてください。
          </p>
        </div>

        <div className="mb-4 flex flex-col gap-2.5">
          <Check checked={optDp} onChange={setOptDp}>
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">af_dp</code>{' '}
            を空文字で設定(通常版の起動ブロック)
          </Check>
          <Check checked={optStrip} onChange={setOptStrip}>
            ディープリンク系パラメータ(
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">deep_link_value</code> /{' '}
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">fallback_url</code> 等)を削除
          </Check>
          <Check checked={optRt} onChange={setOptRt}>
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">is_retargeting=true</code> を設定
          </Check>
        </div>

        {/* ===== 新機能: クッションページの ON / OFF ===== */}
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <Check checked={useCushion} onChange={handleCushionToggle}>
            <span className="font-medium text-slate-900">クッションページを挟む</span>
          </Check>
          <p className="mt-2 pl-6 text-xs leading-relaxed text-slate-500">
            {useCushion
              ? 'ON: 1〜2秒のローディング画面(クッションページ)を経由するURLを出力します。SNSでシェアするとこのサイトのカードが表示されます。'
              : 'OFF: クッションページを挟まず、サニタイズ処理を通過した最終的な直接遷移先URLをそのまま出力します。'}
          </p>
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
            {useCushion ? '✅ 完了！友達に送る最強リンク(クッションページ経由)' : '✅ 完了！直接遷移リンク'}
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

          {/* 何を除去・補正したかを見せる。通常版が開いてしまう原因追跡に必要。 */}
          <div className="mt-2">
            {built.notes.map((n, i) => (
              <p
                key={i}
                className={`text-xs leading-relaxed ${n.indexOf('警告') === 0 ? 'text-red-600' : 'text-slate-500'}`}
              >
                {n}
              </p>
            ))}
            <p className="text-xs leading-relaxed text-slate-500">
              {built.removed.length
                ? '除去したディープリンク系パラメータ: ' + built.removed.join(', ')
                : '除去対象のディープリンク系パラメータはありませんでした。'}
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
              ? 'このリンクを踏むと、1〜2秒のローディング画面を挟んで直接App Storeが開きます。'
              : 'このリンクを踏むと、ローディング画面を挟まずそのまま遷移先が開きます。'}
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
