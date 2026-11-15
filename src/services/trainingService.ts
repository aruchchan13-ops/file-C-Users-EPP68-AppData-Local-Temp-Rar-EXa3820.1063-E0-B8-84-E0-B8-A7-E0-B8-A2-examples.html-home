import type { DatasetId, ScenarioResult } from '../types';
import { SCENARIOS } from '../data/scenarios';
import { db, safeWrite } from './database';
import { mean } from '../utils/stats';

export function scenarioStats(results: ScenarioResult[]) {
  const perScenario = SCENARIOS.map((s) => {
    const rs = results.filter((r) => r.scenarioId === s.id);
    return {
      scenario: s,
      attempts: rs.length,
      best: rs.length ? Math.max(...rs.map((r) => r.score)) : null,
      latest: rs.sort((a, b) => b.timestamp - a.timestamp)[0] ?? null,
    };
  });
  const completed = perScenario.filter((p) => p.attempts > 0).length;
  return {
    perScenario,
    completed,
    completionRate: Math.round((completed / SCENARIOS.length) * 100),
    averageScore: mean(perScenario.map((p) => p.best)),
  };
}

export async function saveScenarioResult(r: Omit<ScenarioResult, 'id' | 'source' | 'timestamp'> & { dataset: DatasetId }) {
  return safeWrite(() => db.scenarioResults.add({ ...r, source: 'user', timestamp: Date.now() }));
}

export async function saveDailyCheck(dataset: DatasetId, day: number, fatigue: number) {
  return safeWrite(async () => {
    const existing = await db.dailyChecks.where('[dataset+day]').equals([dataset, day]).first();
    const rec = { dataset, day, fatigue, source: 'user' as const, timestamp: Date.now() };
    if (existing?.id !== undefined) await db.dailyChecks.update(existing.id, rec);
    else await db.dailyChecks.add(rec);
  });
}

export async function completeLesson(lessonId: string) {
  return safeWrite(() => db.lessons.put({ lessonId, completedAt: Date.now() }));
}

export async function resetLesson(lessonId: string) {
  return safeWrite(() => db.lessons.delete(lessonId));
}
