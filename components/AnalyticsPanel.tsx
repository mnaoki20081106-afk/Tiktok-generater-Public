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
  '24h': '直前24時間枠と比較',
  '7d': '直前7日間と比較',
  '30d': '直前30日間と比較',
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
    <div className="analytics-console flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold text-slate-100">アクセスの動き</h2><p className="mt-1 text-xs text-slate-400">閲覧数と訪問者数を期間ごとに確認</p></div>
        <div className="inline-flex rounded-lg border border-cyan-300/15 bg-[#0c1b2d] p-0.5">
          {(['24h', '7d', '30d'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              aria-pressed={period === p}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                period === p ? 'bg-gradient-to-r from-cyan-300 to-sky-400 text-slate-950' : 'text-slate-400 hover:text-slate-100'
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

      <section className="min-w-0 analytics-surface rounded-2xl border border-cyan-300/15 bg-[#0c1b2d] p-4 sm:p-6" aria-label="アクセス推移">
        <div className="mb-5">
          <h3 className="font-semibold text-slate-100">{period === '24h' ? '時間別のアクセス推移' : '日別のアクセス推移'}</h3>
          <p className="mt-1 text-xs text-slate-400">{PERIOD_LABEL[period]}・現在の{period === '24h' ? '時間' : '日'}を含む（集計途中）</p>
        </div>
        <TrendChart key={period} data={summary.daily.map((d) => ({ date: d.date, value: d.pv, visitors: d.uu }))} valueLabel="PV" />
      </section>
      <p className="text-xs leading-relaxed text-slate-400">PVはページの閲覧回数、UUは同じ端末の重複を除いた訪問者数です。リンク先への遷移数・TikTokの招待成立数は、この画面では計測していません。</p>
    </div>
  );
}
