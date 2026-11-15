import { useState } from 'react';
import { useMission } from '../../hooks/useMission';
import { useUi, type TextScale, type ThemePref } from '../../hooks/useUi';
import { useInstallPrompt } from '../../hooks/useOnline';
import { clearDataset } from '../../services/database';
import { Card, Notice, PageHeader } from '../../components/ui';
import { useGuidedDemo } from '../../components/layout/GuidedDemo';

const CARD_MM = 85.6; // ISO/IEC 7810 ID-1 card width

export function SettingsPage() {
  const { prefs, updatePrefs, isDemo } = useMission();
  const { textScale, setTextScale, highContrast, setHighContrast, theme, setTheme, resolvedTheme, toast } = useUi();
  const { canInstall, installed, install } = useInstallPrompt();
  const { start } = useGuidedDemo();
  const [cardPx, setCardPx] = useState(Math.round(prefs.pxPerMm * CARD_MM));
  const [startDate, setStartDate] = useState(prefs.missionStartISO);

  const clear = async (which: 'demo' | 'personal') => {
    const msg = which === 'demo' ? 'ลบทุกอย่างที่คุณเพิ่มในโหมดสาธิต? (ข้อมูลจำลองจะยังอยู่)' : 'ลบข้อมูลภารกิจของฉันทั้งหมดในอุปกรณ์นี้? ไม่สามารถกู้คืนได้';
    if (!window.confirm(msg)) return;
    try {
      await clearDataset(which);
      toast('ลบข้อมูลแล้ว');
    } catch {
      toast('ลบข้อมูลไม่สำเร็จ', 'error');
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="ตั้งค่า" en="Settings" />

      <Card title="ชุดข้อมูล" id="mode">
        <fieldset>
          <legend className="sr-only">เลือกชุดข้อมูล</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ['demo', 'ภารกิจสาธิต 180 วัน', 'ข้อมูลจำลอง สำหรับการนำเสนอ — ทุกหน้าติดป้าย "ข้อมูลจำลอง"'],
                ['personal', 'ข้อมูลของฉัน', 'บันทึกผลจริงของคุณ เริ่มสร้าง baseline จากการวัด 3 วันแรก'],
              ] as const
            ).map(([v, t, d]) => (
              <label key={v} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${prefs.mode === v ? 'border-brand-ink bg-alt' : 'border-line'}`}>
                <input type="radio" name="mode" className="mt-1 h-5 w-5 accent-[rgb(var(--c-brand))]" checked={prefs.mode === v} onChange={() => updatePrefs({ mode: v })} />
                <span>
                  <span className="block font-semibold text-ink">{t}</span>
                  <span className="block text-sm text-ink-muted">{d}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {!isDemo && (
          <div className="mt-4">
            <label htmlFor="start" className="label">
              วันเริ่มภารกิจ (วันภารกิจที่ 1)
            </label>
            <div className="flex flex-wrap gap-2">
              <input id="start" type="date" className="field w-auto" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <button
                type="button"
                className="btn-secondary"
                disabled={!startDate || startDate === prefs.missionStartISO}
                onClick={() => {
                  updatePrefs({ missionStartISO: startDate });
                  toast('บันทึกวันเริ่มภารกิจแล้ว');
                }}
              >
                บันทึกวันเริ่ม
              </button>
            </div>
          </div>
        )}
        <button type="button" className="btn-ghost mt-3" onClick={start}>
          เริ่มทัวร์สาธิต (2 นาที)
        </button>
      </Card>

      <Card title="การแสดงผล (ช่วยเมื่อมองไม่ชัด)" id="display">
        <fieldset className="mb-5">
          <legend className="label">ธีม</legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['system', 'ตามระบบ'],
                ['light', 'สว่าง'],
                ['dark', 'มืด (แสงน้อย)'],
              ] as [ThemePref, string][]
            ).map(([v, l]) => (
              <button key={v} type="button" aria-pressed={theme === v} onClick={() => setTheme(v)} className={`btn ${theme === v ? 'bg-brand text-white' : 'border border-line text-ink hover:bg-alt'}`}>
                {l}
              </button>
            ))}
          </div>
          <p className="hint mt-1">ตอนนี้ใช้ธีม{resolvedTheme === 'dark' ? 'มืด' : 'สว่าง'} · พื้นที่แบบทดสอบสายตายังเป็นพื้นขาวเสมอเพื่อให้ผลวัดเทียบกันได้</p>
        </fieldset>
        <fieldset>
          <legend className="label">ขนาดตัวอักษร</legend>
          <div className="flex flex-wrap gap-2">
            {([100, 115, 130] as TextScale[]).map((s) => (
              <button key={s} type="button" aria-pressed={textScale === s} onClick={() => setTextScale(s)} className={`btn ${textScale === s ? 'bg-brand text-white' : 'border border-line text-ink hover:bg-alt'}`}>
                <span style={{ fontSize: `${s / 100}em` }}>ก Aa</span> {s}%
              </button>
            ))}
          </div>
        </fieldset>
        <label className="mt-4 flex min-h-[44px] cursor-pointer items-center gap-3">
          <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--c-brand))]" checked={highContrast} onChange={(e) => setHighContrast(e.target.checked)} />
          <span>
            <span className="block font-semibold text-ink">โหมดคอนทราสต์สูง (High-contrast mode)</span>
            <span className="block text-sm text-ink-muted">ตัวอักษรเข้มขึ้นและเส้นขอบชัดขึ้น</span>
          </span>
        </label>
      </Card>

      <Card title="ปรับเทียบหน้าจอ (สำหรับตารางสายตาระยะใกล้)" id="calibrate">
        <p className="text-sm text-ink-muted">วางบัตรขนาดมาตรฐาน (เช่น บัตรประชาชน/บัตรเครดิต กว้าง 85.6 มม.) ทาบกับแถบด้านล่าง แล้วเลื่อนจนแถบกว้างเท่ากับบัตร</p>
        <div className="my-4 overflow-hidden">
          <div className="flex h-14 items-center justify-center rounded-lg bg-brand text-sm text-white" style={{ width: `${cardPx}px`, maxWidth: '100%' }}>
            85.6 มม.
          </div>
        </div>
        <label htmlFor="cal" className="label">
          ความกว้างแถบ: <span className="num">{cardPx}px</span>
        </label>
        <input id="cal" type="range" min={200} max={700} value={cardPx} onChange={(e) => setCardPx(Number(e.target.value))} className="w-full" />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              updatePrefs({ pxPerMm: cardPx / CARD_MM });
              toast('บันทึกการปรับเทียบหน้าจอแล้ว');
            }}
          >
            บันทึกการปรับเทียบ
          </button>
          <button type="button" className="btn-ghost" onClick={() => setCardPx(Math.round(3.78 * CARD_MM))}>
            คืนค่าเริ่มต้น (96 dpi)
          </button>
        </div>
        <p className="hint mt-2">ปัจจุบัน: {prefs.pxPerMm.toFixed(2)} px/มม. · หน้าจอที่แคบกว่าบัตรจะปรับเทียบไม่ได้</p>
      </Card>

      <Card title="ติดตั้งและใช้งานออฟไลน์" id="install">
        {installed ? (
          <Notice tone="safe">ติดตั้ง EyeReady เป็นแอปแล้ว</Notice>
        ) : canInstall ? (
          <button type="button" className="btn-primary" onClick={install}>
            ติดตั้ง EyeReady บนอุปกรณ์นี้
          </button>
        ) : (
          <p className="text-sm text-ink-muted">
            เบราว์เซอร์นี้ไม่แสดงปุ่มติดตั้งอัตโนมัติ — ใช้เมนูของเบราว์เซอร์ เช่น "Add to Home Screen" (Safari) หรือ "Install app" (Chrome/Edge)
          </p>
        )}
        <p className="hint mt-2">หลังเปิดครั้งแรก แอปจะเก็บไฟล์ทั้งหมดไว้ในเครื่องและใช้งานได้โดยไม่ต้องต่ออินเทอร์เน็ต</p>
      </Card>

      <Card title="จัดการข้อมูล" id="data">
        <p className="mb-3 text-sm text-ink-muted">ข้อมูลเก็บใน IndexedDB ของเบราว์เซอร์นี้เท่านั้น ไม่มีการอัปโหลด</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-danger" onClick={() => clear('demo')}>
            ล้างสิ่งที่เพิ่มในโหมดสาธิต
          </button>
          <button type="button" className="btn-danger" onClick={() => clear('personal')}>
            ลบข้อมูลของฉันทั้งหมด
          </button>
        </div>
      </Card>
    </div>
  );
}
