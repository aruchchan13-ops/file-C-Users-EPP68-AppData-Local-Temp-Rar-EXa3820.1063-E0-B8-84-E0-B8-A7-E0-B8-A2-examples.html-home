import type { Measurement, MeasurementType } from '../types';
import { MEASUREMENT_TYPES } from '../types';
import { clamp, mean } from '../utils/stats';

/**
 * MEASUREMENT SCORING
 * -------------------
 * Every measurement keeps its raw value (logMAR, cells, % contrast, ms). For
 * trend analysis the raw value is normalised to "% of personal baseline" so that
 * the four tests can be compared and averaged. HIGHER SCORE = BETTER, always.
 *
 *  near     raw = logMAR (lower is better). Converted to decimal acuity
 *           (10^-logMAR, higher is better) before the ratio:
 *           score = 10^-(raw − baseline) × 100
 *  contrast raw = threshold % (lower is better) → inverted ratio:
 *           score = baseline / raw × 100
 *  focus    raw = mean switching ms (lower is better) → inverted ratio:
 *           score = baseline / raw × 100
 *  amsler   raw = distorted cells (lower is better; baseline is often 0, so a
 *           ratio would divide by zero). Linear penalty instead:
 *           score = 100 − 5 × (raw − baseline)
 *
 * Scores are clamped to 0–150 so one outlier cannot dominate an average.
 * Missing measurements are null — they are never treated as 0.
 */
export const SCORE_MIN = 0;
export const SCORE_MAX = 150;
export const AMSLER_POINTS_PER_CELL = 5;
export const BASELINE_DAYS_REQUIRED = 3;

export const VALID_RANGE: Record<MeasurementType, [number, number]> = {
  near: [-0.3, 1.3],
  amsler: [0, 100],
  contrast: [0.1, 100],
  focus: [100, 20000],
};

export function isValidRaw(type: MeasurementType, raw: unknown): raw is number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return false;
  const [lo, hi] = VALID_RANGE[type];
  return raw >= lo && raw <= hi;
}

export function normalise(type: MeasurementType, raw: number, baseline: number): number | null {
  if (!isValidRaw(type, raw) || !isValidRaw(type, baseline)) return null;
  let s: number;
  switch (type) {
    case 'near':
      s = 10 ** -(raw - baseline) * 100;
      break;
    case 'contrast':
    case 'focus':
      s = (baseline / raw) * 100; // both > 0 by VALID_RANGE
      break;
    case 'amsler':
      s = 100 - AMSLER_POINTS_PER_CELL * (raw - baseline);
      break;
  }
  return clamp(s, SCORE_MIN, SCORE_MAX);
}

/** Mean raw value per mission day for one test type (several tests on one day are averaged). */
export function dailyRawByType(measurements: Measurement[], type: MeasurementType): Map<number, number> {
  const byDay = new Map<number, number[]>();
  for (const m of measurements) {
    if (m.type !== type || !isValidRaw(type, m.raw)) continue;
    const list = byDay.get(m.day) ?? [];
    list.push(m.raw);
    byDay.set(m.day, list);
  }
  const out = new Map<number, number>();
  for (const [day, list] of byDay) out.set(day, mean(list)!);
  return out;
}

export interface CategoryBaseline {
  type: MeasurementType;
  value: number | null; // raw units
  days: number[]; // the mission days used
  daysAvailable: number; // how many valid days exist so far (max 3 shown)
}

/**
 * BASELINE CALCULATION
 * The personal baseline of each test is the mean of its daily raw values on the
 * first three mission days that have a valid measurement of that test.
 * Until three valid days exist the baseline is "building" and scores are null.
 */
export function computeBaselines(measurements: Measurement[]): Record<MeasurementType, CategoryBaseline> {
  const result = {} as Record<MeasurementType, CategoryBaseline>;
  for (const type of MEASUREMENT_TYPES) {
    const daily = dailyRawByType(measurements, type);
    const days = [...daily.keys()].sort((a, b) => a - b);
    const first = days.slice(0, BASELINE_DAYS_REQUIRED);
    result[type] = {
      type,
      value: first.length === BASELINE_DAYS_REQUIRED ? mean(first.map((d) => daily.get(d)!)) : null,
      days: first,
      daysAvailable: Math.min(days.length, BASELINE_DAYS_REQUIRED),
    };
  }
  return result;
}

export interface DayScore {
  day: number;
  raw: Partial<Record<MeasurementType, number>>;
  scores: Partial<Record<MeasurementType, number>>;
  /** Mean of the available category scores; null if no scored test that day. */
  composite: number | null;
  /** Rolling mean of composite over days d−6…d (needs ≥3 scored days). */
  avg7: number | null;
}

export const AVG7_MIN_DAYS = 3;

/** Daily score series for mission days 1…lastDay (days without data have composite = null). */
export function computeDailyScores(
  measurements: Measurement[],
  baselines: Record<MeasurementType, CategoryBaseline>,
  lastDay: number,
): DayScore[] {
  const dailyRaw = Object.fromEntries(MEASUREMENT_TYPES.map((t) => [t, dailyRawByType(measurements, t)])) as Record<
    MeasurementType,
    Map<number, number>
  >;
  const series: DayScore[] = [];
  for (let day = 1; day <= lastDay; day++) {
    const raw: DayScore['raw'] = {};
    const scores: DayScore['scores'] = {};
    for (const t of MEASUREMENT_TYPES) {
      const r = dailyRaw[t].get(day);
      if (r === undefined) continue;
      raw[t] = r;
      const b = baselines[t].value;
      if (b !== null) {
        const s = normalise(t, r, b);
        if (s !== null) scores[t] = s;
      }
    }
    series.push({ day, raw, scores, composite: mean(Object.values(scores)), avg7: null });
  }
  for (let i = 0; i < series.length; i++) {
    const window = series.slice(Math.max(0, i - 6), i + 1).map((d) => d.composite);
    const available = window.filter((x) => x !== null).length;
    series[i].avg7 = available >= AVG7_MIN_DAYS ? mean(window) : null;
  }
  return series;
}

/** Mean score of one category over a window of days (null if no data). */
export function categoryMean(series: DayScore[], type: MeasurementType, fromDay: number, toDay: number): number | null {
  return mean(series.filter((d) => d.day >= fromDay && d.day <= toDay).map((d) => d.scores[type] ?? null));
}
