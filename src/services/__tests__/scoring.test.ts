import { describe, expect, it } from 'vitest';
import type { Measurement, MeasurementType } from '../../types';
import { computeBaselines, computeDailyScores, normalise } from '../scoringService';
import { contrastThreshold, letterByLetterLogMAR, staircaseNext, CONTRAST_STEP } from '../measurementService';

const m = (day: number, type: MeasurementType, raw: number): Measurement => ({ dataset: 'personal', source: 'user', day, timestamp: day, type, raw });

describe('normalise — higher score always means better', () => {
  it('near vision: smaller logMAR scores higher', () => {
    expect(normalise('near', 0, 0)).toBeCloseTo(100);
    expect(normalise('near', 0.1, 0)!).toBeLessThan(100);
    expect(normalise('near', -0.1, 0)!).toBeGreaterThan(100);
    expect(normalise('near', 0.1, 0)).toBeCloseTo(10 ** -0.1 * 100);
  });
  it('contrast and focus: lower raw is better (inverted ratio)', () => {
    expect(normalise('contrast', 2, 1)).toBeCloseTo(50);
    expect(normalise('focus', 1000, 1200)).toBeCloseTo(120);
  });
  it('amsler: zero baseline is safe (no division by zero)', () => {
    expect(normalise('amsler', 0, 0)).toBe(100);
    expect(normalise('amsler', 2, 0)).toBe(90);
    expect(Number.isFinite(normalise('amsler', 50, 0)!)).toBe(true);
  });
  it('rejects invalid raw values instead of producing 0', () => {
    expect(normalise('focus', 0, 1000)).toBeNull();
    expect(normalise('contrast', NaN, 1)).toBeNull();
    expect(normalise('near', 5, 0)).toBeNull();
  });
  it('clamps extreme scores', () => {
    expect(normalise('focus', 100, 20000)).toBe(150);
  });
});

describe('baseline = mean of first three valid measurement days', () => {
  it('ignores invalid values and uses only first 3 valid days', () => {
    const ms = [m(1, 'focus', 1000), m(2, 'focus', 0 /* invalid */), m(3, 'focus', 1200), m(5, 'focus', 1400), m(6, 'focus', 9000)];
    const b = computeBaselines(ms);
    expect(b.focus.days).toEqual([1, 3, 5]);
    expect(b.focus.value).toBeCloseTo(1200);
  });
  it('averages multiple tests on the same day first', () => {
    const ms = [m(1, 'near', 0), m(1, 'near', 0.2), m(2, 'near', 0.1), m(3, 'near', 0.1)];
    expect(computeBaselines(ms).near.value).toBeCloseTo(0.1);
  });
  it('is null (building) with fewer than 3 days', () => {
    const b = computeBaselines([m(1, 'amsler', 0), m(2, 'amsler', 0)]);
    expect(b.amsler.value).toBeNull();
    expect(b.amsler.daysAvailable).toBe(2);
  });
});

describe('daily scores treat missing data as missing, not zero', () => {
  it('composite averages available categories; missing day is null', () => {
    const ms = [1, 2, 3, 5].flatMap((d) => [m(d, 'focus', 1000), m(d, 'contrast', 2)]);
    ms.push(m(6, 'focus', 2000)); // only one category
    const s = computeDailyScores(ms, computeBaselines(ms), 6);
    expect(s[3].composite).toBeNull(); // day 4
    expect(s[4].composite).toBeCloseTo(100);
    expect(s[5].composite).toBeCloseTo(50);
    expect(s[5].avg7).toBeCloseTo((100 * 4 + 50) / 5);
  });
});

describe('measurement procedures', () => {
  it('letter-by-letter logMAR', () => {
    expect(letterByLetterLogMAR(0)).toBeCloseTo(1.1);
    expect(letterByLetterLogMAR(33)).toBeCloseTo(0);
    expect(letterByLetterLogMAR(36)).toBeCloseTo(-0.1);
  });
  it('1-up/2-down staircase', () => {
    let s = { contrast: 10, correctStreak: 0 };
    s = staircaseNext(s, true);
    expect(s.contrast).toBe(10);
    s = staircaseNext(s, true);
    expect(s.contrast).toBeCloseTo(10 / CONTRAST_STEP);
    s = staircaseNext(s, false);
    expect(s.contrast).toBeCloseTo(10);
  });
  it('threshold = mean of final six trials', () => {
    expect(contrastThreshold([50, 40, 30, 20, 10, 1, 2, 3, 4, 5, 6])).toBeCloseTo(3.5);
  });
});
