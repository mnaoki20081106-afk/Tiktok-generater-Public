'use client';

import { useId, useState } from 'react';

export interface TrendChartPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

const WIDTH = 600;
const HEIGHT = 160;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;

function formatDateLabel(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${Number(m)}/${Number(d)}`;
}

/**
 * 日次の推移を示す面グラフ(単一系列)。dataviz skillの仕様に沿い、
 * 2pxの線・薄いグラデーション塗り・末端の丸マーカー・ホバー/タップ時のツールチップを持つ。
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
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

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

  const active = activeIndex !== null ? points[activeIndex] : null;
  const lastPoint = points[points.length - 1];

  // 日付ラベルは詰まりすぎないよう間引く(最大6個程度)
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));

  return (
    <div className="relative w-full select-none">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" style={{ height: HEIGHT }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* hairlineの基準線(0とmax) */}
        <line x1={0} y1={PAD_TOP} x2={WIDTH} y2={PAD_TOP} stroke="#e1e0d9" strokeWidth={1} />
        <line
          x1={0}
          y1={PAD_TOP + innerHeight}
          x2={WIDTH}
          y2={PAD_TOP + innerHeight}
          stroke="#c3c2b7"
          strokeWidth={1}
        />

        {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />}
        {linePath && <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}

        {lastPoint && (
          <circle cx={lastPoint.x} cy={lastPoint.y} r={4} fill={color} stroke="#fff" strokeWidth={2} />
        )}
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

        {/* タップ/ホバー用の当たり判定(データ点ごとに帯を分割) */}
        {points.map((p, i) => (
          <rect
            key={p.date}
            x={i === 0 ? 0 : (points[i - 1].x + p.x) / 2}
            y={0}
            width={
              (i === points.length - 1 ? WIDTH : (p.x + (points[i + 1]?.x ?? WIDTH)) / 2) -
              (i === 0 ? 0 : (points[i - 1].x + p.x) / 2)
            }
            height={HEIGHT}
            fill="transparent"
            onMouseEnter={() => setActiveIndex(i)}
            onMouseLeave={() => setActiveIndex(null)}
            onTouchStart={() => setActiveIndex(i)}
          />
        ))}
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
  );
}
