'use client';

import { useState } from 'react';
import { StatCard } from '@/components/StatCard';
import { TrendChart } from '@/components/TrendChart';
import type { AnalyticsSummary } from '@/lib/analytics';

type Period = '24h' | '7d' | '30d';

const PERIOD_LABEL: Record<Period, string> = {
  '24h': '過去24時間',
  '7d': '過去7日間',
  '30d': '過去30日間',
};

const COMPARISON_LABEL: Record<Period, string> = {
  '24h': '前日より',
  '7d': '前週より',
  '30d': '前月より',
};

/** PV/UUのスタットタイル + 期間切り替え(過去24時間/過去7日間/過去30日間) + トレンドグラフ */
export function AnalyticsPanel({
  summary24h,
  summary7,
  summary30,
  pvLabel = 'ページビュー(PV)',
  uuLabel = '訪問者数(UU)',
}: {
  summary24h: AnalyticsSummary;
  summary7: AnalyticsSummary;
  summary30: AnalyticsSummary;
  pvLabel?: string;
  uuLabel?: string;
}) {
  const [period, setPeriod] = useState<Period>('24h');
  const summary = period === '24h' ? summary24h : period === '7d' ? summary7 : summary30;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          {(['24h', '7d', '30d'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                period === p ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label={pvLabel}
          value={summary.pv}
          changePercent={summary.pvChangePercent}
          comparisonLabel={COMPARISON_LABEL[period]}
        />
        <StatCard
          label={uuLabel}
          value={summary.uu}
          changePercent={summary.uuChangePercent}
          comparisonLabel={COMPARISON_LABEL[period]}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-2 text-xs font-medium text-slate-500">
          {period === '24h' ? '時間別のアクセス推移' : '日別のアクセス推移'}
        </p>
        <TrendChart data={summary.daily.map((d) => ({ date: d.date, value: d.pv }))} valueLabel="PV" />
      </div>
    </div>
  );
}
