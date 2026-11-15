import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { CountermeasureRecord, DailyCheck, DatasetId, Measurement, MeasurementType, Prefs, ScenarioResult, Symptom } from '../types';
import { db, DEFAULT_PREFS, loadPrefs, savePrefs } from '../services/database';
import { DEMO_DAYS, DEMO_START_ISO, generateDemoMission } from '../services/demoDataService';
import { computeBaselines, computeDailyScores, type CategoryBaseline, type DayScore } from '../services/scoringService';
import { computeAlertTimeline, describeAlert, type AlertEvaluation } from '../services/alertService';
import { dateForMissionDay, missionDayForDate, shortDate } from '../utils/format';

/**
 * Centralised mission state. Every page reads the same derived data, filtered
 * to the globally selected mission day, so dashboards can never disagree.
 */
export interface MissionData {
  ready: boolean;
  prefs: Prefs;
  updatePrefs: (patch: Partial<Prefs>) => void;
  dataset: DatasetId;
  isDemo: boolean;
  day: number;
  maxDay: number;
  todayDay: number; // personal mission: today's mission day from the start date
  setDay: (d: number) => void;
  startISO: string;
  dateOf: (day: number) => Date;
  dayLabel: (day: number) => string;
  measurements: Measurement[];
  symptoms: Symptom[];
  countermeasures: CountermeasureRecord[];
  dailyChecks: DailyCheck[];
  scenarioResults: ScenarioResult[];
  completedLessons: string[];
  baselines: Record<MeasurementType, CategoryBaseline>;
  series: DayScore[];
  timeline: AlertEvaluation[];
  current: AlertEvaluation;
  currentReasons: string[];
}

const Ctx = createContext<MissionData | null>(null);

function mergeCountermeasures(synthetic: CountermeasureRecord[], user: CountermeasureRecord[]): CountermeasureRecord[] {
  const byDay = new Map<number, CountermeasureRecord>();
  for (const r of synthetic) byDay.set(r.day, r);
  for (const r of user) byDay.set(r.day, r); // a person's edit replaces the synthetic record for that day
  return [...byDay.values()].sort((a, b) => a.day - b.day);
}

export function MissionProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadPrefs()
      .then((p) => {
        // Personal mission: jump to today's mission day on open.
        const today = missionDayForDate(p.missionStartISO);
        setPrefs({ ...p, personalDay: Math.max(1, today) });
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  const updatePrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      savePrefs(next).catch(() => undefined);
      return next;
    });
  }, []);

  const dataset: DatasetId = prefs.mode;
  const isDemo = dataset === 'demo';
  const startISO = isDemo ? DEMO_START_ISO : prefs.missionStartISO;
  const todayDay = Math.max(1, missionDayForDate(prefs.missionStartISO));
  const maxDay = isDemo ? DEMO_DAYS : Math.max(DEMO_DAYS, todayDay);
  const day = Math.min(maxDay, Math.max(1, isDemo ? prefs.demoDay : prefs.personalDay));
  const setDay = useCallback(
    (d: number) => updatePrefs(isDemo ? { demoDay: Math.round(d) } : { personalDay: Math.round(d) }),
    [isDemo, updatePrefs],
  );

  const userMeasurements = useLiveQuery(() => db.measurements.where('dataset').equals(dataset).toArray(), [dataset], []);
  const userSymptoms = useLiveQuery(() => db.symptoms.where('dataset').equals(dataset).toArray(), [dataset], []);
  const userCms = useLiveQuery(() => db.countermeasures.where('dataset').equals(dataset).toArray(), [dataset], []);
  const userChecks = useLiveQuery(() => db.dailyChecks.where('dataset').equals(dataset).toArray(), [dataset], []);
  const userScenarios = useLiveQuery(() => db.scenarioResults.where('dataset').equals(dataset).toArray(), [dataset], []);
  const lessons = useLiveQuery(() => db.lessons.toArray(), [], []);

  const derived = useMemo(() => {
    const demo = isDemo ? generateDemoMission() : null;
    const upTo = <T extends { day: number }>(xs: T[]) => xs.filter((x) => x.day <= day);
    const measurements = upTo([...(demo?.measurements ?? []), ...userMeasurements]);
    const symptoms = upTo([...(demo?.symptoms ?? []), ...userSymptoms]).sort((a, b) => b.timestamp - a.timestamp);
    const countermeasures = upTo(mergeCountermeasures(demo?.countermeasures ?? [], userCms));
    const dailyChecks = upTo([...(demo?.dailyChecks ?? []), ...userChecks]);
    const scenarioResults = upTo([...(demo?.scenarioResults ?? []), ...userScenarios]).sort((a, b) => b.timestamp - a.timestamp);
    const baselines = computeBaselines(measurements);
    const series = computeDailyScores(measurements, baselines, day);
    const timeline = computeAlertTimeline(series, symptoms, day);
    return { measurements, symptoms, countermeasures, dailyChecks, scenarioResults, baselines, series, timeline };
  }, [isDemo, day, userMeasurements, userSymptoms, userCms, userChecks, userScenarios]);

  const dateOf = useCallback((d: number) => dateForMissionDay(startISO, d), [startISO]);
  const dayLabel = useCallback((d: number) => `วันที่ ${d} (${shortDate(dateForMissionDay(startISO, d))})`, [startISO]);
  const current = derived.timeline[derived.timeline.length - 1];
  const currentReasons = useMemo(() => describeAlert(current, dayLabel), [current, dayLabel]);

  // Persist the evaluated alert for the selected day (local alert history).
  const lastSaved = useRef('');
  useEffect(() => {
    if (!ready) return;
    const sig = `${dataset}:${day}:${current.level}:${currentReasons.join('|')}`;
    if (sig === lastSaved.current) return;
    lastSaved.current = sig;
    const entry = { dataset, day, level: current.level, summary: currentReasons.join(' / '), evaluatedAt: Date.now() };
    db.alertHistory
      .where('[dataset+day]')
      .equals([dataset, day])
      .first()
      .then((ex) => (ex?.id !== undefined ? db.alertHistory.update(ex.id, entry) : db.alertHistory.add(entry)))
      .catch(() => undefined);
  }, [ready, dataset, day, current, currentReasons]);

  const value: MissionData = {
    ready,
    prefs,
    updatePrefs,
    dataset,
    isDemo,
    day,
    maxDay,
    todayDay,
    setDay,
    startISO,
    dateOf,
    dayLabel,
    ...derived,
    completedLessons: lessons.map((l) => l.lessonId),
    current,
    currentReasons,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMission(): MissionData {
  const v = useContext(Ctx);
  if (!v) throw new Error('useMission must be used inside MissionProvider');
  return v;
}
