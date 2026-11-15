const DAY_MS = 86_400_000;

export function dateForMissionDay(startISO: string, day: number): Date {
  const start = new Date(`${startISO}T00:00:00`);
  return new Date(start.getTime() + (day - 1) * DAY_MS);
}

export function missionDayForDate(startISO: string, date = new Date()): number {
  const start = new Date(`${startISO}T00:00:00`).getTime();
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return Math.floor((today - start) / DAY_MS) + 1;
}

export function shortDate(d: Date): string {
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

export function longDate(d: Date): string {
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function dateTime(ts: number): string {
  return new Date(ts).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function pct(v: number | null | undefined, digits = 1): string {
  return v === null || v === undefined || !Number.isFinite(v) ? '—' : `${v.toFixed(digits)}%`;
}
