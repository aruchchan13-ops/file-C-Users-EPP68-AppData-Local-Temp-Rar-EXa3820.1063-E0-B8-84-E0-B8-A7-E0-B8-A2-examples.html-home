import { useEffect, useState } from 'react';
import { useMission } from '../../hooks/useMission';
import { longDate } from '../../utils/format';
import { AlertShape, SimulatedTag } from '../ui';
import { ALERT_META } from '../../services/alertService';

const QUICK_DAYS = [60, 110, 135];

/** Global mission-day selector. Changing the day re-derives every page from the same data. */
export function MissionDayControl() {
  const { day, setDay, maxDay, isDemo, dateOf, current, todayDay, updatePrefs } = useMission();
  const [draft, setDraft] = useState(day);
  const [open, setOpen] = useState(false);
  useEffect(() => setDraft(day), [day]);

  const meta = ALERT_META[current.level];
  return (
    <div className="border-b border-line bg-alt no-print" data-tour="mission-day">
      <div className="mx-auto flex max-w-content flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          {isDemo ? (
            <>
              <span className="sm:hidden">
                <SimulatedTag label="ข้อมูลจำลอง" />
              </span>
              <span className="hidden sm:inline">
                <SimulatedTag label="โหมดสาธิต · ข้อมูลจำลอง" />
              </span>
            </>
          ) : (
            <span className="tag bg-brand text-white">ข้อมูลของฉัน</span>
          )}
          <p className="num text-sm text-ink">
            <span className="font-semibold">วันภารกิจ {day}</span>
            <span className="text-ink-muted"> / {maxDay}</span>
            <span className="hidden text-ink-muted sm:inline"> · {longDate(dateOf(day))}</span>
          </p>
          <span className="hidden items-center gap-1 text-sm sm:inline-flex" aria-label={`สถานะเตือน ${meta.label}`}>
            <AlertShape level={current.level} size={14} />
            <span className="text-ink-muted">{meta.en}</span>
          </span>
        </div>
        <button
          type="button"
          className="btn-ghost ml-auto min-h-[44px] shrink-0 px-3 text-sm md:hidden"
          aria-expanded={open}
          aria-controls="mission-day-panel"
          onClick={() => setOpen((o) => !o)}
        >
          เปลี่ยนวัน
        </button>
        <div id="mission-day-panel" className={`${open ? 'flex' : 'hidden'} w-full flex-wrap items-center gap-2 md:ml-auto md:flex md:w-auto`}>
          <div className="flex gap-1" role="group" aria-label="เลือกวันภารกิจอย่างรวดเร็ว">
            {isDemo ? (
              QUICK_DAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDay(d)}
                  aria-pressed={day === d}
                  className={`num min-h-[40px] rounded-lg px-3 text-sm font-semibold ${day === d ? 'bg-brand text-white' : 'border border-line bg-page text-brand hover:bg-alt'}`}
                >
                  Day {d}
                </button>
              ))
            ) : (
              <button type="button" onClick={() => setDay(Math.min(maxDay, todayDay))} className="min-h-[40px] rounded-lg border border-line bg-page px-3 text-sm font-semibold text-brand hover:bg-alt">
                วันนี้ (วันที่ {todayDay})
              </button>
            )}
          </div>
          <label className="flex min-w-[220px] flex-1 items-center gap-2 text-sm md:w-64 md:flex-none">
            <span className="sr-only">เลื่อนเลือกวันภารกิจ 1 ถึง {maxDay}</span>
            <span aria-hidden className="num text-ink-muted">1</span>
            <input
              type="range"
              min={1}
              max={maxDay}
              value={draft}
              onChange={(e) => setDraft(Number(e.target.value))}
              onPointerUp={() => setDay(draft)}
              onKeyUp={() => setDay(draft)}
              onBlur={() => draft !== day && setDay(draft)}
              aria-valuetext={`วันภารกิจ ${draft}`}
              className="w-full"
            />
            <span aria-hidden className="num text-ink-muted">{maxDay}</span>
          </label>
          {!isDemo && (
            <button type="button" className="btn-ghost min-h-[40px] px-3 text-sm" onClick={() => updatePrefs({ mode: 'demo' })}>
              ไปโหมดสาธิต
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
