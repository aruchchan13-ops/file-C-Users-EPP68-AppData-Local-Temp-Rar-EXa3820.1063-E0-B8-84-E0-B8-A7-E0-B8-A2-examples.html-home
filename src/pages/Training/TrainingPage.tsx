import { Link } from 'react-router-dom';
import { MEASUREMENT_TYPES } from '../../types';
import { useMission } from '../../hooks/useMission';
import { useDailyPlan } from '../../hooks/useDailyPlan';
import { MEASUREMENT_META } from '../../services/measurementService';
import { scenarioStats } from '../../services/trainingService';
import { LESSONS } from '../../data/lessons';
import { Card, PageHeader, ProgressBar, Stat } from '../../components/ui';
import { ScenarioList } from '../Scenarios/ScenarioListPage';
import { Icon } from '../../components/layout/Icon';
import { pct } from '../../utils/format';

const MODULE_BLURB = {
  near: 'ตารางตัวอักษรเล็กลงทีละแถว หาแถวเล็กที่สุดที่อ่านถูก',
  amsler: 'ตารางเส้นตรง แตะช่องที่เส้นคด บิด หรือหายไป',
  contrast: 'วงกลมลายจาง 15 ข้อ แบบขั้นบันได 1-up/2-down',
  focus: 'สลับมองใกล้–ไกล 10 รอบ จับเวลาการปรับโฟกัส',
} as const;

export function TrainingPage() {
  const { series, baselines, day, scenarioResults, completedLessons } = useMission();
  const plan = useDailyPlan();
  const stats = scenarioStats(scenarioResults);
  const lastWithData = [...series].reverse();

  return (
    <div>
      <PageHeader title="การฝึกและการวัด" en="Training" description="แบบทดสอบการมองเห็น 4 แบบ สถานการณ์ฝึก 6 เรื่อง และบทเรียนสั้น — ผลทั้งหมดเก็บในเครื่องนี้" />

      <section className="mb-6 overflow-hidden rounded-xl bg-brand text-white on-brand" aria-labelledby="plan-title">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="min-w-0">
            <h2 id="plan-title" className="text-xl font-bold">
              แผนฝึกวันนี้ · {plan.totalMinutes.toFixed(1)} นาที
            </h2>
            <p className="text-white/85">
              ระดับความยาก {plan.level}/5 · ทำแล้ว {plan.doneCount}/{plan.items.length} รายการ
              {plan.fatigueHigh && ' · ลดภาระเพราะความล้าสูง'}
            </p>
          </div>
          <Link to="/training/plan" className="btn bg-white text-brand hover:bg-alt">
            เปิดแผนวันนี้ <Icon name="chevron" size={18} />
          </Link>
        </div>
        <div className="h-2 bg-white/20" aria-hidden>
          <div className="h-full bg-white" style={{ width: `${plan.percent}%` }} />
        </div>
      </section>

      <h2 className="mb-3 text-lg font-semibold text-ink">แบบทดสอบการมองเห็น</h2>
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        {MEASUREMENT_TYPES.map((t) => {
          const meta = MEASUREMENT_META[t];
          const last = lastWithData.find((d) => d.raw[t] !== undefined);
          const todayDone = series.find((d) => d.day === day)?.raw[t] !== undefined;
          return (
            <Card key={t}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-ink">{meta.label}</h3>
                  <p className="text-sm text-ink-muted">{meta.en}</p>
                </div>
                {todayDone ? (
                  <span className="tag bg-safe-bg text-safe">
                    <Icon name="check" size={14} /> วัดแล้ววันนี้
                  </span>
                ) : (
                  <span className="tag bg-alt text-ink-muted">ยังไม่วัดวันนี้</span>
                )}
              </div>
              <p className="mt-2 text-sm text-ink-muted">{MODULE_BLURB[t]}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-ink-muted">ล่าสุด {last ? `(วันที่ ${last.day})` : ''}</dt>
                  <dd className="num font-semibold text-ink">{last ? meta.format(last.raw[t]!) : '—'}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">เทียบ baseline</dt>
                  <dd className="num font-semibold text-ink">
                    {baselines[t].value === null ? `สร้าง baseline ${baselines[t].daysAvailable}/3` : pct(last?.scores[t] ?? null)}
                  </dd>
                </div>
              </dl>
              <Link to={`/training/${t}`} className="btn-primary mt-4 w-full">
                เริ่ม{meta.label}
              </Link>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="sc-title">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <h2 id="sc-title" className="text-lg font-semibold text-ink">
              สถานการณ์ฝึก (เรียงตามความยาก)
            </h2>
            <Link to="/training/scenarios" className="link text-sm">
              ดูทั้งหมด
            </Link>
          </div>
          <ScenarioList compact />
        </section>

        <div className="space-y-5">
          <Card title="สรุปการฝึก" id="dash">
            <div className="grid grid-cols-2 gap-4">
              <Stat label="ฝึกสถานการณ์ครบ" value={`${stats.completionRate}%`} sub={`${stats.completed}/6 เรื่อง`} />
              <Stat label="คะแนนเฉลี่ย" value={stats.averageScore === null ? '—' : stats.averageScore.toFixed(0)} sub="จากคะแนนดีที่สุด" />
            </div>
            <div className="mt-4">
              <ProgressBar value={stats.completionRate} label="อัตราการฝึกสถานการณ์ครบ" />
            </div>
          </Card>
          <Card title="บทเรียนสั้น (1 นาที)" id="lessons">
            <ul className="space-y-2">
              {LESSONS.map((l) => {
                const done = completedLessons.includes(l.id);
                return (
                  <li key={l.id}>
                    <Link to={`/training/lessons/${l.id}`} className="flex min-h-[44px] items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 hover:bg-alt">
                      <span className="text-ink">{l.title}</span>
                      {done ? (
                        <span className="tag bg-safe-bg text-safe">
                          <Icon name="check" size={14} /> เรียนแล้ว
                        </span>
                      ) : (
                        <span className="tag bg-alt text-ink-muted">ยังไม่เรียน</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
          <Link to="/measurements" className="btn-secondary w-full">
            <Icon name="list" size={18} /> ประวัติการวัดทั้งหมด
          </Link>
        </div>
      </div>
    </div>
  );
}
