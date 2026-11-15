import type { CountermeasureRecord, DailyCheck, Measurement, ScenarioResult, Symptom, SymptomCategory } from '../types';
import { gaussian, rngFor } from '../utils/rng';
import { clamp } from '../utils/stats';
import { SCENARIOS } from '../data/scenarios';

/**
 * DEMO DATA GENERATION (ข้อมูลจำลอง — synthetic, not real astronaut data)
 * ---------------------------------------------------------------------
 * A 180-day mission is generated deterministically: every value for mission
 * day d comes from a PRNG seeded with (DEMO_SEED, d, stream), so the same day
 * always yields the same data no matter how many days are generated.
 *
 * Latent visual performance P(d), on a 0–100 "performance index" where the
 * personal baseline is 100:
 *   days   1–90   P = 100                      (stable)
 *   days  91–105  P = 100 − 0.45·(d − 90)      (gradual decline, 0.45 pt/day)
 *   days 106–180  P = P(105) − 0.50·(d − 105)  (continued decline)
 * Each test declines with its own weight (near vision most, Amsler least;
 * weights average to 1) plus realistic noise, and is converted to raw units.
 *
 * Symptoms: low frequency until day 105, then frequency and severity increase.
 * Countermeasure adherence changes across three mission phases.
 *
 * Alerts are NEVER hard-coded: they are computed by alertService from these
 * generated values. The seed and slopes were calibrated (see
 * demoCalibration.test.ts) so that YELLOW first appears around day 109,
 * RED around day 133, and the scheduled eye exam falls on day 150.
 */
export const DEMO_DAYS = 180;
export const DEMO_START_ISO = '2026-01-05';
export const DEMO_SEED = 184;
export const EXAM_DAYS = [30, 90, 150];
export const MISSED_CHECK_DAYS = [40, 41, 42]; // the astronaut skipped eye checks (used in training stories)

export const DEMO_BASELINE_RAW = { near: 0.0, amsler: 0, contrast: 1.6, focus: 1150 };
const WEIGHTS = { near: 1.5, contrast: 1.1, focus: 0.9, amsler: 0.5 };
const NOISE_SD = { near: 2.2, contrast: 2.6, focus: 2.6 };

export function latentPerformance(day: number): number {
  if (day <= 90) return 100;
  if (day <= 105) return 100 - 0.45 * (day - 90);
  return 100 - 0.45 * 15 - 0.5 * (day - 105);
}

const DAY_MS = 86_400_000;
export function demoTimestamp(day: number, minutes: number): number {
  return Date.parse(`${DEMO_START_ISO}T00:00:00`) + (day - 1) * DAY_MS + minutes * 60_000;
}

function measurementsFor(day: number, seed: number): Measurement[] {
  const r = rngFor(seed, day, 'measure');
  const skipped = MISSED_CHECK_DAYS.includes(day) || (day > 3 && r() < 0.03);
  if (skipped) return [];
  const P = latentPerformance(day);
  const score = (w: number, sd: number) => 100 - w * (100 - P) + sd * gaussian(r);
  const base = DEMO_BASELINE_RAW;
  const t0 = 7 * 60 + 20 + Math.floor(r() * 30);
  const mk = (type: Measurement['type'], raw: number, i: number): Measurement => ({
    dataset: 'demo',
    source: 'synthetic',
    day,
    timestamp: demoTimestamp(day, t0 + i * 2),
    type,
    raw,
  });

  const sNear = clamp(score(WEIGHTS.near, NOISE_SD.near), 20, 130);
  const nearLogMAR = Math.round((base.near - Math.log10(sNear / 100)) * 30) / 30; // letter steps (0.1/3)
  const sContrast = clamp(score(WEIGHTS.contrast, NOISE_SD.contrast), 20, 130);
  const contrast = Math.round(((base.contrast * 100) / sContrast) * 100) / 100;
  const sFocus = clamp(score(WEIGHTS.focus, NOISE_SD.focus), 20, 130);
  const focus = Math.round((base.focus * 100) / sFocus);
  const sAmsler = 100 - WEIGHTS.amsler * (100 - P) + 1.5 * gaussian(r);
  const amsler = Math.max(0, Math.round((100 - sAmsler) / 5));

  return [mk('near', nearLogMAR, 0), mk('amsler', amsler, 1), mk('contrast', contrast, 2), mk('focus', focus, 3)];
}

/** Probability that a day has ≥ 2 symptom occurrences ("symptom day"). */
function multiSymptomProbability(day: number): number {
  if (day <= 90) return 0.02;
  if (day <= 105) return 0.04;
  return Math.min(0.92, 0.45 + (0.45 * (day - 106)) / 74);
}

function pickCategory(day: number, r: () => number): SymptomCategory {
  const late = day > 105;
  const table: [SymptomCategory, number][] = late
    ? [
        ['blurred', 0.3],
        ['headache', 0.25],
        ['focusing', 0.2],
        ['fatigue', 0.12],
        ['distorted', day > 140 ? 0.08 : 0.03],
        ['otherVisual', 0.05],
      ]
    : [
        ['fatigue', 0.45],
        ['headache', 0.35],
        ['blurred', 0.1],
        ['focusing', 0.06],
        ['otherVisual', 0.04],
      ];
  const total = table.reduce((a, [, w]) => a + w, 0);
  let x = r() * total;
  for (const [c, w] of table) {
    x -= w;
    if (x <= 0) return c;
  }
  return table[0][0];
}

function symptomsFor(day: number, seed: number): Symptom[] {
  const r = rngFor(seed, day, 'symptom');
  const x = r();
  const pMulti = multiSymptomProbability(day);
  const pSingle = day <= 90 ? 0.1 : day <= 105 ? 0.14 : 0.06;
  let count = 0;
  if (x < pMulti) count = 2 + (day > 140 && r() < 0.4 ? 1 : 0);
  else if (x < pMulti + pSingle) count = 1;
  const out: Symptom[] = [];
  const used = new Set<SymptomCategory>();
  for (let i = 0; i < count; i++) {
    let c = pickCategory(day, r);
    for (let tries = 0; used.has(c) && tries < 5; tries++) c = pickCategory(day, r);
    used.add(c);
    const sevBase = day <= 105 ? 2 : 2 + (day - 105) / 25;
    out.push({
      dataset: 'demo',
      source: 'synthetic',
      day,
      timestamp: demoTimestamp(day, 9 * 60 + Math.floor(r() * 600)),
      category: c,
      severity: Math.round(clamp(sevBase + gaussian(r), 1, 9)),
      durationMin: 15 + Math.round(r() * 12) * 15,
      notes: '',
    });
  }
  return out;
}

function countermeasureFor(day: number, seed: number): CountermeasureRecord | null {
  const r = rngFor(seed, day, 'cm');
  if (r() < 0.03) return null; // not logged that day
  const phase = day <= 90 ? 0 : day <= 130 ? 1 : 2;
  const p = [
    { lbnp: 0.85, cuffs: 0.7, exercise: 0.95, nutrition: 0.95 },
    { lbnp: 0.55, cuffs: 0.5, exercise: 0.85, nutrition: 0.8 },
    { lbnp: 0.75, cuffs: 0.4, exercise: 0.7, nutrition: 0.7 },
  ][phase];
  const minutes = (prob: number, lo: number, hi: number) => (r() < prob ? lo + Math.round((r() * (hi - lo)) / 5) * 5 : 0);
  return {
    dataset: 'demo',
    source: 'synthetic',
    day,
    lbnpMin: minutes(p.lbnp, 30, 45),
    cuffsMin: minutes(p.cuffs, 60, 120),
    exerciseMin: minutes(p.exercise, 60, 90),
    nutrition: r() < p.nutrition,
    updatedAt: demoTimestamp(day, 21 * 60),
  };
}

function dailyCheckFor(day: number, seed: number): DailyCheck | null {
  const r = rngFor(seed, day, 'check');
  if (MISSED_CHECK_DAYS.includes(day)) return null;
  const base = 2.5 + (day > 105 ? (day - 105) * 0.04 : 0);
  return {
    dataset: 'demo',
    source: 'synthetic',
    day,
    timestamp: demoTimestamp(day, 7 * 60),
    fatigue: Math.round(clamp(base + 1.3 * gaussian(r), 0, 10)),
  };
}

/** Scripted training history: scenarios completed on fixed days with realistic scores. */
const SCENARIO_SCHEDULE: { day: number; index: number; best: boolean }[] = [
  { day: 6, index: 0, best: true },
  { day: 15, index: 1, best: false },
  { day: 16, index: 1, best: true },
  { day: 28, index: 2, best: true },
  { day: 44, index: 3, best: true },
  { day: 63, index: 4, best: false },
  { day: 97, index: 4, best: true },
  { day: 121, index: 5, best: true },
];

function scenarioResultsFor(day: number): ScenarioResult[] {
  return SCENARIO_SCHEDULE.filter((s) => s.day === day).map((s) => {
    const sc = SCENARIOS[s.index];
    const choice = s.best ? sc.choices.find((c) => c.score === 100)! : sc.choices.find((c) => c.score > 0 && c.score < 100) ?? sc.choices[0];
    const checklistScore = s.best ? 80 : 60;
    return {
      dataset: 'demo',
      source: 'synthetic',
      day,
      timestamp: demoTimestamp(day, 19 * 60),
      scenarioId: sc.id,
      choiceId: choice.id,
      choiceScore: choice.score,
      checklistScore,
      score: Math.round(choice.score * 0.8 + checklistScore * 0.2),
      unsafe: !!choice.unsafe,
    };
  });
}

export interface DemoMission {
  measurements: Measurement[];
  symptoms: Symptom[];
  countermeasures: CountermeasureRecord[];
  dailyChecks: DailyCheck[];
  scenarioResults: ScenarioResult[];
}

const cache = new Map<number, DemoMission>();

/** The full synthetic mission (days 1–180). Cached per seed. */
export function generateDemoMission(seed: number = DEMO_SEED): DemoMission {
  const hit = cache.get(seed);
  if (hit) return hit;
  const m: DemoMission = { measurements: [], symptoms: [], countermeasures: [], dailyChecks: [], scenarioResults: [] };
  for (let day = 1; day <= DEMO_DAYS; day++) {
    m.measurements.push(...measurementsFor(day, seed));
    m.symptoms.push(...symptomsFor(day, seed));
    const cm = countermeasureFor(day, seed);
    if (cm) m.countermeasures.push(cm);
    const dc = dailyCheckFor(day, seed);
    if (dc) m.dailyChecks.push(dc);
    m.scenarioResults.push(...scenarioResultsFor(day));
  }
  cache.set(seed, m);
  return m;
}
