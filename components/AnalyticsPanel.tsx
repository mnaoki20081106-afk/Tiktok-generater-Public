'use client';

import { useState } from 'react';
import { StatCard } from '@/components/StatCard';
import { TrendChart } from '@/components/TrendChart';
import type { AnalyticsSummary } from '@/lib/analytics';

/** PV/UUのスタットタイル + 期間切り替え(過去7日間/過去30日間) + トレンドグラフ */
export function AnalyticsPanel({
  summary7,
  summary30,
  pvLabel = 'ページビュー(PV)',
  uuLabel = '訪問者数(UU)',
}: {
  summary7: AnalyticsSummary;
  summary30: AnalyticsSummary;
  pvLabel?: string;
  uuLabel?: string;
}) {
  const [period, setPeriod] = useState<7 | 30>(7);
  const summary = period === 7 ? summary7 : summary30;
  const comparisonLabel = period === 7 ? '前週より' : '前月より';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          {([7, 30] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                period === p ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              過去{p}日間
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label={pvLabel} value={summary.pv} changePercent={summary.pvChangePercent} comparisonLabel={comparisonLabel} />
        <StatCard label={uuLabel} value={summary.uu} changePercent={summary.uuChangePercent} comparisonLabel={comparisonLabel} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-2 text-xs font-medium text-slate-500">日別のアクセス推移</p>
        <TrendChart data={summary.daily.map((d) => ({ date: d.date, value: d.pv }))} valueLabel="PV" />
      </div>
    </div>
  );
}
