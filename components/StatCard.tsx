import { ArrowDown, ArrowUp } from 'lucide-react';

/** PV/UUなどの数値を表示するスタットタイル。増減率バッジ付き */
export function StatCard({
  label,
  value,
  changePercent,
  comparisonLabel,
}: {
  label: string;
  value: number;
  changePercent: number | null;
  comparisonLabel: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <p className="text-2xl font-semibold text-slate-900">{value.toLocaleString()}</p>
        {changePercent !== null && (
          <span
            className="flex items-center gap-0.5 text-xs font-medium"
            style={{ color: changePercent >= 0 ? '#006300' : '#d03b3b' }}
          >
            {changePercent >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
            {Math.abs(changePercent)}%
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[11px] text-slate-400">
        {changePercent === null ? '比較データなし' : comparisonLabel}
      </p>
    </div>
  );
}
