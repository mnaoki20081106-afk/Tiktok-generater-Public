'use client';

import { useState } from 'react';
import { updateSurpriseConfig } from './actions';
import type { SurpriseConfig } from '@/lib/types';

export function AdminSurpriseForm({ config }: { config: SurpriseConfig | null }) {
  const [probability, setProbability] = useState(config?.probability ?? 0);
  const [saved, setSaved] = useState(false);

  return (
    <form
      action={async (formData) => {
        await updateSurpriseConfig(formData);
        setSaved(true);
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
        <span className="font-medium text-slate-900">当たりURL(例: PayPayの受け取りリンク)</span>
        <input
          type="url"
          name="prize_url"
          defaultValue={config?.prize_url ?? ''}
          placeholder="https://pay.paypay.ne.jp/..."
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      <button
        type="submit"
        onClick={() => setSaved(false)}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
      >
        保存する
      </button>

      {saved && <p className="text-xs text-emerald-600">保存しました。</p>}
    </form>
  );
}
