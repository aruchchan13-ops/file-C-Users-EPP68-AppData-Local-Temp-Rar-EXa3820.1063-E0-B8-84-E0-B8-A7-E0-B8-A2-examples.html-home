import type { DatasetId, Measurement, MeasurementType, Orientation } from '../types';
import { db, safeWrite } from './database';
import { isValidRaw } from './scoringService';

/* ---------------------------------------------------------------- near vision */

/** Sloan letters — designed to be equally legible. */
export const SLOAN_LETTERS = ['C', 'D', 'H', 'K', 'N', 'O', 'R', 'S', 'V', 'Z'];

/** Chart rows from logMAR 1.0 (large) to −0.1 (small), 0.1 logMAR apart, 3 letters each. */
export const NEAR_ROWS = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0, -0.1].map((v) => Math.round(v * 10) / 10);
export const LETTERS_PER_ROW = 3;
export const NEAR_VIEWING_DISTANCE_MM = 400;

/** Letter height (mm) for a logMAR row at 40 cm: 5 arc-minutes × 10^logMAR. */
export function letterHeightMm(logMAR: number, distanceMm = NEAR_VIEWING_DISTANCE_MM): number {
  const fiveArcMin = (5 / 60) * (Math.PI / 180);
  return 2 * distanceMm * Math.tan(fiveArcMin / 2) * 10 ** logMAR;
}

/** Approximate N-point print size (N8 ≈ 0.4 logMAR at 40 cm). */
export function nPointLabel(logMAR: number): string {
  return `N${Math.max(1, Math.round(8 * 10 ** (logMAR - 0.4)))}`;
}

/**
 * Letter-by-letter logMAR (ETDRS-style scoring adapted to 3-letter rows):
 * logMAR = (largest row + 0.1) − 0.1/3 × total letters read correctly.
 * Rows above the start row are credited as fully read.
 */
export function letterByLetterLogMAR(totalLettersCorrect: number): number {
  const top = NEAR_ROWS[0];
  return Math.round((top + 0.1 - (0.1 / LETTERS_PER_ROW) * totalLettersCorrect) * 1000) / 1000;
}

export function randomLetters(n: number, rand: () => number = Math.random): string[] {
  const out: string[] = [];
  while (out.length < n) {
    const l = SLOAN_LETTERS[Math.floor(rand() * SLOAN_LETTERS.length)];
    if (!out.includes(l)) out.push(l);
  }
  return out;
}

/* ---------------------------------------------------------------- contrast */

export const CONTRAST_TRIALS = 15;
export const CONTRAST_FINAL_N = 6;
export const CONTRAST_MIN = 0.5; // % (8-bit displays cannot show much less)
export const CONTRAST_MAX = 60;
export const CONTRAST_STEP = 10 ** 0.1; // 0.1 log unit
export const ORIENTATIONS: Orientation[] = ['vertical', 'left', 'right'];

/**
 * 1-up/2-down staircase: two consecutive correct answers lower the contrast
 * one step (harder); any wrong answer raises it one step (easier).
 * Converges near the 70.7 %-correct threshold.
 */
export interface StaircaseState {
  contrast: number;
  correctStreak: number;
}
export function staircaseNext(state: StaircaseState, correct: boolean): StaircaseState {
  if (!correct) return { contrast: Math.min(CONTRAST_MAX, state.contrast * CONTRAST_STEP), correctStreak: 0 };
  if (state.correctStreak + 1 >= 2) return { contrast: Math.max(CONTRAST_MIN, state.contrast / CONTRAST_STEP), correctStreak: 0 };
  return { contrast: state.contrast, correctStreak: state.correctStreak + 1 };
}
export function contrastThreshold(levels: number[]): number {
  const last = levels.slice(-CONTRAST_FINAL_N);
  return Math.round((last.reduce((a, b) => a + b, 0) / last.length) * 100) / 100;
}
export function logCS(thresholdPercent: number): number {
  return Math.round(Math.log10(100 / thresholdPercent) * 100) / 100;
}

/* ---------------------------------------------------------------- focus */

export const FOCUS_ROUNDS = 10;
export const FOCUS_MIN_VALID_MS = 150; // faster responses are anticipations, discarded

/* ---------------------------------------------------------------- amsler */

export const AMSLER_SIZE = 10; // 10 × 10 tappable regions (each drawn as 2 × 2 squares)

/* ---------------------------------------------------------------- persistence */

export const MEASUREMENT_META: Record<MeasurementType, { label: string; en: string; unit: string; lowerIsBetter: true; format: (raw: number) => string }> = {
  near: { label: 'สายตาระยะใกล้', en: 'Near vision', unit: 'logMAR', lowerIsBetter: true, format: (r) => `${r.toFixed(2)} logMAR` },
  amsler: { label: 'Amsler grid', en: 'Amsler grid', unit: 'ช่อง', lowerIsBetter: true, format: (r) => `${Math.round(r * 10) / 10} ช่องผิดปกติ` },
  contrast: { label: 'ความไวต่อคอนทราสต์', en: 'Contrast sensitivity', unit: '%', lowerIsBetter: true, format: (r) => `${r.toFixed(2)}% (logCS ${logCS(r).toFixed(2)})` },
  focus: { label: 'สลับโฟกัสใกล้–ไกล', en: 'Near–far focus', unit: 'ms', lowerIsBetter: true, format: (r) => `${(r / 1000).toFixed(2)} วินาที` },
};

export async function saveMeasurement(dataset: DatasetId, day: number, type: MeasurementType, raw: number, details: Measurement['details']) {
  if (!isValidRaw(type, raw)) return { ok: false as const, error: 'ผลการวัดอยู่นอกช่วงที่เป็นไปได้ จึงไม่ได้บันทึก' };
  return safeWrite(() => db.measurements.add({ dataset, source: 'user', day, timestamp: Date.now(), type, raw, details }));
}

export async function deleteMeasurement(id: number) {
  return safeWrite(() => db.measurements.delete(id));
}

/* Interrupted sessions: an in-progress flag in sessionStorage lets the next visit explain that nothing was saved. */
const KEY = 'eyeready.inProgress';
export function markInProgress(type: MeasurementType | null) {
  try {
    if (type) sessionStorage.setItem(KEY, type);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* storage may be blocked; non-critical */
  }
}
export function takeInterrupted(): MeasurementType | null {
  try {
    const v = sessionStorage.getItem(KEY) as MeasurementType | null;
    sessionStorage.removeItem(KEY);
    return v;
  } catch {
    return null;
  }
}
