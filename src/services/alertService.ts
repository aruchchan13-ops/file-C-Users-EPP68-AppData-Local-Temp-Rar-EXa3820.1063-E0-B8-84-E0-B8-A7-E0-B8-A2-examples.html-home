import type { AlertLevel, Symptom, SymptomCategory } from '../types';
import type { DayScore } from './scoringService';

/**
 * ALERT CALCULATION (starter values — to be tuned with clinicians)
 * ----------------------------------------------------------------
 * Evaluated independently for every mission day d from the stored data only.
 *
 * Symptom counting (used consistently everywhere):
 *  - An "occurrence" is one symptom entry with severity ≥ 1 (severity 0 = none).
 *  - A "symptom day" is a mission day with ≥ 2 occurrences. Two different
 *    categories always means ≥ 2 occurrences, so this single rule covers
 *    "≥ 2 categories OR ≥ 2 occurrences per day". All six categories count.
 *  - "Relevant symptoms" for RED are the vision-related categories plus
 *    headache (fatigue alone is not relevant), severity ≥ 1, on days d−2…d.
 *
 * YELLOW if either:
 *  (a) 7-day average score < 90 % of baseline on days d−2, d−1 and d, or
 *  (b) ≥ 3 symptom days within days d−6…d.
 * RED if both:
 *  (a) daily score < 80 % of baseline on days d−2, d−1 and d, and
 *  (b) at least one relevant symptom on days d−2…d.
 * GREEN otherwise. A day with no score breaks a "consecutive days" run.
 */
export const THRESHOLDS = {
  yellowAvg7: 90,
  redDaily: 80,
  consecutiveDays: 3,
  symptomDayMinOccurrences: 2,
  symptomDaysNeeded: 3,
  symptomWindowDays: 7,
  redSymptomWindowDays: 3,
} as const;

export const RELEVANT_SYMPTOMS: SymptomCategory[] = ['headache', 'blurred', 'focusing', 'distorted', 'otherVisual'];

export interface AlertEvaluation {
  day: number;
  level: AlertLevel;
  yellowVision: { met: boolean; days: number[]; values: (number | null)[] };
  yellowSymptoms: { met: boolean; symptomDays: number[]; from: number; to: number };
  redVision: { met: boolean; days: number[]; values: (number | null)[] };
  redSymptoms: { met: boolean; days: number[]; categories: SymptomCategory[] };
}

export function occurrencesByDay(symptoms: Symptom[]): Map<number, Symptom[]> {
  const map = new Map<number, Symptom[]>();
  for (const s of symptoms) {
    if (!(s.severity >= 1)) continue;
    const list = map.get(s.day) ?? [];
    list.push(s);
    map.set(s.day, list);
  }
  return map;
}

export function isSymptomDay(occ: Map<number, Symptom[]>, day: number): boolean {
  return (occ.get(day)?.length ?? 0) >= THRESHOLDS.symptomDayMinOccurrences;
}

export function evaluateDay(series: DayScore[], occ: Map<number, Symptom[]>, day: number): AlertEvaluation {
  const byDay = new Map(series.map((d) => [d.day, d]));
  const runDays = Array.from({ length: THRESHOLDS.consecutiveDays }, (_, i) => day - (THRESHOLDS.consecutiveDays - 1) + i).filter((d) => d >= 1);
  const full = runDays.length === THRESHOLDS.consecutiveDays;

  const avg7Values = runDays.map((d) => byDay.get(d)?.avg7 ?? null);
  const yellowVisionMet = full && avg7Values.every((v) => v !== null && v < THRESHOLDS.yellowAvg7);

  const from = Math.max(1, day - (THRESHOLDS.symptomWindowDays - 1));
  const symptomDays: number[] = [];
  for (let d = from; d <= day; d++) if (isSymptomDay(occ, d)) symptomDays.push(d);
  const yellowSymptomsMet = symptomDays.length >= THRESHOLDS.symptomDaysNeeded;

  const dailyValues = runDays.map((d) => byDay.get(d)?.composite ?? null);
  const redVisionMet = full && dailyValues.every((v) => v !== null && v < THRESHOLDS.redDaily);

  const relDays: number[] = [];
  const cats = new Set<SymptomCategory>();
  for (let d = Math.max(1, day - (THRESHOLDS.redSymptomWindowDays - 1)); d <= day; d++) {
    const rel = (occ.get(d) ?? []).filter((s) => RELEVANT_SYMPTOMS.includes(s.category));
    if (rel.length) {
      relDays.push(d);
      rel.forEach((s) => cats.add(s.category));
    }
  }
  const redSymptomsMet = relDays.length > 0;

  const level: AlertLevel = redVisionMet && redSymptomsMet ? 'red' : yellowVisionMet || yellowSymptomsMet ? 'yellow' : 'green';
  return {
    day,
    level,
    yellowVision: { met: yellowVisionMet, days: runDays, values: avg7Values },
    yellowSymptoms: { met: yellowSymptomsMet, symptomDays, from, to: day },
    redVision: { met: redVisionMet, days: runDays, values: dailyValues },
    redSymptoms: { met: redSymptomsMet, days: relDays, categories: [...cats] },
  };
}

/** Alert level for every mission day 1…lastDay. */
export function computeAlertTimeline(series: DayScore[], symptoms: Symptom[], lastDay: number): AlertEvaluation[] {
  const occ = occurrencesByDay(symptoms);
  const out: AlertEvaluation[] = [];
  for (let d = 1; d <= lastDay; d++) out.push(evaluateDay(series, occ, d));
  return out;
}

/** First day of each new alert episode (level change), for alert history. */
export function alertTransitions(timeline: AlertEvaluation[]): { day: number; from: AlertLevel; to: AlertLevel }[] {
  const out: { day: number; from: AlertLevel; to: AlertLevel }[] = [];
  let prev: AlertLevel = 'green';
  for (const e of timeline) {
    if (e.level !== prev) out.push({ day: e.day, from: prev, to: e.level });
    prev = e.level;
  }
  return out;
}

export const ALERT_META: Record<AlertLevel, { label: string; en: string; shape: string; action: string }> = {
  green: {
    label: 'ความเสี่ยงต่ำ',
    en: 'GREEN',
    shape: 'วงกลม',
    action: 'ทำการวัดประจำวันและบันทึกอาการตามปกติ ทำตามแผนมาตรการป้องกัน (countermeasures)',
  },
  yellow: {
    label: 'ควรระวัง',
    en: 'YELLOW',
    shape: 'สามเหลี่ยม',
    action:
      'วัดซ้ำวันนี้และพรุ่งนี้ บันทึกอาการให้ครบ ใช้ตัวอักษรใหญ่/โหมดคอนทราสต์สูงเมื่ออ่านเอกสาร และแจ้งแพทย์ประจำเที่ยวบิน (flight surgeon) ในการติดต่อครั้งถัดไป',
  },
  red: {
    label: 'หยุดก่อน — แจ้งแพทย์',
    en: 'RED',
    shape: 'แปดเหลี่ยม',
    action:
      'แจ้งแพทย์ประจำเที่ยวบินโดยเร็วตามขั้นตอนการแพทย์ของภารกิจ ส่งรายงานสรุป หลีกเลี่ยงงานที่ต้องอ่านตัวอักษรเล็กโดยลำพังจนกว่าจะได้รับคำแนะนำ ใช้แว่นที่แพทย์สั่ง (ถ้ามี)',
  },
};

/** Human-readable reasons with exact numbers (Thai). */
export function describeAlert(e: AlertEvaluation, dayLabel: (d: number) => string): string[] {
  const f = (v: number | null) => (v === null ? 'ไม่มีข้อมูล' : `${v.toFixed(1)}%`);
  const span = (days: number[]) => (days.length ? `${dayLabel(days[0])} – ${dayLabel(days[days.length - 1])}` : '-');
  const lines: string[] = [];
  if (e.level === 'red') {
    lines.push(
      `คะแนนการมองเห็นรายวันต่ำกว่า ${THRESHOLDS.redDaily}% ของ baseline ${THRESHOLDS.consecutiveDays} วันติดต่อกัน (${span(e.redVision.days)}): ${e.redVision.values.map(f).join(', ')}`,
    );
    lines.push(`มีอาการที่เกี่ยวข้องใน ${THRESHOLDS.redSymptomWindowDays} วันล่าสุด: ${e.redSymptoms.days.map(dayLabel).join(', ')}`);
    return lines;
  }
  if (e.yellowVision.met) {
    lines.push(
      `ค่าเฉลี่ย 7 วันต่ำกว่า ${THRESHOLDS.yellowAvg7}% ของ baseline ${THRESHOLDS.consecutiveDays} วันติดต่อกัน (${span(e.yellowVision.days)}): ${e.yellowVision.values.map(f).join(', ')}`,
    );
  }
  if (e.yellowSymptoms.met) {
    lines.push(
      `มีวันที่มีอาการ (≥${THRESHOLDS.symptomDayMinOccurrences} ครั้ง/วัน) ${e.yellowSymptoms.symptomDays.length} วันใน 7 วันล่าสุด (เกณฑ์ ≥${THRESHOLDS.symptomDaysNeeded}): ${e.yellowSymptoms.symptomDays.map(dayLabel).join(', ')}`,
    );
  }
  if (e.level === 'green') {
    const last = e.yellowVision.values[e.yellowVision.values.length - 1];
    lines.push(
      `ยังไม่เข้าเกณฑ์ใด: ค่าเฉลี่ย 7 วันล่าสุด ${f(last ?? null)} (เกณฑ์เหลือง < ${THRESHOLDS.yellowAvg7}%), วันที่มีอาการ ${e.yellowSymptoms.symptomDays.length}/7 วัน (เกณฑ์ ≥ ${THRESHOLDS.symptomDaysNeeded})`,
    );
  }
  return lines;
}
