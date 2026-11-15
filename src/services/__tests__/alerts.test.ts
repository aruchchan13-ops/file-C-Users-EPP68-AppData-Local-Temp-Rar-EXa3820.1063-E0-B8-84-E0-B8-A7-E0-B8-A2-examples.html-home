import { describe, expect, it } from 'vitest';
import type { Symptom, SymptomCategory } from '../../types';
import type { DayScore } from '../scoringService';
import { computeAlertTimeline } from '../alertService';

const series = (values: (number | null)[], avg?: (number | null)[]): DayScore[] =>
  values.map((v, i) => ({ day: i + 1, raw: {}, scores: {}, composite: v, avg7: avg ? avg[i] : v }));
const sym = (day: number, category: SymptomCategory = 'headache', severity = 3): Symptom => ({
  dataset: 'personal',
  source: 'user',
  day,
  timestamp: day,
  category,
  severity,
  durationMin: null,
  notes: '',
});

describe('alert rules', () => {
  it('GREEN when nothing is met', () => {
    const t = computeAlertTimeline(series([100, 99, 101, 98]), [], 4);
    expect(t.every((e) => e.level === 'green')).toBe(true);
  });

  it('YELLOW needs the 7-day average < 90 on three consecutive days', () => {
    const s = series([95, 95, 95, 95, 95], [95, 89, 89, 95, 89]);
    expect(computeAlertTimeline(s, [], 5).map((e) => e.level)).toEqual(['green', 'green', 'green', 'green', 'green']);
    const s2 = series([95, 95, 95, 95], [95, 89, 89, 89]);
    expect(computeAlertTimeline(s2, [], 4)[3].level).toBe('yellow');
  });

  it('a missing day breaks the consecutive run', () => {
    const s = series([80, 80, 80, 80], [89, null, 89, 89]);
    expect(computeAlertTimeline(s, [], 4)[3].level).toBe('green');
  });

  it('YELLOW from ≥3 symptom days (≥2 occurrences each) within 7 days', () => {
    const s = series(Array(7).fill(100));
    const sy = [sym(1), sym(1, 'blurred'), sym(4), sym(4, 'fatigue'), sym(7), sym(7)];
    const t = computeAlertTimeline(s, sy, 7);
    expect(t[6].level).toBe('yellow');
    expect(t[6].yellowSymptoms.symptomDays).toEqual([1, 4, 7]);
    expect(t[5].level).toBe('green');
  });

  it('severity 0 entries are not occurrences', () => {
    const s = series(Array(3).fill(100));
    const sy = [1, 2, 3].flatMap((d) => [sym(d, 'headache', 0), sym(d, 'blurred', 0)]);
    expect(computeAlertTimeline(s, sy, 3)[2].level).toBe('green');
  });

  it('RED needs daily < 80 for 3 days AND a relevant symptom', () => {
    const s = series([79, 79, 79]);
    expect(computeAlertTimeline(s, [], 3)[2].level).toBe('yellow'); // avg7 < 90 for 3 days
    expect(computeAlertTimeline(s, [sym(3, 'fatigue')], 3)[2].level).toBe('yellow'); // fatigue is not relevant
    expect(computeAlertTimeline(s, [sym(2, 'blurred')], 3)[2].level).toBe('red');
  });
});
