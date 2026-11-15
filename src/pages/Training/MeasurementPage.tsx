import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { Measurement, MeasurementType } from '../../types';
import { useMission } from '../../hooks/useMission';
import { useUi } from '../../hooks/useUi';
import { useDifficulty } from '../../hooks/useDifficulty';
import { MEASUREMENT_META, markInProgress, saveMeasurement, takeInterrupted } from '../../services/measurementService';
import { normalise } from '../../services/scoringService';
import { NearVisionTest } from '../../components/training/NearVisionTest';
import { AmslerTest } from '../../components/training/AmslerTest';
import { ContrastTest } from '../../components/training/ContrastTest';
import { FocusTest } from '../../components/training/FocusTest';
import { Card, Notice, PageHeader, SimulatedTag } from '../../components/ui';
import { pct } from '../../utils/format';

const INSTRUCTIONS: Record<MeasurementType, { minutes: string; steps: string[] }> = {
  near: {
    minutes: '~1.5 นาที',
    steps: [
      'ถือหน้าจอห่างจากตาประมาณ 40 ซม. (ประมาณความยาวแขนท่อนล่าง) ในที่มีแสงสว่างพอ',
      'ใส่แว่นอ่านหนังสือที่แพทย์สั่ง (ถ้ามี) และทดสอบด้วยสองตาเหมือนกันทุกครั้ง',
      'แต่ละแถวมีตัวอักษร 3 ตัว เลือกทีละตัวจากซ้ายไปขวา ถ้าไม่แน่ใจให้กด "มองไม่ชัด" — อย่าเดา',
      'แบบทดสอบจะหยุดเองเมื่ออ่านผิดตั้งแต่ 2 ตัวในแถวเดียว',
    ],
  },
  amsler: {
    minutes: '~1 นาที',
    steps: [
      'ถือหน้าจอห่างประมาณ 30–40 ซม. ใส่แว่นอ่านหนังสือ (ถ้ามี)',
      'ปิดตาอีกข้าง แล้วจ้องจุดดำตรงกลางตลอดเวลา',
      'แตะช่องที่เส้นดูคด บิด เบลอ หรือหายไป แตะซ้ำเพื่อยกเลิก',
      'ถ้าเส้นทุกเส้นปกติ ให้กดบันทึกได้ทันที',
    ],
  },
  contrast: {
    minutes: '~1.5 นาที',
    steps: [
      'ถือหน้าจอห่างประมาณ 40 ซม. ปรับความสว่างหน้าจอให้เท่าเดิมทุกครั้ง',
      'วงกลมจะมีลายเส้นจาง ๆ เลือกว่าเป็นแนวตั้ง เฉียงซ้าย หรือเฉียงขวา',
      'ลายจะจางลงเมื่อตอบถูก 2 ครั้งติดกัน และเข้มขึ้นเมื่อตอบผิด รวม 15 ข้อ',
      'ถ้ามองไม่เห็นลาย ให้กด "มองไม่เห็นลาย" — อย่าเดา',
    ],
  },
  focus: {
    minutes: '~1.5 นาที',
    steps: [
      'เลือกวัตถุที่อยู่ไกลอย่างน้อย 3 เมตร (เช่น ป้ายบนผนังโมดูล) และถือหน้าจอห่าง 40 ซม.',
      'สลับ 10 รอบ: ไกล→ใกล้ (เลือกรหัสที่ตรงกัน) และใกล้→ไกล (แตะเมื่อวัตถุไกลชัด)',
      'รอสัญญาณเสียง/ข้อความก่อนเปลี่ยนการมอง ระบบไม่นับรอบที่ตอบเร็วผิดปกติ',
      'ผลคือเวลาเฉลี่ยในการปรับโฟกัส (ยิ่งน้อยยิ่งดี)',
    ],
  },
};

export function MeasurementPage({ type }: { type: MeasurementType }) {
  const { dataset, day, isDemo, baselines, prefs, dayLabel } = useMission();
  const { toast } = useUi();
  const { level, settings } = useDifficulty();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const fromPlan = params.get('from') === 'plan';
  const [stage, setStage] = useState<'intro' | 'running' | 'saving' | 'done'>('intro');
  const [result, setResult] = useState<{ raw: number; details: Measurement['details']; saved: boolean } | null>(null);
  const [interrupted, setInterrupted] = useState<MeasurementType | null>(null);
  const [runKey, setRunKey] = useState(0);
  const meta = MEASUREMENT_META[type];

  useEffect(() => setInterrupted(takeInterrupted()), []);

  // Warn before leaving mid-test; the partial result is never saved.
  useEffect(() => {
    if (stage !== 'running') return;
    markInProgress(type);
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [stage, type]);
  // Note: leaving mid-test keeps the in-progress flag, so the next visit explains nothing was saved.

  const complete = async (raw: number, details: Measurement['details']) => {
    markInProgress(null);
    setStage('saving'); // lock the test immediately so a fast extra tap cannot save twice
    const res = await saveMeasurement(dataset, day, type, raw, details);
    setResult({ raw, details, saved: res.ok });
    setStage('done');
    if (res.ok) toast(`บันทึกผล${meta.label}แล้ว (วันภารกิจ ${day})`);
    else toast(res.error, 'error');
  };

  const baseline = baselines[type];
  const score = result && baseline.value !== null ? normalise(type, result.raw, baseline.value) : null;

  let test: ReactNode = null;
  if (type === 'near') test = <NearVisionTest key={runKey} pxPerMm={prefs.pxPerMm} startLogMAR={settings.nearStartLogMAR} onComplete={complete} />;
  if (type === 'amsler') test = <AmslerTest key={runKey} onComplete={complete} />;
  if (type === 'contrast') test = <ContrastTest key={runKey} startContrast={settings.contrastStart} onComplete={complete} />;
  if (type === 'focus') test = <FocusTest key={runKey} pxPerMm={prefs.pxPerMm} digits={settings.focusDigits} choices={settings.focusChoices} onComplete={complete} />;

  return (
    <div>
      <nav aria-label="breadcrumb" className="mb-2 text-sm">
        <Link className="link" to={fromPlan ? '/training/plan' : '/training'}>
          ← {fromPlan ? 'แผนฝึกประจำวัน' : 'การฝึกและการวัด'}
        </Link>
      </nav>
      <PageHeader title={meta.label} en={meta.en} description={`${INSTRUCTIONS[type].minutes} · ระดับความยาก ${level}/5 · บันทึกสำหรับ${dayLabel(day)}`} />

      {interrupted && (
        <div className="mb-4">
          <Notice tone="caution" title="การทดสอบครั้งก่อนไม่สมบูรณ์">
            การทดสอบ{MEASUREMENT_META[interrupted].label}ถูกขัดจังหวะ ผลบางส่วนจึงไม่ได้บันทึก เริ่มใหม่ได้ทุกเมื่อ
          </Notice>
        </div>
      )}
      {isDemo && (
        <div className="mb-4">
          <Notice tone="caution">
            <span className="inline-flex flex-wrap items-center gap-2">
              <SimulatedTag /> คุณอยู่ในโหมดสาธิต ผลที่วัดตอนนี้จะถูกเพิ่มในภารกิจสาธิต (ทำเครื่องหมาย "บันทึกโดยผู้ใช้") สำหรับ{dayLabel(day)}
            </span>
          </Notice>
        </div>
      )}

      {stage === 'intro' && (
        <Card title="วิธีทดสอบ" id="howto">
          <ol className="list-decimal space-y-2 pl-5 text-ink">
            {INSTRUCTIONS[type].steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <p className="hint mt-3">
            แบบทดสอบบนหน้าจอนี้ใช้ติดตามการเปลี่ยนแปลงเทียบกับตัวเอง ไม่ใช่การตรวจตาทางคลินิก
            {type === 'near' && ' ขนาดตัวอักษรอิงการปรับเทียบหน้าจอในหน้า "ตั้งค่า"'}
          </p>
          <button type="button" className="btn-primary mt-4" onClick={() => setStage('running')}>
            เริ่มทดสอบ
          </button>
        </Card>
      )}

      {stage === 'running' && (
        <Card>
          {test}
          <div className="mt-6 border-t border-line pt-4">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                markInProgress(null);
                setStage('intro');
                setRunKey((k) => k + 1);
              }}
            >
              ยกเลิก (ไม่บันทึก)
            </button>
          </div>
        </Card>
      )}

      {stage === 'saving' && (
        <Card>
          <p className="text-ink" role="status">
            กำลังบันทึกผล…
          </p>
        </Card>
      )}

      {stage === 'done' && result && (
        <Card title="ผลการวัด" id="result">
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-ink-muted">ผลดิบ (raw)</dt>
              <dd className="num text-xl font-bold text-ink">{meta.format(result.raw)}</dd>
              {type === 'near' && result.details && 'smallestRowLogMAR' in result.details && (
                <dd className="num text-sm text-ink-muted">
                  แถวเล็กที่สุดที่อ่านถูกครบ: {result.details.smallestRowLogMAR === null ? 'ไม่มี' : `logMAR ${result.details.smallestRowLogMAR.toFixed(1)}`} · อ่านถูก {result.details.lettersCorrect} ตัว
                </dd>
              )}
              {type === 'focus' && result.details && 'farToNearMs' in result.details && (
                <dd className="num text-sm text-ink-muted">
                  ไกล→ใกล้ {result.details.farToNearMs ? (result.details.farToNearMs / 1000).toFixed(2) : '—'} s · ใกล้→ไกล{' '}
                  {result.details.nearToFarMs ? (result.details.nearToFarMs / 1000).toFixed(2) : '—'} s
                </dd>
              )}
            </div>
            <div>
              <dt className="text-sm text-ink-muted">Baseline ส่วนตัว</dt>
              <dd className="num text-xl font-bold text-ink">{baseline.value === null ? `กำลังสร้าง (${baseline.daysAvailable}/3 วัน)` : meta.format(baseline.value)}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">คะแนนเทียบ baseline</dt>
              <dd className="num text-xl font-bold text-ink">{score === null ? '—' : pct(score)}</dd>
              <dd className="text-sm text-ink-muted">100% = เท่ากับ baseline · สูงกว่า = ดีกว่า</dd>
            </div>
          </dl>
          {!result.saved && (
            <div className="mt-4">
              <Notice tone="danger">ยังไม่ได้บันทึก ลองอีกครั้ง หรือตรวจพื้นที่จัดเก็บของเบราว์เซอร์</Notice>
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            {fromPlan && (
              <button type="button" className="btn-primary" onClick={() => navigate('/training/plan')}>
                กลับไปแผนวันนี้
              </button>
            )}
            <button
              type="button"
              className={fromPlan ? 'btn-secondary' : 'btn-primary'}
              onClick={() => {
                setResult(null);
                setRunKey((k) => k + 1);
                setStage('running');
              }}
            >
              ทดสอบอีกครั้ง
            </button>
            <Link to="/measurements" className="btn-secondary">
              ดูประวัติการวัด
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
