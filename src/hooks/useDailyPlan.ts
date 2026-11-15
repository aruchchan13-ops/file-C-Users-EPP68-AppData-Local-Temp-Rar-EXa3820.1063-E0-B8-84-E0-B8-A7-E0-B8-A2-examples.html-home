import { useMemo } from 'react';
import { useMission } from './useMission';
import { buildDailyPlan, type PlanItem } from '../services/adaptivePlanService';

export interface PlanItemStatus extends PlanItem {
  done: boolean;
  route: string;
}

/** Today's adaptive plan with completion derived from stored data for the selected day. */
export function useDailyPlan() {
  const m = useMission();
  return useMemo(() => {
    const plan = buildDailyPlan({
      day: m.day,
      series: m.series,
      baselines: m.baselines,
      checks: m.dailyChecks,
      symptoms: m.symptoms,
      scenarioResults: m.scenarioResults,
      completedLessons: m.completedLessons,
    });
    const items: PlanItemStatus[] = plan.items.map((it) => {
      let done = false;
      let route = '/training/plan';
      if (it.kind === 'check') {
        done = m.dailyChecks.some((c) => c.day === m.day);
        route = '/training/plan#check';
      } else if (it.kind === 'measure') {
        done = m.measurements.some((x) => x.day === m.day && x.type === it.type);
        route = `/training/${it.type}?from=plan`;
      } else if (it.kind === 'scenario') {
        done = m.scenarioResults.some((r) => r.day === m.day && r.scenarioId === it.scenarioId);
        route = `/training/scenarios/${it.scenarioId}?from=plan`;
      } else if (it.kind === 'lesson') {
        done = m.completedLessons.includes(it.lessonId!);
        route = `/training/lessons/${it.lessonId}?from=plan`;
      }
      return { ...it, done, route };
    });
    const doneCount = items.filter((i) => i.done).length;
    return { ...plan, items, doneCount, percent: Math.round((doneCount / items.length) * 100) };
  }, [m.day, m.series, m.baselines, m.dailyChecks, m.symptoms, m.scenarioResults, m.completedLessons, m.measurements]);
}
