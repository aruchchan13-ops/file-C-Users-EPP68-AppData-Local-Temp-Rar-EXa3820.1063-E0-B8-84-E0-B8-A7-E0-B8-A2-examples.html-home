import type { CountermeasureKey, CountermeasureRecord, DatasetId } from '../types';
import type { DayScore } from './scoringService';
import { mean } from '../utils/stats';
import { db, safeWrite } from './database';

/** Daily targets are starter values for demonstration, to be set by the medical team. */
export const CM_META: Record<CountermeasureKey, { label: string; en: string; unit: string; target: number | null; field: keyof CountermeasureRecord }> = {
  lbnp: { label: 'แรงดันลบส่วนล่างของร่างกาย', en: 'Lower Body Negative Pressure (LBNP)', unit: 'นาที', target: 30, field: 'lbnpMin' },
  cuffs: { label: 'สายรัดต้นขา', en: 'Venoconstrictive Thigh Cuffs', unit: 'นาที', target: 60, field: 'cuffsMin' },
  exercise: { label: 'ออกกำลังกายแบบต้านแรง', en: 'Resistance Exercise', unit: 'นาที', target: 60, field: 'exerciseMin' },
  nutrition: { label: 'โภชนาการ/อาหารเสริม', en: 'Nutrition / Supplement', unit: 'ใช่/ไม่', target: null, field: 'nutrition' },
};
export const CM_KEYS: CountermeasureKey[] = ['lbnp', 'cuffs', 'exercise', 'nutrition'];
export const MIN_GROUP_DAYS = 7;

/** true = target met, false = recorded but not met, null = not recorded. */
export function isAdherent(rec: CountermeasureRecord | undefined, key: CountermeasureKey): boolean | null {
  if (!rec) return null;
  const meta = CM_META[key];
  const v = rec[meta.field];
  if (v === null || v === undefined) return null;
  if (key === 'nutrition') return v === true;
  return typeof v === 'number' && v >= (meta.target ?? 0);
}

export function recordsByDay(records: CountermeasureRecord[]): Map<number, CountermeasureRecord> {
  return new Map(records.map((r) => [r.day, r]));
}

export interface AdherenceSummary {
  key: CountermeasureKey;
  met: number;
  recorded: number;
  pct: number | null; // % of recorded days that met the target
}

/** Adherence over mission days [from, to]. Unrecorded days are reported, not counted as failures. */
export function adherence(records: CountermeasureRecord[], from: number, to: number): { perKey: AdherenceSummary[]; overall: number | null; daysLogged: number } {
  const byDay = recordsByDay(records);
  let daysLogged = 0;
  for (let d = from; d <= to; d++) if (byDay.has(d)) daysLogged++;
  const perKey = CM_KEYS.map((key) => {
    let met = 0;
    let recorded = 0;
    for (let d = Math.max(1, from); d <= to; d++) {
      const a = isAdherent(byDay.get(d), key);
      if (a === null) continue;
      recorded++;
      if (a) met++;
    }
    return { key, met, recorded, pct: recorded ? Math.round((met / recorded) * 100) : null };
  });
  return { perKey, overall: mean(perKey.map((p) => p.pct)), daysLogged };
}

export interface CmInsight {
  key: CountermeasureKey;
  withMean: number | null;
  withoutMean: number | null;
  nWith: number;
  nWithout: number;
  diff: number | null;
  sufficient: boolean;
}

/**
 * Compares the mean daily vision score on days the target was met vs. not met.
 * Purely descriptive ("associated with"); hidden when either group has fewer
 * than MIN_GROUP_DAYS days. Does not imply causation.
 */
export function countermeasureInsights(records: CountermeasureRecord[], series: DayScore[], uptoDay: number): CmInsight[] {
  const byDay = recordsByDay(records);
  return CM_KEYS.map((key) => {
    const withScores: number[] = [];
    const withoutScores: number[] = [];
    for (const d of series) {
      if (d.day > uptoDay || d.composite === null) continue;
      const a = isAdherent(byDay.get(d.day), key);
      if (a === null) continue;
      (a ? withScores : withoutScores).push(d.composite);
    }
    const withMean = mean(withScores);
    const withoutMean = mean(withoutScores);
    const sufficient = withScores.length >= MIN_GROUP_DAYS && withoutScores.length >= MIN_GROUP_DAYS;
    return {
      key,
      withMean,
      withoutMean,
      nWith: withScores.length,
      nWithout: withoutScores.length,
      diff: withMean !== null && withoutMean !== null ? withMean - withoutMean : null,
      sufficient,
    };
  });
}

export async function upsertCountermeasure(dataset: DatasetId, day: number, values: Pick<CountermeasureRecord, 'lbnpMin' | 'cuffsMin' | 'exerciseMin' | 'nutrition'>) {
  return safeWrite(async () => {
    const existing = await db.countermeasures.where('[dataset+day]').equals([dataset, day]).first();
    const rec: CountermeasureRecord = { ...values, dataset, day, source: 'user', updatedAt: Date.now() };
    if (existing?.id !== undefined) await db.countermeasures.update(existing.id, rec);
    else await db.countermeasures.add(rec);
  });
}

export async function deleteCountermeasure(dataset: DatasetId, day: number) {
  return safeWrite(() => db.countermeasures.where('[dataset+day]').equals([dataset, day]).delete());
}
