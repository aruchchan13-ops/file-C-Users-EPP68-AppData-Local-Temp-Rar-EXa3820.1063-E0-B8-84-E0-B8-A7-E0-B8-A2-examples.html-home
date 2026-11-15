import { Link } from 'react-router-dom';
import { useMission } from '../../hooks/useMission';
import { ALERT_META, THRESHOLDS, alertTransitions, type AlertEvaluation } from '../../services/alertService';
import type { AlertLevel } from '../../types';
import { AlertShape, LEVEL_STYLE, ThresholdNotice } from '../ui';
import { pct } from '../../utils/format';

/** Full alert explanation: level, exact numbers, dates, baseline comparison, next action. */
export function AlertCard({ showLinks = true }: { showLinks?: boolean }) {
  const { current, currentReasons, dayLabel, series, day } = useMission();
  const meta = ALERT_META[current.level];
  const s = LEVEL_STYLE[current.level];
  const today = series.find((d) => d.day === day);
  return (
    <section aria-labelledby="alert-title" className={`rounded-xl border-2 ${s.border} ${s.bg} p-4 sm:p-5`} data-alert-level={current.level}>
      <div className="flex flex-wrap items-center gap-3">
        <AlertShape level={current.level} size={34} />
        <div>
          <p className={`text-sm font-semibold ${s.text}`}>
            สถานะเตือน · {meta.en} ({meta.shape})
          </p>
          <h2 id="alert-title" className={`text-2xl font-bold ${s.text}`}>
            {meta.label}
          </h2>
        </div>
      </div>
      <div className="mt-3 space-y-3 text-ink">
        <div>
          <p className="text-sm font-semibold">เหตุผล (ตัวเลขจริงจากข้อมูล):</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-[0.95rem]">
            {currentReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
        <dl className="num grid gap-2 rounded-lg bg-page/80 p-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-ink-muted">คะแนนวันนี้ ({dayLabel(day)})</dt>
            <dd className="font-semibold">{today?.composite === null || today?.composite === undefined ? 'ไม่มีการวัด' : `${pct(today.composite)} ของ baseline`}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">ค่าเฉลี่ย 7 วัน</dt>
            <dd className="font-semibold">{pct(today?.avg7 ?? null)} ของ baseline</dd>
          </div>
          <div>
            <dt className="text-ink-muted">ห่างจาก baseline</dt>
            <dd className="font-semibold">{today?.avg7 != null ? `${(today.avg7 - 100).toFixed(1)} จุด` : '—'}</dd>
          </div>
        </dl>
        <div>
          <p className="text-sm font-semibold">สิ่งที่ควรทำต่อไป:</p>
          <p className="text-[0.95rem]">{meta.action}</p>
        </div>
        {showLinks && (
          <div className="flex flex-wrap gap-2 pt-1">
            {current.level !== 'green' && (
              <Link to="/surgeon" className="btn-primary">
                เปิดสรุปสำหรับแพทย์
              </Link>
            )}
            <Link to="/symptoms" className="btn-secondary">
              บันทึกอาการ
            </Link>
            <Link to="/trend" className="btn-secondary">
              ดูแนวโน้ม
            </Link>
          </div>
        )}
        <ThresholdNotice />
      </div>
    </section>
  );
}

/** Alert level for each day as a colour + shape band, with episode list (non-colour). */
export function AlertStrip({ timeline, maxDay }: { timeline: AlertEvaluation[]; maxDay: number }) {
  const { dayLabel } = useMission();
  const episodes = episodesOf(timeline);
  const color: Record<AlertLevel, string> = { green: 'rgb(var(--c-safe))', yellow: '#D9A21B', red: 'rgb(var(--c-danger))' };
  return (
    <div>
      <div className="relative h-7 w-full overflow-hidden rounded-md border border-line bg-alt" aria-hidden>
        {episodes.map((e) => (
          <div
            key={e.from}
            className="absolute inset-y-0"
            style={{
              left: `${((e.from - 1) / maxDay) * 100}%`,
              width: `${((e.to - e.from + 1) / maxDay) * 100}%`,
              background: color[e.level],
              backgroundImage: e.level === 'yellow' ? 'repeating-linear-gradient(45deg, transparent 0 5px, rgba(0,0,0,.18) 5px 7px)' : e.level === 'red' ? 'repeating-linear-gradient(0deg, transparent 0 4px, rgba(255,255,255,.35) 4px 6px)' : undefined,
            }}
          />
        ))}
      </div>
      <div className="num mt-1 flex justify-between text-xs text-ink-muted" aria-hidden>
        <span>วันที่ 1</span>
        <span>วันที่ {maxDay}</span>
      </div>
      <ol className="mt-3 space-y-1 text-sm" aria-label="ประวัติการแจ้งเตือน">
        {episodes.map((e) => (
          <li key={e.from} className="flex items-center gap-2">
            <AlertShape level={e.level} size={14} />
            <span className="font-semibold">{ALERT_META[e.level].en}</span>
            <span className="text-ink-muted">
              {dayLabel(e.from)} – {dayLabel(e.to)} ({e.to - e.from + 1} วัน)
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function episodesOf(timeline: AlertEvaluation[]) {
  const out: { level: AlertLevel; from: number; to: number }[] = [];
  for (const e of timeline) {
    const last = out[out.length - 1];
    if (last && last.level === e.level) last.to = e.day;
    else out.push({ level: e.level, from: e.day, to: e.day });
  }
  return out;
}

export function AlertTransitionsList({ timeline }: { timeline: AlertEvaluation[] }) {
  const { dayLabel } = useMission();
  const tr = alertTransitions(timeline);
  if (!tr.length) return <p className="text-sm text-ink-muted">ยังไม่มีการเปลี่ยนระดับการแจ้งเตือน (เขียวตลอด)</p>;
  return (
    <ul className="space-y-1 text-sm">
      {tr.map((t) => (
        <li key={t.day} className="flex items-center gap-2">
          <AlertShape level={t.to} size={14} />
          {dayLabel(t.day)}: {ALERT_META[t.from].en} → <strong>{ALERT_META[t.to].en}</strong>
        </li>
      ))}
    </ul>
  );
}

export const ALERT_RULES_TEXT = [
  `เหลือง: ค่าเฉลี่ย 7 วัน < ${THRESHOLDS.yellowAvg7}% ของ baseline ${THRESHOLDS.consecutiveDays} วันติดต่อกัน หรือ มีวันที่มีอาการ (≥${THRESHOLDS.symptomDayMinOccurrences} ครั้ง/วัน) ≥${THRESHOLDS.symptomDaysNeeded} วันใน 7 วัน`,
  `แดง: คะแนนรายวัน < ${THRESHOLDS.redDaily}% ของ baseline ${THRESHOLDS.consecutiveDays} วันติดต่อกัน และ มีอาการที่เกี่ยวข้อง (การมองเห็นหรือปวดศีรษะ) ใน ${THRESHOLDS.redSymptomWindowDays} วันล่าสุด`,
  'เขียว: ยังไม่เข้าเกณฑ์ใด',
];
