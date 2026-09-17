'use client';

import { useState } from 'react';
import { updateSurpriseConfig, type UpdateSurpriseConfigResult } from './actions';
import type { SurpriseConfig } from '@/lib/types';

export function AdminSurpriseForm({ config }: { config: SurpriseConfig | null }) {
  const [probability, setProbability] = useState(config?.probability ?? 0);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<UpdateSurpriseConfigResult | null>(null);

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
          公開ページと同じ処理でTikTokのアプリ／ストア分岐情報を取得します。
          取得できない場合は入力した公式招待リンクを保持します。その場合、TikTokの招待画面が表示されることがあります。
        </span>
      </label>


      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
      >
        {saving ? '保存中...' : '保存する'}
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
