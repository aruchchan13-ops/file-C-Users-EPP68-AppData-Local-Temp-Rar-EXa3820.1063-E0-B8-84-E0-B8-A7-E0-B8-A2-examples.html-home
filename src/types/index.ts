/**
 * Shared domain types for EyeReady.
 *
 * Every record carries a `dataset` (which mission it belongs to) and a `source`:
 *  - dataset 'demo'     → the 180-day demonstration mission (ข้อมูลจำลอง)
 *  - dataset 'personal' → the user's own mission
 *  - source 'synthetic' → generated in memory by demoDataService (never stored)
 *  - source 'user'      → entered by a person and stored in IndexedDB
 */
export type DatasetId = 'demo' | 'personal';
export type Source = 'synthetic' | 'user';

export type MeasurementType = 'near' | 'amsler' | 'contrast' | 'focus';
export const MEASUREMENT_TYPES: MeasurementType[] = ['near', 'amsler', 'contrast', 'focus'];

export interface NearDetails {
  smallestRowLogMAR: number | null; // smallest row with all 3 letters correct
  lettersCorrect: number;
  startLogMAR: number;
  rows: { logMAR: number; correct: number }[];
}
export interface AmslerDetails {
  cells: number[]; // indexes of distorted cells in a 10×10 grid
  eye: 'left' | 'right' | 'both';
}
export interface ContrastDetails {
  trials: { contrast: number; orientation: Orientation; answer: Orientation | null; correct: boolean }[];
  finalSix: number[];
}
export interface FocusDetails {
  rounds: { direction: 'far-to-near' | 'near-to-far'; ms: number | null; correct: boolean }[];
  farToNearMs: number | null;
  nearToFarMs: number | null;
}
export type Orientation = 'vertical' | 'left' | 'right';

export interface Measurement {
  id?: number;
  dataset: DatasetId;
  source: Source;
  day: number;
  timestamp: number;
  type: MeasurementType;
  /**
   * Canonical raw value:
   *  near     → logMAR (letter-by-letter, lower is better)
   *  amsler   → number of distorted cells (lower is better)
   *  contrast → mean contrast threshold in % of the final six trials (lower is better)
   *  focus    → mean switching time in ms (lower is better)
   */
  raw: number;
  details?: NearDetails | AmslerDetails | ContrastDetails | FocusDetails;
}

export type SymptomCategory = 'headache' | 'blurred' | 'focusing' | 'distorted' | 'otherVisual' | 'fatigue';
export const SYMPTOM_CATEGORIES: SymptomCategory[] = ['headache', 'blurred', 'focusing', 'distorted', 'otherVisual', 'fatigue'];

export interface Symptom {
  id?: number;
  dataset: DatasetId;
  source: Source;
  day: number;
  timestamp: number;
  category: SymptomCategory;
  severity: number; // 0–10
  durationMin: number | null;
  notes: string;
}

export interface CountermeasureRecord {
  id?: number;
  dataset: DatasetId;
  source: Source;
  day: number;
  lbnpMin: number | null;
  cuffsMin: number | null;
  exerciseMin: number | null;
  nutrition: boolean | null;
  updatedAt: number;
}
export type CountermeasureKey = 'lbnp' | 'cuffs' | 'exercise' | 'nutrition';

export interface ScenarioResult {
  id?: number;
  dataset: DatasetId;
  source: Source;
  day: number;
  timestamp: number;
  scenarioId: string;
  choiceId: string;
  choiceScore: number;
  checklistScore: number;
  score: number;
  unsafe: boolean;
}

/** Daily self-check from the training plan (fatigue drives workload). */
export interface DailyCheck {
  id?: number;
  dataset: DatasetId;
  source: Source;
  day: number;
  timestamp: number;
  fatigue: number; // 0–10
}

export type AlertLevel = 'green' | 'yellow' | 'red';

export interface AlertHistoryEntry {
  id?: number;
  dataset: DatasetId;
  day: number;
  level: AlertLevel;
  summary: string;
  evaluatedAt: number;
}

export interface LessonProgress {
  lessonId: string;
  completedAt: number;
}

export interface Prefs {
  mode: DatasetId;
  demoDay: number;
  personalDay: number;
  missionStartISO: string; // personal mission day 1
  pxPerMm: number; // screen calibration for the near-vision chart
  guidedDemoSeen: boolean;
}
