import type { DayScore } from '../../services/scoringService';
import { THRESHOLDS } from '../../services/alertService';

/** Dependency-free SVG trend used in the PDF report (renders reliably in html2canvas). */
export function TrendSvg({ series, from, to, width = 700, height = 220 }: { series: DayScore[]; from: number; to: number; width?: number; height?: number }) {
  const pad = { l: 40, r: 12, t: 12, b: 26 };
  const yMin = 60;
  const yMax = 115;
  const x = (d: number) => pad.l + ((d - from) / Math.max(1, to - from)) * (width - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (Math.min(yMax, Math.max(yMin, v)) - yMin) / (yMax - yMin)) * (height - pad.t - pad.b);
  const path = (key: 'composite' | 'avg7') => {
    let d = '';
    let pen = false;
    for (const s of series) {
      const v = s[key];
      if (v === null) {
        pen = false;
        continue;
      }
      d += `${pen ? 'L' : 'M'}${x(s.day).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    }
    return d;
  };
  const ticksX = Array.from({ length: 6 }, (_, i) => Math.round(from + ((to - from) * i) / 5));
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`แนวโน้มคะแนนการมองเห็นวันที่ ${from} ถึง ${to}`}>
      {[60, 70, 80, 90, 100, 110].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} stroke="#D6DCE7" strokeDasharray="3 3" />
          <text x={pad.l - 6} y={y(v) + 4} fontSize="11" textAnchor="end" fill="#44506A">
            {v}%
          </text>
        </g>
      ))}
      <line x1={pad.l} x2={width - pad.r} y1={y(100)} y2={y(100)} stroke="#13294B" strokeWidth="1.5" />
      <line x1={pad.l} x2={width - pad.r} y1={y(THRESHOLDS.yellowAvg7)} y2={y(THRESHOLDS.yellowAvg7)} stroke="#7A4F00" strokeDasharray="6 4" />
      <line x1={pad.l} x2={width - pad.r} y1={y(THRESHOLDS.redDaily)} y2={y(THRESHOLDS.redDaily)} stroke="#B3261E" strokeDasharray="2 3" />
      <path d={path('composite')} fill="none" stroke="#8C9BB8" strokeWidth="1.2" />
      <path d={path('avg7')} fill="none" stroke="#13294B" strokeWidth="2.6" />
      {ticksX.map((d) => (
        <text key={d} x={x(d)} y={height - 8} fontSize="11" textAnchor="middle" fill="#44506A">
          D{d}
        </text>
      ))}
    </svg>
  );
}
