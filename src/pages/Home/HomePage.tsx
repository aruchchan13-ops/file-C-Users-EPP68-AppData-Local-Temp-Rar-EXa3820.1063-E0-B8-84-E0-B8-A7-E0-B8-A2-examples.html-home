import { Link } from 'react-router-dom';
import { MEASUREMENT_TYPES } from '../../types';
import { useMission } from '../../hooks/useMission';
import { useDailyPlan } from '../../hooks/useDailyPlan';
import { useSurgeonSummary, SYMPTOM_LABEL } from '../../hooks/useSurgeonSummary';
import { MEASUREMENT_META } from '../../services/measurementService';
import { CM_KEYS, CM_META, isAdherent } from '../../services/countermeasureService';
import { isSymptomDay, occurrencesByDay } from '../../services/alertService';
import { AlertCard } from '../../components/alerts/AlertCard';
import { Card, MedicalDisclaimer, ProgressBar, SimulatedTag } from '../../components/ui';
import { Icon } from '../../components/layout/Icon';
import { useGuidedDemo } from '../../components/layout/GuidedDemo';
import { longDate, pct } from '../../utils/format';

export function HomePage() {
  const { day, dateOf, isDemo, series, baselines, symptoms, countermeasures, dayLabel, updatePrefs } = useMission();
  const plan = useDailyPlan();
  const summary = useSurgeonSummary();
  const { start } = useGuidedDemo();
  const today = series.find((d) => d.day === day);
  const occ = occurrencesByDay(symptoms);
  const last7 = Array.from({ length: 7 }, (_, i) => day - 6 + i).filter((d) => d >= 1);
  const cmToday = countermeasures.find((c) => c.day === day);
  const buildingBaseline = MEASUREMENT_TYPES.some((t) => baselines[t].value === null);

  return (
    <div className="space-y-5">
      <section className="on-brand -mx-4 -mt-6 bg-chrome px-4 pb-6 pt-6 text-white sm:-mx-6 sm:px-6 lg:mx-0 lg:mt-0 lg:rounded-xl lg:px-7 lg:pt-7 lg:shadow-card" aria-labelledby="home-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 id="home-title" className="text-3xl font-bold leading-tight sm:text-[2.125rem]">
              <span className="sr-only">สถานะวันนี้: </span>วันภารกิจที่ <span className="num">{day}</span>
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-white/80">
              <span>{longDate(dateOf(day))}</span>
              {isDemo && <SimulatedTag />}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/training/plan" className="btn-on-chrome">
              <Icon name="plan" size={18} /> เริ่มแผนวันนี้ ({plan.totalMinutes.toFixed(1)} นาที)
            </Link>
            <button type="button" className="btn-outline-chrome" onClick={start}>
              <Icon name="play" size={16} /> ทัวร์สาธิต
            </button>
          </div>
        </div>
        <dl className="num mt-6 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-white/15 pt-5 sm:grid-cols-4 sm:divide-x sm:divide-white/15 [&>div]:sm:px-5 [&>div:first-child]:sm:pl-0">
          <div>
            <dt className="text-sm text-white/75">คะแนนวันนี้</dt>
            <dd className="text-2xl font-bold">{today?.composite == null ? '—' : pct(today.composite)}</dd>
            <dd className="text-xs text-white/75">{today?.composite == null ? 'ยังไม่มีการวัดวันนี้' : 'ของ baseline ส่วนตัว'}</dd>
          </div>
          <div>
            <dt className="text-sm text-white/75">ค่าเฉลี่ย 7 วัน</dt>
            <dd className="text-2xl font-bold">{pct(today?.avg7 ?? null)}</dd>
            <dd className="text-xs text-white/75">เกณฑ์เหลือง &lt; 90%</dd>
          </div>
          <div>
            <dt className="text-sm text-white/75">แผนฝึกวันนี้</dt>
            <dd className="text-2xl font-bold">
              {plan.doneCount}/{plan.items.length}
            </dd>
            <dd className="text-xs text-white/75">ระดับความยาก {plan.level}/5</dd>
          </div>
          <div>
            <dt className="text-sm text-white/75">นัดตรวจตาถัดไป</dt>
            <dd className="text-2xl font-bold">{summary.exam.nextExam === null ? '—' : `D${summary.exam.nextExam}`}</dd>
            <dd className="text-xs text-white/75">{summary.exam.daysToNext === null ? 'ไม่มีในตาราง' : summary.exam.daysToNext === 0 ? 'วันนี้' : `อีก ${summary.exam.daysToNext} วัน`}</dd>
          </div>
        </dl>
      </section>

      {!isDemo && buildingBaseline && (
        <Card title="เริ่มต้นภารกิจของคุณ" id="onboard">
          <p className="text-ink">
            ระบบต้องใช้การวัดอย่างน้อย 3 วันเพื่อสร้าง baseline ส่วนตัว ก่อนจะคำนวณคะแนนและการแจ้งเตือนได้ ทำแผนฝึกวันนี้เพื่อเริ่มเก็บข้อมูล
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/training/plan" className="btn-primary">
              เริ่มแผนวันนี้
            </Link>
            <button type="button" className="btn-secondary" onClick={() => updatePrefs({ mode: 'demo' })}>
              ดูภารกิจสาธิต 180 วัน
            </button>
          </div>
        </Card>
      )}

      <AlertCard />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="ผลการวัดเทียบ baseline" id="tests" actions={<Link to="/measurements" className="link text-sm">ประวัติทั้งหมด</Link>}>
          <ul className="space-y-3">
            {summary.tests.map((t) => (
              <li key={t.type}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-ink">{MEASUREMENT_META[t.type].label}</span>
                  <span className="num text-sm text-ink-muted">
                    {t.latestRaw === null ? 'ยังไม่มีผล' : `${MEASUREMENT_META[t.type].format(t.latestRaw)} · ${dayLabel(t.latestDay!)}`}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3">
                  <div className="flex-1">
                    <ProgressBar value={Math.min(100, ((t.latestScore ?? 0) / 120) * 100)} label={`${MEASUREMENT_META[t.type].label} คะแนน`} />
                  </div>
                  <span className="num w-20 text-right font-semibold text-ink">{t.baseline.value === null ? `${t.baseline.daysAvailable}/3 วัน` : pct(t.latestScore)}</span>
                </div>
              </li>
            ))}
          </ul>
          <p className="hint mt-3">แถบเต็ม = 120% ของ baseline · คะแนนสูง = ดี</p>
        </Card>

        <Card title="อาการ 7 วันล่าสุด" id="sym7" actions={<Link to="/symptoms" className="link text-sm">บันทึกอาการ</Link>}>
          <ol className="grid grid-cols-7 gap-1.5" aria-label="จำนวนอาการรายวัน 7 วันล่าสุด">
            {last7.map((d) => {
              const n = occ.get(d)?.length ?? 0;
              const sd = isSymptomDay(occ, d);
              return (
                <li key={d} className={`num flex flex-col items-center rounded-lg border p-2 text-center ${sd ? 'border-caution bg-caution-bg' : 'border-line'}`}>
                  <span className="text-xs text-ink-muted">D{d}</span>
                  <span className="text-lg font-bold text-ink">{n}</span>
                  <span className={`inline-flex items-center gap-0.5 text-[0.68rem] leading-tight ${sd ? 'font-semibold text-caution' : 'text-ink-muted'}`}>
                    {sd && <Icon name="triangle" size={10} />}
                    {sd ? 'วันมีอาการ' : 'ครั้ง'}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-sm text-ink-muted">
            วันที่มีอาการ (≥2 ครั้ง): {summary.symptoms.symptomDays7}/7 วัน · เกณฑ์เหลือง ≥ 3 วัน
          </p>
          {(() => {
            const todays = symptoms.filter((s) => s.day === day && s.severity >= 1);
            return todays.length ? (
              <p className="mt-1 text-sm text-ink">วันนี้: {todays.map((s) => `${SYMPTOM_LABEL[s.category]} (${s.severity}/10)`).join(', ')}</p>
            ) : null;
          })()}
        </Card>

        <Card title="มาตรการป้องกันวันนี้" id="cmtoday" actions={<Link to="/countermeasures" className="link text-sm">บันทึก/แก้ไข</Link>}>
          {cmToday ? (
            <ul className="grid grid-cols-2 gap-2">
              {CM_KEYS.map((k) => {
                const a = isAdherent(cmToday, k);
                return (
                  <li key={k} className="rounded-lg border border-line p-2 text-sm">
                    <p className="text-ink-muted">{CM_META[k].en.split(' (')[0]}</p>
                    <p className={`flex items-center gap-1 font-semibold ${a ? 'text-safe' : a === false ? 'text-danger' : 'text-ink-muted'}`}>
                      {a !== null && <Icon name={a ? 'check' : 'close'} size={16} />}
                      {a === null ? 'ไม่ได้บันทึก' : a ? 'ตามเป้า' : 'ต่ำกว่าเป้า'}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-ink-muted">ยังไม่ได้บันทึกมาตรการป้องกันสำหรับวันนี้</p>
          )}
          <p className="hint mt-2">7 วันล่าสุด: ทำตามเป้าเฉลี่ย {summary.adh7.overall === null ? '—' : `${Math.round(summary.adh7.overall)}%`}</p>
        </Card>

        <Card title="การฝึก" id="trainsum" actions={<Link to="/training" className="link text-sm">ไปหน้าการฝึก</Link>}>
          <p className="text-ink">
            สถานการณ์ฝึกครบ {summary.training.completed}/6 · คะแนนเฉลี่ย {summary.training.averageScore === null ? '—' : summary.training.averageScore.toFixed(0)} · บทเรียน {summary.lessonsDone}/
            {summary.lessonsTotal}
          </p>
          <div className="mt-3">
            <ProgressBar value={summary.training.completionRate} label="อัตราการฝึกสถานการณ์ครบ" />
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {plan.items.map((it) => (
              <li key={it.id} className="flex items-center gap-2">
                <span aria-hidden className={`inline-flex ${it.done ? 'text-safe' : 'text-ink-muted'}`}>
                  <Icon name={it.done ? 'check' : 'circle'} size={16} />
                </span>
                <span className={it.done ? 'text-ink-muted line-through' : 'text-ink'}>{planLabel(it)}</span>
                <span className="sr-only">{it.done ? 'เสร็จแล้ว' : 'ยังไม่ทำ'}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {isDemo && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <SimulatedTag /> ข้อมูลทั้งหมดในโหมดสาธิตเป็นข้อมูลสังเคราะห์ ไม่ใช่การวัดจริงของนักบินอวกาศหรือหลักฐานทางคลินิก
        </p>
      )}
      <MedicalDisclaimer />
    </div>
  );
}

export function planLabel(it: { kind: string; type?: string; scenarioId?: string; lessonId?: string }): string {
  if (it.kind === 'check') return 'เช็กอาการและความล้า';
  if (it.kind === 'measure') return MEASUREMENT_META[it.type as keyof typeof MEASUREMENT_META].label;
  if (it.kind === 'scenario') return 'สถานการณ์ฝึก';
  return 'บทเรียนสั้น';
}
