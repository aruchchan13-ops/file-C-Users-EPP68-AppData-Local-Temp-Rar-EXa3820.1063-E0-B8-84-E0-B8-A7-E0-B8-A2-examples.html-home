import { describe, expect, it } from 'vitest';
import { generateDemoMission, latentPerformance, DEMO_DAYS, EXAM_DAYS } from '../demoDataService';
import { computeBaselines, computeDailyScores } from '../scoringService';
import { computeAlertTimeline } from '../alertService';
import { countermeasureInsights } from '../countermeasureService';
import { buildDailyPlan, difficultyHistory, LEVEL_MAX, LEVEL_MIN } from '../adaptivePlanService';

const mission = generateDemoMission();
const baselines = computeBaselines(mission.measurements);
const series = computeDailyScores(mission.measurements, baselines, DEMO_DAYS);
const timeline = computeAlertTimeline(series, mission.symptoms, DEMO_DAYS);
const firstYellow = timeline.find((e) => e.level !== 'green')!.day;
const firstRed = timeline.find((e) => e.level === 'red')!.day;

describe('demo mission (synthetic) — calibration', () => {
  it('is deterministic', () => {
    const again = generateDemoMission(184);
    expect(again.measurements.length).toBe(mission.measurements.length);
    expect(JSON.stringify(generateDemoMission(184).symptoms.slice(0, 20))).toBe(JSON.stringify(mission.symptoms.slice(0, 20)));
  });

  it('follows the specified latent curve', () => {
    expect(latentPerformance(60)).toBe(100);
    expect(latentPerformance(105) - latentPerformance(104)).toBeCloseTo(-0.45);
    expect(latentPerformance(150)).toBeLessThan(latentPerformance(106));
  });

  it(`first YELLOW around day 109 (got ${firstYellow}) and first RED around day 133 (got ${firstRed})`, () => {
    console.log(`demo calibration: first yellow day ${firstYellow}, first red day ${firstRed}`);
    expect(firstYellow).toBeGreaterThanOrEqual(106);
    expect(firstYellow).toBeLessThanOrEqual(112);
    expect(firstRed).toBeGreaterThanOrEqual(129);
    expect(firstRed).toBeLessThanOrEqual(137);
  });

  it('no alert during the stable phase; quick-select days give green / yellow / red', () => {
    expect(timeline.slice(0, 105).every((e) => e.level === 'green')).toBe(true);
    expect(timeline[59].level).toBe('green');
    expect(timeline[109].level).toBe('yellow');
    expect(timeline[134].level).toBe('red');
  });

  it('views up to a selected day are consistent with the full mission', () => {
    const upto = (d: number) => {
      const ms = mission.measurements.filter((m) => m.day <= d);
      const s = computeDailyScores(ms, computeBaselines(ms), d);
      return computeAlertTimeline(s, mission.symptoms.filter((x) => x.day <= d), d)[d - 1].level;
    };
    for (const d of [60, 110, 135]) expect(upto(d)).toBe(timeline[d - 1].level);
  });

  it('eye exam scheduled on day 150', () => {
    expect(EXAM_DAYS).toContain(150);
  });

  it('countermeasure insights report sample sizes', () => {
    const ins = countermeasureInsights(mission.countermeasures, series, 180);
    for (const i of ins) {
      expect(i.nWith + i.nWithout).toBeGreaterThan(100);
      if (!i.sufficient) expect(i.nWith < 7 || i.nWithout < 7).toBe(true);
    }
  });
});

describe('adaptive plan', () => {
  it('level stays within safe limits and responds to performance', () => {
    const steps = difficultyHistory(series, 180);
    expect(steps.every((s) => s.level >= LEVEL_MIN && s.level <= LEVEL_MAX)).toBe(true);
    expect(steps[60].level).toBeGreaterThan(steps[0].level); // stable strong phase → harder
    expect(steps[170].level).toBe(LEVEL_MIN); // declining phase → easier
  });

  it('high fatigue shortens the plan to ≤ 3 minutes', () => {
    const args = { day: 60, series, baselines, symptoms: [], scenarioResults: [], completedLessons: [] };
    const normal = buildDailyPlan({ ...args, checks: [{ dataset: 'demo', source: 'user', day: 60, timestamp: 0, fatigue: 2 }] });
    const tired = buildDailyPlan({ ...args, checks: [{ dataset: 'demo', source: 'user', day: 60, timestamp: 0, fatigue: 8 }] });
    expect(normal.totalMinutes).toBeGreaterThan(4.5);
    expect(normal.totalMinutes).toBeLessThanOrEqual(6);
    expect(tired.fatigueHigh).toBe(true);
    expect(tired.totalMinutes).toBeLessThanOrEqual(3);
    expect(normal.items.some((i) => i.type === 'focus')).toBe(true);
  });

  it('prioritises the weakest category of the week', () => {
    const plan = buildDailyPlan({ day: 140, series, baselines, checks: [], symptoms: [], scenarioResults: [], completedLessons: [] });
    const firstMeasure = plan.items.find((i) => i.kind === 'measure')!;
    expect(firstMeasure.type).toBe(plan.weakest[0].type);
  });
});
