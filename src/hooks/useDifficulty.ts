import { useMemo } from 'react';
import { useMission } from './useMission';
import { LEVEL_SETTINGS, LEVEL_START, difficultyHistory } from '../services/adaptivePlanService';

/** Current adaptive difficulty level and its per-test settings. */
export function useDifficulty() {
  const { series, day } = useMission();
  return useMemo(() => {
    const steps = difficultyHistory(series, day);
    const level = steps[steps.length - 1]?.level ?? LEVEL_START;
    return { level, settings: LEVEL_SETTINGS[level], steps };
  }, [series, day]);
}
