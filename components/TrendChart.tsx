'use client';

import { useId, useRef, useState } from 'react';
import { X } from 'lucide-react';

export interface TrendChartPoint {
  /** 日次データは YYYY-MM-DD、時間単位データは YYYY-MM-DDTHH */
  date: string;
  value: number;
}

const WIDTH = 600;
const HEIGHT = 160;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;
/** この距離(SVGユーザー単位)未満の移動はドラッグではなくタップ/ホバーとして扱う */
const DRAG_THRESHOLD = 6;

function isHourly(key: string): boolean {
  return key.includes('T');
}

function formatDateLabel(key: string): string {
  if (isHourly(key)) {
    const hour = key.slice(11, 13);
    return `${Number(hour)}時`;
  }
  const [, m, d] = key.split('-');
  return `${Number(m)}/${Number(d)}`;
}

function formatRangeLabel(startKey: string, endKey: string): string {
  if (startKey === endKey) return formatDateLabel(startKey);
  return `${formatDateLabel(startKey)} 〜 ${formatDateLabel(endKey)}`;
}

/**
 * 推移を示す面グラフ(単一系列)。dataviz skillの仕様に沿い、2pxの線・薄い
 * グラデーション塗り・末端の丸マーカー・ホバー/タップ時のツールチップを持つ。
 * さらに、Cloudflareのメトリクス画面のように、グラフ上をドラッグで囲むと
 * その範囲の合計値を確認できる(スマホでは指でなぞって範囲選択できる)。
 */
export function TrendChart({
  data,
  color = '#2a78d6',
  valueLabel = '件',
}: {
  data: TrendChartPoint[];
  color?: string;
  valueLabel?: string;
}) {
  const gradientId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ startIdx: number; currentIdx: number; dragging: boolean } | null>(null);
  const [selection, setSelection] = useState<{ startIdx: number; endIdx: number } | null>(null);

  const innerHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const maxValue = Math.max(1, ...data.map((d) => d.value));
  const stepX = data.length > 1 ? WIDTH / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = data.length > 1 ? i * stepX : WIDTH / 2;
    const y = PAD_TOP + innerHeight - (d.value / maxValue) * innerHeight;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath =
    points.length > 0
      ? `${linePath} L${points[points.length - 1].x.toFixed(1)},${PAD_TOP + innerHeight} ` +
        `L${points[0].x.toFixed(1)},${PAD_TOP + innerHeight} Z`
      : '';

  const active = !selection && activeIndex !== null ? points[activeIndex] : null;
  const lastPoint = points[points.length - 1];

  // ラベルは詰まりすぎないよう間引く(最大6個程度)
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));

  function clientXToIndex(clientX: number): number {
    const svg = svgRef.current;
    if (!svg || points.length === 0) return 0;
    const rect = svg.getBoundingClientRect();
    const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    const x = ratio * WIDTH;
    const idx = data.length > 1 ? Math.round(x / stepX) : 0;
    return Math.min(Math.max(idx, 0), points.length - 1);
  }

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const idx = clientXToIndex(e.clientX);
    setDrag({ startIdx: idx, currentIdx: idx, dragging: false });
    setSelection(null);
    setActiveIndex(idx);
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!drag) {
      if (e.pointerType === 'mouse') setActiveIndex(clientXToIndex(e.clientX));
      return;
    }
    const idx = clientXToIndex(e.clientX);
    const movedEnough = Math.abs(idx - drag.startIdx) * stepX >= DRAG_THRESHOLD || drag.dragging;
    setDrag({ startIdx: drag.startIdx, currentIdx: idx, dragging: movedEnough });
    setActiveIndex(idx);
  }

  function finishDrag() {
    if (drag && drag.dragging) {
      const startIdx = Math.min(drag.startIdx, drag.currentIdx);
      const endIdx = Math.max(drag.startIdx, drag.currentIdx);
      if (endIdx > startIdx) setSelection({ startIdx, endIdx });
    }
    setDrag(null);
  }

  const selRange = drag && drag.dragging ? { startIdx: Math.min(drag.startIdx, drag.currentIdx), endIdx: Math.max(drag.startIdx, drag.currentIdx) } : selection;
  const selPoints = selRange ? points.slice(selRange.startIdx, selRange.endIdx + 1) : null;
  const selTotal = selPoints ? selPoints.reduce((sum, p) => sum + p.value, 0) : null;

  return (
    <div className="w-full select-none">
      {selRange && selPoints && selTotal !== null ? (
        <div className="mb-2 flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
          <span className="text-slate-600">
            {formatRangeLabel(selPoints[0].date, selPoints[selPoints.length - 1].date)}: 合計{' '}
            <span className="font-semibold text-slate-900">{selTotal.toLocaleString()}</span> {valueLabel}
          </span>
          {selection && !drag && (
            <button
              type="button"
              onClick={() => setSelection(null)}
              className="flex items-center gap-0.5 text-slate-400 hover:text-slate-700"
            >
              <X size={12} />
              選択解除
            </button>
          )}
        </div>
      ) : (
        <p className="mb-2 text-[11px] text-slate-400">ドラッグ(スマホは指でなぞる)で範囲を囲むと合計が見られます</p>
      )}

      <div className="relative w-full">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full touch-pan-y"
          style={{ height: HEIGHT }}
          preserveAspectRatio="none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={() => setDrag(null)}
          onMouseLeave={() => {
            if (!drag) setActiveIndex(null);
          }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* hairlineの基準線(0とmax) */}
          <line x1={0} y1={PAD_TOP} x2={WIDTH} y2={PAD_TOP} stroke="#e1e0d9" strokeWidth={1} />
          <line x1={0} y1={PAD_TOP + innerHeight} x2={WIDTH} y2={PAD_TOP + innerHeight} stroke="#c3c2b7" strokeWidth={1} />

          {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />}
          {linePath && (
            <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          )}

          {selRange && (
            <rect
              x={points[selRange.startIdx].x}
              y={PAD_TOP}
              width={Math.max(0, points[selRange.endIdx].x - points[selRange.startIdx].x)}
              height={innerHeight}
              fill={color}
              fillOpacity={0.1}
              stroke={color}
              strokeOpacity={0.4}
              strokeWidth={1}
            />
          )}

          {lastPoint && !selRange && <circle cx={lastPoint.x} cy={lastPoint.y} r={4} fill={color} stroke="#fff" strokeWidth={2} />}
          {active && activeIndex !== points.length - 1 && (
            <circle cx={active.x} cy={active.y} r={4} fill={color} stroke="#fff" strokeWidth={2} />
          )}
          {active && (
            <line x1={active.x} y1={PAD_TOP} x2={active.x} y2={PAD_TOP + innerHeight} stroke="#c3c2b7" strokeWidth={1} />
          )}

          {points.map((p, i) => {
            if (i % labelEvery !== 0 && i !== points.length - 1) return null;
            return (
              <text
                key={p.date}
                x={Math.min(Math.max(p.x, 14), WIDTH - 14)}
                y={HEIGHT - 4}
                textAnchor="middle"
                fontSize={11}
                fill="#898781"
              >
                {formatDateLabel(p.date)}
              </text>
            );
          })}
        </svg>

        {active && (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-md"
            style={{
              left: `${(active.x / WIDTH) * 100}%`,
              transform: `translateX(${active.x < 60 ? '0%' : active.x > WIDTH - 60 ? '-100%' : '-50%'})`,
            }}
          >
            <p className="font-medium text-slate-900">{formatDateLabel(active.date)}</p>
            <p className="text-slate-500">
              {active.value.toLocaleString()} {valueLabel}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
