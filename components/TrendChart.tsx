'use client';

import { useId, useRef, useState } from 'react';

export interface TrendChartPoint {
  /** UTC: YYYY-MM-DD or YYYY-MM-DDTHH */
  date: string;
  value: number;
  visitors?: number;
}

const WIDTH = 640;
const HEIGHT = 280;
const LEFT = 56;
const RIGHT = 22;
const TOP = 24;
const BOTTOM = 40;
const PLOT_WIDTH = WIDTH - LEFT - RIGHT;
const PLOT_HEIGHT = HEIGHT - TOP - BOTTOM;

export function formatChartDate(key: string): string {
  const [, month, day] = key.slice(0, 10).split('-');
  return `${Number(month)}/${Number(day)}${key.includes('T') ? ` ${key.slice(11, 13)}:00` : ''}`;
}

/** Integer tick spacing with headroom, including zero-only series. */
export function chartScale(max: number) {
  const raw = Math.max(1, max / 4);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].find((n) => n * magnitude >= raw)! * magnitude;
  const ceiling = Math.max(step, Math.ceil(max / step) * step);
  return { ceiling, ticks: Array.from({ length: Math.round(ceiling / step) + 1 }, (_, i) => i * step) };
}

export function TrendChart({ data, color = '#67e8f9', valueLabel = 'PV' }: {
  data: TrendChartPoint[];
  color?: string;
  valueLabel?: string;
}) {
  const id = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [metric, setMetric] = useState<'both' | 'pv' | 'uu'>('both');
  const [drag, setDrag] = useState<{ start: number; end: number } | null>(null);
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const hasVisitors = data.some((point) => point.visitors !== undefined);
  const showPv = metric !== 'uu' || !hasVisitors;
  const showUu = metric !== 'pv' && hasVisitors;
  const { ceiling, ticks } = chartScale(Math.max(0, ...data.flatMap((d) => [showPv ? d.value : 0, showUu ? d.visitors ?? 0 : 0])));
  const x = (i: number) => LEFT + (data.length > 1 ? (i / (data.length - 1)) * PLOT_WIDTH : PLOT_WIDTH / 2);
  const y = (v: number) => TOP + PLOT_HEIGHT * (1 - v / ceiling);
  const path = (field: 'value' | 'visitors') => data.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p[field] ?? 0)}`).join(' ');
  const active = activeIndex === null ? null : data[activeIndex];
  const range = drag && drag.start !== drag.end ? drag : selection;
  const rangeStart = range ? Math.min(range.start, range.end) : 0;
  const rangeEnd = range ? Math.max(range.start, range.end) : 0;
  const validRange = range && data[rangeStart] && data[rangeEnd];
  const rangePv = validRange ? data.slice(rangeStart, rangeEnd + 1).reduce((sum, d) => sum + d.value, 0) : 0;
  const labelIndices = [...new Set(Array.from({ length: Math.min(5, data.length) }, (_, i) => Math.round(i * (data.length - 1) / Math.max(1, Math.min(5, data.length) - 1))))];

  function indexAt(clientX: number) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !rect.width) return 0;
    const ratio = (((clientX - rect.left) / rect.width) * WIDTH - LEFT) / PLOT_WIDTH;
    return Math.max(0, Math.min(data.length - 1, Math.round(ratio * (data.length - 1))));
  }

  if (!data.length) return <p className="py-16 text-center text-sm text-slate-400">表示できる集計データがありません。</p>;

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-4 text-xs font-medium">
          <span className="flex items-center gap-2"><span className="h-0.5 w-5" style={{ background: color }} />閲覧数（{valueLabel}）</span>
          {hasVisitors && <span className="flex items-center gap-2"><span className="w-5 border-t-2 border-dashed border-teal-300" />訪問者数（UU）</span>}
        </div>
        {hasVisitors && <div className="flex gap-1 rounded-lg bg-[#061320] p-1" aria-label="表示する指標">
          {(['both', 'pv', 'uu'] as const).map((m) => <button key={m} type="button" aria-pressed={metric === m} onClick={() => setMetric(m)} className={`rounded-md px-3 py-2 text-xs font-medium ${metric === m ? 'bg-gradient-to-r from-cyan-300 to-sky-400 text-slate-950 shadow-sm' : 'text-slate-400'}`}>{m === 'both' ? '両方' : m.toUpperCase()}</button>)}
        </div>}
      </div>
      <div className="mb-3 min-h-14 rounded-xl bg-[#0c1c2d] px-4 py-3 text-sm" aria-live="polite" aria-atomic="true">
        {validRange ? <div className="flex flex-wrap items-center justify-between gap-2"><span>{formatChartDate(data[rangeStart].date)} ～ {formatChartDate(data[rangeEnd].date)} · <b>{rangePv.toLocaleString()} {valueLabel}</b></span><button type="button" className="text-xs text-cyan-300 underline" onClick={() => { setSelection(null); setDrag(null); }}>選択解除</button></div>
          : active ? <span><b>{formatChartDate(active.date)}</b><span className="ml-4 tabular-nums" style={{ color }}>{active.value.toLocaleString()} {valueLabel}</span>{hasVisitors && <span className="ml-4 tabular-nums text-teal-300">{(active.visitors ?? 0).toLocaleString()} UU</span>}</span>
          : <span className="text-slate-400">タップで日時ごとの数値を表示。PCではドラッグで範囲のPVを集計。</span>}
      </div>
      <div className="overflow-x-auto rounded-lg border border-cyan-300/10">
        <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block w-full min-w-[560px] touch-auto" role="img" aria-label={`${valueLabel}${hasVisitors ? 'とUU' : ''}のアクセス推移。詳細は下の数値表で確認できます。`} tabIndex={0}
          onKeyDown={(e) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
            e.preventDefault(); setSelection(null);
            setActiveIndex(e.key === 'Home' ? 0 : e.key === 'End' ? data.length - 1 : Math.max(0, Math.min(data.length - 1, (activeIndex ?? 0) + (e.key === 'ArrowRight' ? 1 : -1))));
          }}
          onPointerDown={(e) => { if (e.button !== 0) return; const idx = indexAt(e.clientX); e.currentTarget.setPointerCapture(e.pointerId); setActiveIndex(idx); setSelection(null); setDrag({ start: idx, end: idx }); }}
          onPointerMove={(e) => { const idx = indexAt(e.clientX); if (drag) { setDrag({ start: drag.start, end: idx }); setActiveIndex(idx); } else if (e.pointerType === 'mouse') setActiveIndex(idx); }}
          onPointerUp={() => { if (drag && drag.start !== drag.end) setSelection(drag); setDrag(null); }}
          onPointerCancel={() => setDrag(null)}>
          <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".18" /><stop offset="100%" stopColor={color} stopOpacity=".01" /></linearGradient></defs>
          {ticks.map((tick) => <g key={tick}><line x1={LEFT} x2={WIDTH - RIGHT} y1={y(tick)} y2={y(tick)} stroke="#20364c" strokeDasharray={tick ? '3 5' : undefined} /><text x={LEFT - 10} y={y(tick) + 4} textAnchor="end" fontSize="11" fill="#9fb4cd">{new Intl.NumberFormat('ja-JP', { notation: 'compact' }).format(tick)}</text></g>)}
          {showPv && <><path d={`${path('value')} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#${id})`} /><path d={path('value')} stroke={color} fill="none" strokeWidth="2.5" strokeLinejoin="round" /></>}
          {showUu && <path d={path('visitors')} stroke="#5eead4" fill="none" strokeWidth="2.5" strokeDasharray="6 4" strokeLinejoin="round" />}
          {data.length === 1 && <>{showPv && <circle cx={x(0)} cy={y(data[0].value)} r="4" fill={color} />}{showUu && <circle cx={x(0)} cy={y(data[0].visitors ?? 0)} r="4" fill="#5eead4" />}</>}
          {validRange && <rect x={x(rangeStart)} y={TOP} width={x(rangeEnd) - x(rangeStart)} height={PLOT_HEIGHT} fill={color} fillOpacity=".08" stroke={color} strokeOpacity=".3" />}
          {active && activeIndex !== null && !validRange && <g><line x1={x(activeIndex)} x2={x(activeIndex)} y1={TOP} y2={y(0)} stroke="#94a3b8" strokeDasharray="4 4" />{showPv && <circle cx={x(activeIndex)} cy={y(active.value)} r="5" fill={color} stroke="#0c1b2d" strokeWidth="2" />}{showUu && <circle cx={x(activeIndex)} cy={y(active.visitors ?? 0)} r="5" fill="#5eead4" stroke="#0c1b2d" strokeWidth="2" />}</g>}
          {labelIndices.map((i) => <text key={i} x={x(i)} y={HEIGHT - 14} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} fontSize="11" fill="#9fb4cd">{formatChartDate(data[i].date)}</text>)}
        </svg>
      </div>
      {data.every((d) => d.value === 0 && !d.visitors) && <p className="mt-3 text-sm text-slate-400">この期間の記録は0件です。アクセスが記録されると推移が表示されます。</p>}
      <p className="mt-3 text-xs leading-relaxed text-slate-400">日時はUTC。狭い画面では横スクロールできます。左右キーでも日時を選べます。{hasVisitors && ' UUは各時間・日ごとの重複を除いた訪問者数で、合算しても期間全体のUUにはなりません。'}</p>
      <details className="mt-4 border-t border-cyan-300/10 pt-3">
        <summary className="cursor-pointer text-sm font-medium text-cyan-100">数値表を表示</summary>
        <div className="mt-3 max-h-72 overflow-auto"><table className="w-full text-right text-sm tabular-nums"><caption className="sr-only">日時別アクセス数（UTC）</caption><thead className="sticky top-0 bg-[#0c1c2d]"><tr><th scope="col" className="p-2 text-left">日時</th><th scope="col" className="p-2">{valueLabel}</th>{hasVisitors && <th scope="col" className="p-2">UU</th>}</tr></thead><tbody>{data.map((d) => <tr key={d.date} className="border-t border-cyan-300/10"><th scope="row" className="p-2 text-left font-normal">{formatChartDate(d.date)}</th><td className="p-2">{d.value.toLocaleString()}</td>{hasVisitors && <td className="p-2">{(d.visitors ?? 0).toLocaleString()}</td>}</tr>)}</tbody></table></div>
      </details>
    </div>
  );
}
