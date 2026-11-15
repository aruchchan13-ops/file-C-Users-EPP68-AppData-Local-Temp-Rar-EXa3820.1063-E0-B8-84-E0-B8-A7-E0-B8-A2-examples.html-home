import type { DailyCheck, MeasurementType, ScenarioResult, Symptom } from '../types';
import { MEASUREMENT_TYPES } from '../types';
import type { CategoryBaseline, DayScore } from './scoringService';
import { categoryMean } from './scoringService';
import { SCENARIOS } from '../data/scenarios';
import { LESSONS } from '../data/lessons';

/**
 * ADAPTIVE DIFFICULTY
 * -------------------
 * Difficulty level 1–5 (safe limits), starting at 2. It is replayed from the
 * stored daily composite scores, so every page computes the same level:
 *  - strong day (score ≥ 95 % of baseline) three days in a row → level + 1
 *  - poor day (score < 90 % of baseline) → level − 1 immediately
 *  - a day without a score breaks the "three in a row" streak
 * The level for day d uses performance up to day d−1.
 * High fatigue (≥ 7/10 today) does not change the level; it shortens the plan.
 */
export const LEVEL_MIN = 1;
export const LEVEL_MAX = 5;
export const LEVEL_START = 2;
export const STRONG_SCORE = 95;
export const POOR_SCORE = 90;
export const FATIGUE_HIGH = 7;
export const NORMAL_BUDGET_MIN = 6;
export const FATIGUE_BUDGET_MIN = 3;

export const ACTIVITY_MINUTES: Record<MeasurementType | 'check' | 'scenario' | 'lesson', number> = {
  check: 0.5,
  near: 1.5,
  amsler: 1,
  contrast: 1.5,
  focus: 1.5,
  scenario: 1,
  lesson: 1,
};

/** Per-level settings used by the measurement modules. */
export const LEVEL_SETTINGS: Record<number, { nearStartLogMAR: number; contrastStart: number; focusChoices: number; focusDigits: number }> = {
  1: { nearStartLogMAR: 0.7, contrastStart: 40, focusChoices: 3, focusDigits: 2 },
  2: { nearStartLogMAR: 0.6, contrastStart: 25, focusChoices: 4, focusDigits: 2 },
  3: { nearStartLogMAR: 0.5, contrastStart: 16, focusChoices: 4, focusDigits: 3 },
  4: { nearStartLogMAR: 0.4, contrastStart: 10, focusChoices: 5, focusDigits: 3 },
  5: { nearStartLogMAR: 0.3, contrastStart: 6, focusChoices: 6, focusDigits: 4 },
};

export interface LevelStep {
  day: number;
  level: number;
  change: 'up' | 'down' | 'none';
  reason: string;
}

export function difficultyHistory(series: DayScore[], uptoDay: number): LevelStep[] {
  let level = LEVEL_START;
  let streak = 0;
  const steps: LevelStep[] = [];
  for (let day = 1; day <= uptoDay; day++) {
    // level in effect on `day` is decided by day−1
    const prev = series.find((d) => d.day === day - 1);
    let change: LevelStep['change'] = 'none';
    let reason = '';
    const s = prev?.composite ?? null;
    if (day > 1) {
      if (s === null) streak = 0;
      else if (s >= STRONG_SCORE) {
        streak++;
        if (streak >= 3) {
          if (level < LEVEL_MAX) {
            level++;
            change = 'up';
            reason = `ทำได้ดี (≥${STRONG_SCORE}%) 3 วันติดต่อกัน`;
          }
          streak = 0;
        }
      } else if (s < POOR_SCORE) {
        streak = 0;
        if (level > LEVEL_MIN) {
          level--;
          change = 'down';
          reason = `คะแนนเมื่อวาน ${s.toFixed(1)}% (< ${POOR_SCORE}%)`;
        }
      } else streak = 0;
    }
    steps.push({ day, level, change, reason });
  }
  return steps;
}

export function fatigueToday(day: number, checks: DailyCheck[], symptoms: Symptom[]): number | null {
  const c = checks.filter((x) => x.day === day).sort((a, b) => b.timestamp - a.timestamp)[0];
  const sym = symptoms.filter((s) => s.day === day && s.category === 'fatigue').map((s) => s.severity);
  const vals = [c?.fatigue, ...sym].filter((v): v is number => typeof v === 'number');
  return vals.length ? Math.max(...vals) : null;
}

export interface PlanItem {
  id: string;
  kind: 'check' | 'measure' | 'scenario' | 'lesson';
  type?: MeasurementType;
  scenarioId?: string;
  lessonId?: string;
  minutes: number;
  reason: string;
}

export interface DailyPlan {
  day: number;
  level: number;
  levelReason: string;
  fatigue: number | null;
  fatigueHigh: boolean;
  budget: number;
  items: PlanItem[];
  totalMinutes: number;
  weakest: { type: MeasurementType; mean: number | null }[];
  buildingBaseline: boolean;
}

export function buildDailyPlan(args: {
  day: number;
  series: DayScore[];
  baselines: Record<MeasurementType, CategoryBaseline>;
  checks: DailyCheck[];
  symptoms: Symptom[];
  scenarioResults: ScenarioResult[];
  completedLessons: string[];
}): DailyPlan {
  const { day, series, baselines, checks, symptoms, scenarioResults, completedLessons } = args;
  const steps = difficultyHistory(series, day);
  const today = steps[steps.length - 1] ?? { level: LEVEL_START, reason: '', change: 'none' };
  const lastChange = [...steps].reverse().find((s) => s.change !== 'none');
  const fatigue = fatigueToday(day, checks, symptoms);
  const fatigueHigh = fatigue !== null && fatigue >= FATIGUE_HIGH;
  const budget = fatigueHigh ? FATIGUE_BUDGET_MIN : NORMAL_BUDGET_MIN;

  const buildingBaseline = MEASUREMENT_TYPES.some((t) => baselines[t].value === null);
  // Weakest category this week = lowest mean score over days d−6…d (unknown sorts first while baseline is building).
  const weakest = MEASUREMENT_TYPES.map((type) => ({ type, mean: categoryMean(series, type, day - 6, day) })).sort((a, b) => {
    if (buildingBaseline) return baselines[a.type].daysAvailable - baselines[b.type].daysAvailable;
    return (a.mean ?? 999) - (b.mean ?? 999);
  });

  const items: PlanItem[] = [{ id: 'check', kind: 'check', minutes: ACTIVITY_MINUTES.check, reason: 'เช็กอาการและความล้าก่อนเริ่ม (ใช้ปรับภาระของแผน)' }];
  let used = ACTIVITY_MINUTES.check;
  const add = (item: PlanItem) => {
    if (used + item.minutes > budget + 1e-9) return false;
    items.push(item);
    used += item.minutes;
    return true;
  };
  const measure = (type: MeasurementType, reason: string): PlanItem => ({ id: `m-${type}`, kind: 'measure', type, minutes: ACTIVITY_MINUTES[type], reason });

  if (buildingBaseline) {
    for (const w of weakest) add(measure(w.type, `กำลังสร้าง baseline (${baselines[w.type].daysAvailable}/3 วัน)`));
  } else {
    const fmt = (m: number | null) => (m === null ? 'ยังไม่มีข้อมูลสัปดาห์นี้' : `เฉลี่ยสัปดาห์นี้ ${m.toFixed(1)}%`);
    add(measure(weakest[0].type, `อ่อนที่สุดสัปดาห์นี้ (${fmt(weakest[0].mean)})`));
    if (!fatigueHigh && weakest[0].type !== 'focus') add(measure('focus', 'ฝึกสลับโฟกัสใกล้–ไกลทุกวัน'));
    if (fatigueHigh) for (const w of weakest.slice(1)) add(measure(w.type, `แผนสั้นเพราะความล้าสูง (${fmt(w.mean)})`));
    if (!fatigueHigh) {
      const sc = pickScenario(today.level, scenarioResults);
      if (sc) add({ id: `s-${sc.id}`, kind: 'scenario', scenarioId: sc.id, minutes: ACTIVITY_MINUTES.scenario, reason: sc.reason });
      for (const w of weakest.slice(1)) {
        if (w.type === 'focus') continue;
        add(measure(w.type, `ลำดับถัดไปตามคะแนน (${fmt(w.mean)})`));
      }
      const lesson = LESSONS.find((l) => !completedLessons.includes(l.id));
      if (lesson) add({ id: `l-${lesson.id}`, kind: 'lesson', lessonId: lesson.id, minutes: ACTIVITY_MINUTES.lesson, reason: 'บทเรียนสั้นที่ยังไม่ได้เรียน' });
    }
  }

  return {
    day,
    level: today.level,
    levelReason: lastChange ? `ปรับล่าสุดวันที่ ${lastChange.day}: ${lastChange.reason}` : 'ระดับเริ่มต้น',
    fatigue,
    fatigueHigh,
    budget,
    items,
    totalMinutes: used,
    weakest,
    buildingBaseline,
  };
}

function pickScenario(level: number, results: ScenarioResult[]): { id: string; reason: string } | null {
  const allowed = SCENARIOS.filter((s) => s.difficulty <= level + 1);
  const best = (id: string) => Math.max(-1, ...results.filter((r) => r.scenarioId === id).map((r) => r.score));
  const next = allowed.find((s) => best(s.id) < 0);
  if (next) return { id: next.id, reason: `สถานการณ์ใหม่ (ความยาก ${next.difficulty})` };
  const weakest = [...allowed].sort((a, b) => best(a.id) - best(b.id))[0];
  if (weakest && best(weakest.id) < 90) return { id: weakest.id, reason: `ฝึกซ้ำ (คะแนนดีที่สุด ${best(weakest.id)})` };
  return null;
}
