import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMission } from '../../hooks/useMission';
import { useUi } from '../../hooks/useUi';
import { useDailyPlan } from '../../hooks/useDailyPlan';
import { useDifficulty } from '../../hooks/useDifficulty';
import { saveDailyCheck } from '../../services/trainingService';
import { FATIGUE_HIGH, LEVEL_MAX, LEVEL_MIN, POOR_SCORE, STRONG_SCORE } from '../../services/adaptivePlanService';
import { MEASUREMENT_META } from '../../services/measurementService';
import { SCENARIOS } from '../../data/scenarios';
import { LESSONS } from '../../data/lessons';
import { Card, PageHeader, ProgressBar } from '../../components/ui';
import { Icon } from '../../components/layout/Icon';
import { pct } from '../../utils/format';

export function DailyPlanPage() {
  const { dataset, day, dailyChecks, series, scenarioResults, dayLabel } = useMission();
  const { toast } = useUi();
  const plan = useDailyPlan();
  const { steps } = useDifficulty();
  const existingCheck = dailyChecks.find((c) => c.day === day);
  const [fatigue, setFatigue] = useState(existingCheck?.fatigue ?? 3);
  useEffect(() => setFatigue(existingCheck?.fatigue ?? 3), [existingCheck?.fatigue, day]);

  const saveCheck = async () => {
    const res = await saveDailyCheck(dataset, day, fatigue);
    if (res.ok) toast(fatigue >= FATIGUE_HIGH ? 'บันทึกแล้ว — ความล้าสูง แผนวันนี้ถูกลดภาระ' : 'บันทึกการเช็กประจำวันแล้ว');
    else toast(res.error, 'error');
  };

  const allDone = plan.doneCount === plan.items.length;
  const today = series.find((d) => d.day === day);
  const recentChanges = steps.filter((s) => s.change !== 'none').slice(-4).reverse();

  const titleOf = (it: (typeof plan.items)[number]) => {
    if (it.kind === 'check') return 'เช็กอาการและความล้า';
    if (it.kind === 'measure') return MEASUREMENT_META[it.type!].label;
    if (it.kind === 'scenario') return `สถานการณ์: ${SCENARIOS.find((s) => s.id === it.scenarioId)?.title}`;
    return `บทเรียน: ${LESSONS.find((l) => l.id === it.lessonId)?.title}`;
  };

  return (
    <div>
      <nav aria-label="breadcrumb" className="mb-2 text-sm">
        <Link className="link" to="/training">
          ← การฝึกและการวัด
        </Link>
      </nav>
      <PageHeader
        title="แผนฝึกประจำวัน"
        en="Adaptive Daily Plan"
        description={`${dayLabel(day)} · ประมาณ ${plan.totalMinutes.toFixed(1)} นาที (งบเวลา ${plan.budget} นาที) · สร้างจากผลที่บันทึกไว้`}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="num text-ink">
                ทำแล้ว <strong>{plan.doneCount}</strong> จาก {plan.items.length} รายการ
              </p>
              <span className="tag bg-alt text-brand">ระดับความยาก {plan.level}/5</span>
            </div>
            <div className="mt-3">
              <ProgressBar value={plan.percent} label="ความคืบหน้าแผนวันนี้" />
            </div>
            {plan.fatigueHigh && (
              <p className="mt-3 rounded-lg bg-caution-bg px-3 py-2 text-sm text-caution">
                ▲ ความล้าวันนี้ {plan.fatigue}/10 (≥ {FATIGUE_HIGH}) — ลดแผนเหลือ {plan.budget} นาที เน้นเฉพาะการวัดที่สำคัญที่สุด
              </p>
            )}
            {plan.buildingBaseline && <p className="mt-3 text-sm text-ink-muted">ช่วงสร้าง baseline: แผนจะให้วัดครบทั้ง 4 แบบจนมีข้อมูล 3 วัน</p>}
          </Card>

          <ol className="space-y-3">
            {plan.items.map((it, i) => (
              <li key={it.id} id={it.kind === 'check' ? 'check' : undefined}>
                <div className={`card p-4 ${it.done ? 'border-safe/50' : ''}`}>
                  <div className="flex flex-wrap items-start gap-3">
                    <span aria-hidden className={`num flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold ${it.done ? 'bg-safe text-white' : 'bg-alt text-brand'}`}>
                      {it.done ? '✓' : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold text-ink">
                        {titleOf(it)} <span className="num text-sm font-normal text-ink-muted">· {it.minutes} นาที</span>
                      </h2>
                      <p className="text-sm text-ink-muted">{it.reason}</p>
                      <p className="sr-only">{it.done ? 'เสร็จแล้ว' : 'ยังไม่ทำ'}</p>
                    </div>
                    {it.kind !== 'check' &&
                      (it.done ? (
                        <span className="tag bg-safe-bg text-safe">
                          <Icon name="check" size={14} /> เสร็จแล้ว
                        </span>
                      ) : (
                        <Link to={it.route} className="btn-primary">
                          เริ่ม
                        </Link>
                      ))}
                  </div>
                  {it.kind === 'check' && (
                    <div className="mt-3 rounded-lg bg-alt p-3">
                      <label htmlFor="fatigue" className="label">
                        ตอนนี้รู้สึกล้าแค่ไหน? <span className="num">{fatigue}/10</span>
                      </label>
                      <input id="fatigue" type="range" min={0} max={10} value={fatigue} onChange={(e) => setFatigue(Number(e.target.value))} className="w-full" aria-valuetext={`${fatigue} จาก 10`} />
                      <div className="num flex justify-between text-xs text-ink-muted" aria-hidden>
                        <span>0 สดชื่น</span>
                        <span>10 ล้ามาก</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button type="button" className="btn-primary" onClick={saveCheck}>
                          {existingCheck ? 'อัปเดตการเช็ก' : 'บันทึกการเช็ก'}
                        </button>
                        <Link to="/symptoms" className="btn-secondary">
                          มีอาการอื่น? บันทึกอาการ
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {allDone && (
            <Card title="สรุปวันนี้ ✓" id="summary">
              <p className="text-ink">ทำแผนครบแล้ว ขอบคุณที่ช่วยเก็บข้อมูลอย่างสม่ำเสมอ</p>
              <dl className="num mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-ink-muted">คะแนนรวมวันนี้</dt>
                  <dd className="font-semibold">{pct(today?.composite ?? null)}</dd>
                </div>
                {Object.entries(today?.scores ?? {}).map(([t, v]) => (
                  <div key={t}>
                    <dt className="text-ink-muted">{MEASUREMENT_META[t as keyof typeof MEASUREMENT_META].label}</dt>
                    <dd className="font-semibold">{pct(v)}</dd>
                  </div>
                ))}
                {scenarioResults
                  .filter((r) => r.day === day)
                  .slice(0, 1)
                  .map((r) => (
                    <div key={r.timestamp}>
                      <dt className="text-ink-muted">สถานการณ์ฝึก</dt>
                      <dd className="font-semibold">{r.score}/100</dd>
                    </div>
                  ))}
              </dl>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card title="ระบบปรับความยาก" id="rules">
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
              <li>
                ทำได้ดี (≥ {STRONG_SCORE}% ของ baseline) 3 วันติดต่อกัน → ยากขึ้น 1 ระดับ
              </li>
              <li>วันที่ทำได้ไม่ดี (&lt; {POOR_SCORE}%) → ง่ายลง 1 ระดับ</li>
              <li>ความล้า ≥ {FATIGUE_HIGH}/10 → ลดเวลาแผนเหลือ 3 นาที</li>
              <li>
                ระดับอยู่ในช่วงปลอดภัย {LEVEL_MIN}–{LEVEL_MAX} เสมอ
              </li>
              <li>ลำดับกิจกรรมเริ่มจากการวัดที่อ่อนที่สุดในสัปดาห์นี้</li>
            </ul>
            <p className="mt-3 text-sm text-ink">{plan.levelReason}</p>
            {recentChanges.length > 0 && (
              <ul className="num mt-2 space-y-1 text-sm text-ink-muted">
                {recentChanges.map((s) => (
                  <li key={s.day}>
                    D{s.day}: {s.change === 'up' ? '▲' : '▼'} ระดับ {s.level} — {s.reason}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="การวัดที่อ่อนที่สุดสัปดาห์นี้" id="weak">
            <ol className="num space-y-1 text-sm">
              {plan.weakest.map((w) => (
                <li key={w.type} className="flex justify-between gap-2">
                  <span>{MEASUREMENT_META[w.type].label}</span>
                  <span className="text-ink-muted">{pct(w.mean)}</span>
                </li>
              ))}
            </ol>
          </Card>
        </aside>
      </div>
    </div>
  );
}
