import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DayScore } from '../../services/scoringService';
import type { MeasurementType } from '../../types';
import { MEASUREMENT_TYPES } from '../../types';
import { MEASUREMENT_META } from '../../services/measurementService';
import { THRESHOLDS } from '../../services/alertService';
import { mean } from '../../utils/stats';

import { useUi } from '../../hooks/useUi';

/** Chart colours per theme (SVG attributes cannot read CSS variables reliably). */
const PALETTES = {
  light: {
    brand: '#13294B',
    link: '#1F4C94',
    muted: '#44506A',
    grid: '#D6DCE7',
    caution: '#7A4F00',
    danger: '#B3261E',
    safe: '#1A6340',
    daily: '#8C9BB8',
    cat: { near: '#13294B', contrast: '#1F7A8C', focus: '#8A4F9E', amsler: '#B5651D' },
  },
  dark: {
    brand: '#B7CEF4',
    link: '#8FB4F0',
    muted: '#A6B2C7',
    grid: '#283956',
    caution: '#F5C76B',
    danger: '#FF8F85',
    safe: '#7FD1A4',
    daily: '#5D6F8F',
    cat: { near: '#B7CEF4', contrast: '#5CC6D6', focus: '#C9A2F0', amsler: '#F0A766' },
  },
};
export type ChartPalette = (typeof PALETTES)['light'];
export function useChartColors(): ChartPalette {
  return PALETTES[useUi().resolvedTheme];
}

// Distinct series colours plus distinct dash patterns (never colour alone).
const CAT_DASH: Record<MeasurementType, string | undefined> = { near: undefined, contrast: '6 3', focus: '2 3', amsler: '10 4 2 4' };
const axisProps = (C: ChartPalette) => ({ stroke: C.muted, fontSize: 12, tickLine: false }) as const;

function TooltipBox({ active, payload, label, dateOf, unit = '%' }: { active?: boolean; payload?: { name: string; value: number | null; color: string }[]; label?: number; dateOf: (d: number) => Date; unit?: string }) {
  if (!active || !payload?.length || label === undefined) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow">
      <p className="font-semibold text-ink">
        วันภารกิจ {label} · {dateOf(label).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
      </p>
      {payload.map((p) => (
        <p key={p.name} className="num" style={{ color: p.color }}>
          {p.name}: {p.value === null || p.value === undefined ? '—' : `${Number(p.value).toFixed(1)}${unit}`}
        </p>
      ))}
    </div>
  );
}

/** Composite vision score vs. personal baseline with alert thresholds. */
export function VisionTrendChart({ series, maxDay, dateOf, examDays = [], height = 300, fromDay = 1 }: { series: DayScore[]; maxDay: number; dateOf: (d: number) => Date; examDays?: number[]; height?: number; fromDay?: number }) {
  const C = useChartColors();
  const axis = axisProps(C);
  const data = series.filter((d) => d.day >= fromDay).map((d) => ({ day: d.day, daily: d.composite, avg7: d.avg7 }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 24, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="day" type="number" domain={[fromDay, maxDay]} {...axis} tickCount={8} allowDecimals={false} />
        <YAxis domain={[60, 115]} {...axis} unit="%" ticks={[60, 70, 80, 90, 100, 110]} />
        <Tooltip content={<TooltipBox dateOf={dateOf} />} />
        <ReferenceLine y={100} stroke={C.brand} strokeWidth={1.5} label={{ value: 'baseline 100%', position: 'insideTopLeft', fill: C.brand, fontSize: 11 }} />
        <ReferenceLine y={THRESHOLDS.yellowAvg7} stroke={C.caution} strokeDasharray="6 4" label={{ value: `เหลือง ${THRESHOLDS.yellowAvg7}% (เฉลี่ย 7 วัน)`, position: 'insideBottomLeft', fill: C.caution, fontSize: 11 }} />
        <ReferenceLine y={THRESHOLDS.redDaily} stroke={C.danger} strokeDasharray="2 3" label={{ value: `แดง ${THRESHOLDS.redDaily}% (รายวัน)`, position: 'insideBottomLeft', fill: C.danger, fontSize: 11 }} />
        {examDays
          .filter((d) => d >= fromDay && d <= maxDay)
          .map((d) => (
            <ReferenceLine key={d} x={d} stroke={C.link} strokeDasharray="4 4" label={{ value: `ตรวจตา D${d}`, position: 'top', fill: C.link, fontSize: 11 }} />
          ))}
        <Line type="monotone" dataKey="daily" name="คะแนนรายวัน" stroke={C.daily} dot={false} strokeWidth={1.2} connectNulls={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="avg7" name="ค่าเฉลี่ย 7 วัน" stroke={C.brand} dot={false} strokeWidth={2.6} connectNulls={false} isAnimationActive={false} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** 7-day rolling mean per test category. */
export function CategoryChart({ series, maxDay, dateOf, height = 280 }: { series: DayScore[]; maxDay: number; dateOf: (d: number) => Date; height?: number }) {
  const C = useChartColors();
  const axis = axisProps(C);
  const data = series.map((d, i) => {
    const row: Record<string, number | null> = { day: d.day };
    for (const t of MEASUREMENT_TYPES) row[t] = mean(series.slice(Math.max(0, i - 6), i + 1).map((x) => x.scores[t] ?? null));
    return row;
  });
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="day" type="number" domain={[1, maxDay]} {...axis} tickCount={8} allowDecimals={false} />
        <YAxis domain={[50, 120]} {...axis} unit="%" />
        <Tooltip content={<TooltipBox dateOf={dateOf} />} />
        <ReferenceLine y={100} stroke={C.brand} strokeWidth={1} />
        {MEASUREMENT_TYPES.map((t) => (
          <Line key={t} type="monotone" dataKey={t} name={MEASUREMENT_META[t].label} stroke={C.cat[t]} strokeDasharray={CAT_DASH[t]} dot={false} strokeWidth={2} isAnimationActive={false} />
        ))}
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function WeeklyBarChart({
  data,
  bars,
  height = 240,
  unit = '',
  yMax,
}: {
  data: Record<string, number | string | null>[];
  bars: { key: string; name: string; color: string }[];
  height?: number;
  unit?: string;
  yMax?: number;
}) {
  const C = useChartColors();
  const axis = axisProps(C);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" {...axis} interval="preserveStartEnd" />
        <YAxis {...axis} unit={unit} domain={yMax ? [0, yMax] : [0, 'auto']} allowDecimals={false} />
        <Tooltip
          contentStyle={{ borderRadius: 8, borderColor: C.grid, fontSize: 13, background: 'rgb(var(--c-surface))', color: 'rgb(var(--c-ink))' }}
          cursor={{ fill: 'rgb(var(--c-alt))' }}
          formatter={(v: number) => (v === null || v === undefined ? '—' : `${Math.round(v)}${unit}`)}
          labelFormatter={(l) => `${l}`}
        />
        {bars.map((b) => (
          <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        ))}
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

