import { useMemo } from 'react';
import { useMission } from './useMission';
import { MEASUREMENT_TYPES, SYMPTOM_CATEGORIES, type MeasurementType, type SymptomCategory } from '../types';
import { categoryMean } from '../services/scoringService';
import { isSymptomDay, occurrencesByDay } from '../services/alertService';
import { adherence } from '../services/countermeasureService';
import { scenarioStats } from '../services/trainingService';
import { EXAM_DAYS } from '../services/demoDataService';
import { LESSONS } from '../data/lessons';

export const SYMPTOM_LABEL: Record<SymptomCategory, string> = {
  headache: 'ปวดศีรษะ',
  blurred: 'ตาพร่ามัว',
  focusing: 'โฟกัสยาก',
  distorted: 'ภาพบิดเบี้ยว',
  otherVisual: 'การมองเห็นเปลี่ยนแบบอื่น',
  fatigue: 'อ่อนล้า',
};

/** Summary-only data for the flight surgeon (no raw logs, no notes, no personal details). */
export function useSurgeonSummary() {
  const m = useMission();
  return useMemo(() => {
    const { day, series, baselines, symptoms, countermeasures, scenarioResults, completedLessons, measurements } = m;
    const from30 = Math.max(1, day - 29);
    const from7 = Math.max(1, day - 6);

    const tests = MEASUREMENT_TYPES.map((type: MeasurementType) => {
      const last = [...series].reverse().find((d) => d.raw[type] !== undefined);
      const latestMeasurement = measurements.filter((x) => x.type === type).sort((a, b) => b.timestamp - a.timestamp)[0];
      return {
        type,
        baseline: baselines[type],
        latestDay: last?.day ?? null,
        latestRaw: last?.raw[type] ?? null,
        latestScore: last?.scores[type] ?? null,
        mean7: categoryMean(series, type, from7, day),
        mean30: categoryMean(series, type, from30, day),
        prior30: categoryMean(series, type, Math.max(1, from30 - 30), from30 - 1),
        latestSource: latestMeasurement?.source ?? null,
      };
    });

    const occ = occurrencesByDay(symptoms);
    const in30 = symptoms.filter((s) => s.day >= from30 && s.severity >= 1);
    const byCategory = SYMPTOM_CATEGORIES.map((c) => {
      const xs = in30.filter((s) => s.category === c);
      return { category: c, count: xs.length, maxSeverity: xs.length ? Math.max(...xs.map((s) => s.severity)) : null };
    });
    let symptomDays7 = 0;
    let symptomDays30 = 0;
    let anyDays30 = 0;
    for (let d = from30; d <= day; d++) {
      if (isSymptomDay(occ, d)) {
        symptomDays30++;
        if (d >= from7) symptomDays7++;
      }
      if ((occ.get(d)?.length ?? 0) > 0) anyDays30++;
    }

    const adh7 = adherence(countermeasures, from7, day);
    const adh30 = adherence(countermeasures, from30, day);
    const training = scenarioStats(scenarioResults);
    const nextExam = EXAM_DAYS.find((d) => d >= day) ?? null;
    const lastExam = [...EXAM_DAYS].reverse().find((d) => d < day) ?? null;
    const series30 = series.filter((d) => d.day >= from30);

    return {
      day,
      from30,
      from7,
      tests,
      symptoms: { byCategory, total30: in30.length, symptomDays7, symptomDays30, anyDays30 },
      adh7,
      adh30,
      training,
      lessonsDone: completedLessons.length,
      lessonsTotal: LESSONS.length,
      exam: { nextExam, lastExam, daysToNext: nextExam === null ? null : nextExam - day, schedule: EXAM_DAYS },
      series30,
    };
  }, [m]);
}
