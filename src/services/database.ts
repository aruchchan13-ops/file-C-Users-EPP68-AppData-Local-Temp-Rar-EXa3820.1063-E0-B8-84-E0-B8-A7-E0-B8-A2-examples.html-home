import Dexie, { type Table } from 'dexie';
import type {
  AlertHistoryEntry,
  CountermeasureRecord,
  DailyCheck,
  DatasetId,
  LessonProgress,
  Measurement,
  Prefs,
  ScenarioResult,
  Symptom,
} from '../types';

/**
 * Local-only persistence (IndexedDB via Dexie). Nothing is ever uploaded.
 * Synthetic demo records live in memory; only records a person enters are stored.
 */
export class EyeReadyDB extends Dexie {
  measurements!: Table<Measurement, number>;
  symptoms!: Table<Symptom, number>;
  countermeasures!: Table<CountermeasureRecord, number>;
  scenarioResults!: Table<ScenarioResult, number>;
  dailyChecks!: Table<DailyCheck, number>;
  alertHistory!: Table<AlertHistoryEntry, number>;
  lessons!: Table<LessonProgress, string>;
  settings!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super('eyeready');
    this.version(1).stores({
      measurements: '++id, dataset, [dataset+day], type',
      symptoms: '++id, dataset, [dataset+day]',
      countermeasures: '++id, dataset, &[dataset+day]',
      scenarioResults: '++id, dataset, [dataset+day], scenarioId',
      dailyChecks: '++id, dataset, &[dataset+day]',
      alertHistory: '++id, dataset, &[dataset+day]',
      lessons: 'lessonId',
      settings: 'key',
    });
  }
}

export const db = new EyeReadyDB();

export const DEFAULT_PREFS: Prefs = {
  mode: 'demo',
  demoDay: 60,
  personalDay: 1,
  missionStartISO: new Date().toISOString().slice(0, 10),
  pxPerMm: 3.78, // 96 dpi reference pixel; users can calibrate in Settings
  guidedDemoSeen: false,
};

export async function loadPrefs(): Promise<Prefs> {
  const row = await db.settings.get('prefs');
  return { ...DEFAULT_PREFS, ...((row?.value as Partial<Prefs>) ?? {}) };
}

export async function savePrefs(prefs: Prefs): Promise<void> {
  await db.settings.put({ key: 'prefs', value: prefs });
}

/** Wraps a write so storage failures surface as a readable Thai message. */
export async function safeWrite<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    const name = (e as { name?: string })?.name ?? '';
    const error =
      name === 'QuotaExceededError'
        ? 'พื้นที่จัดเก็บในอุปกรณ์เต็ม บันทึกไม่ได้'
        : 'บันทึกข้อมูลไม่สำเร็จ (IndexedDB) กรุณาลองใหม่ หรือตรวจว่าเบราว์เซอร์ไม่ได้อยู่ในโหมดส่วนตัว';
    console.warn('EyeReady storage error', e);
    return { ok: false, error };
  }
}

/** Removes everything the user added to one dataset (used by Settings). */
export async function clearDataset(dataset: DatasetId): Promise<void> {
  await db.transaction('rw', [db.measurements, db.symptoms, db.countermeasures, db.scenarioResults, db.dailyChecks, db.alertHistory], async () => {
    await Promise.all([
      db.measurements.where('dataset').equals(dataset).delete(),
      db.symptoms.where('dataset').equals(dataset).delete(),
      db.countermeasures.where('dataset').equals(dataset).delete(),
      db.scenarioResults.where('dataset').equals(dataset).delete(),
      db.dailyChecks.where('dataset').equals(dataset).delete(),
      db.alertHistory.where('dataset').equals(dataset).delete(),
    ]);
  });
}

export async function isStorageAvailable(): Promise<boolean> {
  try {
    if (typeof indexedDB === 'undefined') return false;
    await db.open();
    return true;
  } catch {
    return false;
  }
}
