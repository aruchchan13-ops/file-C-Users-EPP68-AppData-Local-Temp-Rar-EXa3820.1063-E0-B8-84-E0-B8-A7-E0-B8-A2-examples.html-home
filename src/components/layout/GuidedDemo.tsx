import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMission } from '../../hooks/useMission';
import { ALERT_META } from '../../services/alertService';
import { AlertPill } from '../ui';

/** ~2-minute guided demonstration (9 steps × ~13 s). */
interface Step {
  title: string;
  body: string;
  route: string;
  day?: number;
  showAlert?: boolean;
}

const STEPS: Step[] = [
  {
    title: 'ยินดีต้อนรับสู่ EyeReady',
    body: 'แอปเฝ้าระวังการมองเห็นและเตรียมความพร้อมรับมือ SANS สำหรับนักบินอวกาศ ทำงานออฟไลน์ เก็บข้อมูลในเครื่องเท่านั้น ทัวร์นี้ใช้ภารกิจจำลอง 180 วัน (ข้อมูลจำลอง)',
    route: '/',
    day: 60,
  },
  {
    title: 'สถานะวันนี้ (Home Status)',
    body: 'วันที่ 60: คะแนนการมองเห็นเทียบกับ baseline ส่วนตัว (ค่าเฉลี่ย 3 วันแรก) ยังคงที่ จึงเป็นสีเขียว ทุกสถานะใช้ทั้งสี รูปทรง และข้อความ',
    route: '/',
    day: 60,
    showAlert: true,
  },
  {
    title: 'ลองวัดจริง: Amsler grid',
    body: 'มองจุดกลางแล้วแตะช่องที่เส้นดูคด บิด หรือหายไป ระบบนับจำนวนช่องและบันทึกเพื่อเทียบรายวัน ทุกแบบทดสอบใช้งานได้จริง',
    route: '/training/amsler',
  },
  {
    title: 'บันทึกอาการ',
    body: 'บันทึกประเภทอาการ ความรุนแรง 0–10 ระยะเวลา และหมายเหตุ แก้ไขหรือลบได้ วันที่มีอาการ ≥2 ครั้งนับเป็น "วันที่มีอาการ" สำหรับการแจ้งเตือน',
    route: '/symptoms',
  },
  {
    title: 'เลื่อนไปวันที่ 110',
    body: 'ตัวเลือกวันภารกิจด้านบนเปลี่ยนข้อมูลทุกหน้าพร้อมกัน ตั้งแต่วันที่ 91 การมองเห็นค่อย ๆ ลดลง และอาการเริ่มถี่ขึ้นหลังวันที่ 105',
    route: '/',
    day: 110,
  },
  {
    title: 'ทำไมจึงเป็นสีเหลือง',
    body: 'การแจ้งเตือนคำนวณจากข้อมูลจริงของวันนั้น ไม่ได้กำหนดตายตัว เหตุผลพร้อมตัวเลข:',
    route: '/',
    day: 110,
    showAlert: true,
  },
  {
    title: 'เลื่อนไปวันที่ 135',
    body: 'กราฟแนวโน้มแสดงคะแนนเทียบ baseline เส้นเกณฑ์ 90% (เหลือง) และ 80% (แดง) และแถบประวัติการแจ้งเตือน',
    route: '/trend',
    day: 135,
  },
  {
    title: 'ทำไมจึงเป็นสีแดง',
    body: 'สีแดงต้องเข้าทั้งสองเงื่อนไข: คะแนนรายวัน < 80% สามวันติดต่อกัน และมีอาการที่เกี่ยวข้อง สิ่งที่ควรทำคือแจ้งแพทย์ประจำเที่ยวบิน',
    route: '/',
    day: 135,
    showAlert: true,
  },
  {
    title: 'สรุปสำหรับแพทย์ประจำเที่ยวบิน',
    body: 'รวมสถานะ baseline ผลล่าสุด อาการ มาตรการป้องกัน แนวโน้ม 30 วัน และการฝึก ส่งออกเป็น PDF ได้ (เฉพาะข้อมูลสรุป) จบทัวร์ ลองใช้งานต่อได้เลย',
    route: '/surgeon',
    day: 135,
  },
];

interface DemoCtx {
  start: () => void;
  active: boolean;
}
const Ctx = createContext<DemoCtx>({ start: () => undefined, active: false });
export const useGuidedDemo = () => useContext(Ctx);

export function GuidedDemoProvider({ children }: { children: ReactNode }) {
  const [index, setIndex] = useState<number | null>(null);
  const navigate = useNavigate();
  const { updatePrefs, prefs } = useMission();
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  const goTo = useCallback(
    (i: number) => {
      const s = STEPS[i];
      const patch: Record<string, unknown> = { mode: 'demo' };
      if (s.day) patch.demoDay = s.day;
      updatePrefs(patch);
      navigate(s.route);
      setIndex(i);
    },
    [navigate, updatePrefs],
  );

  const close = useCallback(() => {
    setIndex(null);
    updatePrefs({ guidedDemoSeen: true });
  }, [updatePrefs]);

  return (
    <Ctx.Provider value={{ start: () => goTo(0), active: index !== null }}>
      {children}
      {index !== null && <Overlay index={index} onNext={() => (index < STEPS.length - 1 ? goTo(index + 1) : close())} onPrev={() => index > 0 && goTo(index - 1)} onClose={close} />}
    </Ctx.Provider>
  );
}

function Overlay({ index, onNext, onPrev, onClose }: { index: number; onNext: () => void; onPrev: () => void; onClose: () => void }) {
  const step = STEPS[index];
  const { current, currentReasons, day } = useMission();
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), [index]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const meta = ALERT_META[current.level];

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="tour-title"
      className="no-print fixed inset-x-3 bottom-20 z-50 max-h-[60vh] overflow-y-auto rounded-xl border-2 border-brand bg-page p-4 shadow-2xl sm:inset-x-auto sm:right-6 sm:w-[26rem] lg:bottom-6"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="num text-sm font-semibold text-link">
          ทัวร์สาธิต · ขั้นตอน {index + 1}/{STEPS.length}
        </p>
        <button type="button" onClick={onClose} className="btn-ghost min-h-[40px] px-2 text-sm" aria-label="ปิดทัวร์สาธิต">
          ปิด ✕
        </button>
      </div>
      <h2 id="tour-title" ref={headingRef} tabIndex={-1} className="text-lg font-bold text-ink">
        {step.title}
      </h2>
      <p className="mt-1 text-[0.95rem] text-ink">{step.body}</p>
      {step.showAlert && (
        <div className="mt-3 rounded-lg bg-alt p-3 text-sm">
          <div className="mb-1 flex items-center gap-2">
            <AlertPill level={current.level} label={`${meta.en} · ${meta.label}`} />
            <span className="num text-ink-muted">วันที่ {day}</span>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-ink">
            {currentReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-alt" aria-hidden>
        <div className="h-full bg-brand" style={{ width: `${((index + 1) / STEPS.length) * 100}%` }} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="btn-ghost text-sm" onClick={onClose}>
          ข้ามทัวร์
        </button>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={onPrev} disabled={index === 0}>
            ก่อนหน้า
          </button>
          <button type="button" className="btn-primary" onClick={onNext}>
            {index === STEPS.length - 1 ? 'เสร็จสิ้น' : 'ถัดไป'}
          </button>
        </div>
      </div>
    </div>
  );
}
