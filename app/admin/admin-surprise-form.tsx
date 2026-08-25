'use client';

import { useState } from 'react';
import { updateSurpriseConfig, type UpdateSurpriseConfigResult } from './actions';
import { detectBuildMode } from '@/lib/link-generator';
import type { SurpriseConfig } from '@/lib/types';

export function AdminSurpriseForm({ config }: { config: SurpriseConfig | null }) {
  const [probability, setProbability] = useState(config?.probability ?? 0);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<UpdateSurpriseConfigResult | null>(null);
  const [copied, setCopied] = useState(false);

  // 保存直後は返ってきた値を、それ以外はDBの値を見せる
  const optimized = result?.ok ? result.optimizedPrizeUrl : config?.prize_url_optimized;
  /* 保存直後は生成時に分かった経路をそのまま使い、ページを開き直したときは
     保存済みURLの形から判定する(DBには経路を持たせていないため)。 */
  const mode = result?.ok && result.optimizedMode ? result.optimizedMode : detectBuildMode(optimized);

  return (
    <form
      action={async (formData) => {
        setResult(null);
        setSaving(true);
        try {
          setResult(await updateSurpriseConfig(formData));
        } finally {
          setSaving(false);
        }
      }}
      className="flex flex-col gap-5 rounded-xl border border-slate-200 bg-white p-6"
    >
      <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
        <input type="checkbox" name="enabled" defaultChecked={config?.enabled ?? false} className="h-4 w-4" />
        サプライズ抽選を有効にする
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-slate-900">当選確率(%)</span>
        <input
          type="number"
          name="probability"
          min={0}
          max={100}
          step={0.1}
          value={probability}
          onChange={(e) => setProbability(Number(e.target.value))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <span className="text-xs text-slate-400">0〜100の数値。作成者本人・同一アカウントの端末には適用されません。</span>
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-slate-900">当たりURL(TikTok Liteの招待リンク)</span>
        <input
          type="url"
          name="prize_url"
          defaultValue={config?.prize_url ?? ''}
          placeholder="https://lite.tiktok.com/t/..."
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <span className="text-xs leading-relaxed text-slate-400">
          保存時にリンクジェネレーターを通し、最適化したURLも一緒に保存します(短縮リンクは展開し、ディープリンク系パラメータを除去します)。
          当選した訪問者には、クッションページの有無に関わらずこの最適化版が使われます。
          Stealth APIの起動待ちで保存に数十秒かかることがあります。
        </span>
      </label>

      {/* 当たりURLは設定されているのに最適化版が無い状態。この場合は抽選そのものが
          行われない(生のURLを配ると、踏んでもアプリが起動しない壊れたリンクになるため)。
          保存し直せば解消するが、放置すると「抽選が動いていない」ことに気づけないので明示する。 */}
      {!optimized && (config?.prize_url ?? '') !== '' && (
        <p
          data-id="notOptimized"
          className="whitespace-pre-line rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700"
        >
          当たりURLは設定されていますが、<strong>最適化版が保存されていません。</strong>
          この状態では抽選は行われず、全員がサイト本来のURLへ遷移します。
          {'\n'}
          「保存する」を押し直して最適化版を作り直してください。
          それでもこの表示が消えない場合は、<code className="font-mono">surprise_config</code> テーブルに{' '}
          <code className="font-mono">prize_url_optimized</code> 列があるかを確認してください
          （<code className="font-mono">supabase/schema.sql</code> の末尾にある alter 文が未実行の可能性があります）。
        </p>
      )}

      {optimized && (
        <div
          data-id="optimizedPrize"
          className={
            'flex flex-col gap-1.5 rounded-lg border p-3 ' +
            (mode === 'wrapper' ? 'border-slate-200 bg-slate-50' : 'border-amber-300 bg-amber-50')
          }
        >
          <span className="text-xs font-medium text-slate-900">最適化済みの当たりURL(実際に当選者へ渡されるURL)</span>
          <code className="break-all font-mono text-xs text-slate-600">{optimized}</code>

          {/* どちらの形式で生成されたかを見せる。フォールバック側は実機で招待が
              成立しないことが分かっているため、気づけるように警告を出す。 */}
          {mode === 'wrapper' && (
            <span data-id="prizeMode" className="text-xs text-emerald-700">
              形式: ワンクリック招待（推奨）。TikTok Lite の Universal Link に招待ペイロードを載せた形で、
              招待LPが内部で使っているものと構造が一致します。タップするとアプリが開きます。
            </span>
          )}
          {mode === 'lp' && (
            <span data-id="prizeMode" className="text-xs leading-relaxed text-amber-800">
              形式: <strong>招待LPのURLそのまま</strong>。
              <strong>タップしてもアプリは起動しません</strong>（TikTok公式の招待リンクも同じ挙動）。
              「保存する」を押し直して最適化版を作り直してください。
            </span>
          )}
          {mode === 'onelink' && (
            <span data-id="prizeMode" className="text-xs leading-relaxed text-amber-800">
              形式: <strong>OneLink再構築（フォールバック）</strong>。招待LPのURLを取得できなかったため、
              AppsFlyerのOneLinkを組み立て直しています。
              <strong>この形式は実機で「アプリは開くが招待が成立しない」ことが確認されています。</strong>
              当たりURLを入れ直して保存し直すか、TikTokアプリからコピーし直した招待リンクを使ってください。
            </span>
          )}
          {mode === 'unknown' && (
            <span data-id="prizeMode" className="text-xs leading-relaxed text-amber-800">
              形式: <strong>不明</strong>。TikTok Liteの招待リンクとして認識できない形です。
              当たりURLを入れ直してください。
            </span>
          )}

          {/* 当選者が実際に踏むのと同じURLを、その場で試せるようにしておく。
              「当たりURLだけ挙動がおかしい」ときに、抽選を経由せず直接切り分けられる。 */}
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <a
              data-id="testPrize"
              href={optimized}
              target="_blank"
              rel="noreferrer noopener"
              className="text-xs font-medium text-slate-900 underline"
            >
              このURLを開いてテストする
            </a>
            <button
              type="button"
              data-id="copyPrize"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(optimized);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  /* クリップボードが使えない環境では何もしない(URLは上に表示済み) */
                }
              }}
              className="text-xs text-slate-500 underline"
            >
              {copied ? 'コピーしました' : 'URLをコピー'}
            </button>
          </div>
          <span className="text-xs leading-relaxed text-slate-400">
            スマホで開いてアプリが起動しない場合、原因は抽選ではなくこのURL自体です。
            その場合はこのURLをそのまま共有してください（当たりURLは他人の招待リンクのため、
            当選しても自分の招待は成立しません。テストは必ずこのURLで行ってください）。
          </span>
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
      >
        {saving ? '当たりURLを最適化して保存中...' : '保存する'}
      </button>

      {result?.ok && <p className="text-xs text-emerald-600">保存しました。</p>}
      {result && !result.ok && (
        <p className="whitespace-pre-line rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
          {result.error}
        </p>
      )}
    </form>
  );
}
