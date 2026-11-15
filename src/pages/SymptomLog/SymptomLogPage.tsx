import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { SYMPTOM_CATEGORIES, type Symptom, type SymptomCategory } from '../../types';
import { useMission } from '../../hooks/useMission';
import { useUi } from '../../hooks/useUi';
import { SYMPTOM_LABEL } from '../../hooks/useSurgeonSummary';
import { db, safeWrite } from '../../services/database';
import { isSymptomDay, occurrencesByDay, RELEVANT_SYMPTOMS } from '../../services/alertService';
import { Card, EmptyState, Notice, PageHeader, SourceBadge } from '../../components/ui';
import { dateForMissionDay, dateTime } from '../../utils/format';

interface Draft {
  id?: number;
  category: SymptomCategory;
  severity: number;
  day: number;
  time: string;
  durationMin: string;
  notes: string;
}

const emptyDraft = (day: number): Draft => ({
  category: 'blurred',
  severity: 3,
  day,
  time: new Date().toTimeString().slice(0, 5),
  durationMin: '',
  notes: '',
});

export function SymptomLogPage() {
  const { dataset, day, maxDay, symptoms, startISO, dayLabel, isDemo } = useMission();
  const { toast } = useUi();
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(day));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [range, setRange] = useState<7 | 30 | 0>(7);
  const editing = draft.id !== undefined;
  // Follow the global mission day while composing a new entry.
  useEffect(() => {
    setDraft((d) => (d.id === undefined ? { ...d, day } : d));
  }, [day]);

  const validate = (d: Draft) => {
    const e: Record<string, string> = {};
    if (!Number.isInteger(d.day) || d.day < 1 || d.day > maxDay) e.day = `ระบุวันภารกิจ 1–${maxDay}`;
    if (d.day > day) e.day = `บันทึกได้ถึงวันภารกิจที่เลือก (วันที่ ${day})`;
    if (!/^\d{2}:\d{2}$/.test(d.time)) e.time = 'ระบุเวลาเป็น ชช:นน';
    if (d.durationMin !== '' && (!/^\d+$/.test(d.durationMin) || Number(d.durationMin) > 1440)) e.durationMin = 'ระยะเวลาเป็นนาที 0–1440';
    if (d.notes.length > 500) e.notes = 'หมายเหตุไม่เกิน 500 ตัวอักษร';
    return e;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const e = validate(draft);
    setErrors(e);
    if (Object.keys(e).length) return;
    const [hh, mm] = draft.time.split(':').map(Number);
    const ts = dateForMissionDay(startISO, draft.day).getTime() + (hh * 60 + mm) * 60_000;
    const rec: Symptom = {
      dataset,
      source: 'user',
      day: draft.day,
      timestamp: ts,
      category: draft.category,
      severity: draft.severity,
      durationMin: draft.durationMin === '' ? null : Number(draft.durationMin),
      notes: draft.notes.trim(),
    };
    const res = await safeWrite(() => (editing ? db.symptoms.update(draft.id!, rec) : db.symptoms.add(rec)));
    if (res.ok) {
      toast(editing ? 'แก้ไขบันทึกอาการแล้ว' : 'บันทึกอาการแล้ว');
      setDraft(emptyDraft(day));
    } else toast(res.error, 'error');
  };

  const remove = async (s: Symptom) => {
    if (s.id === undefined) return;
    if (!window.confirm(`ลบบันทึก "${SYMPTOM_LABEL[s.category]}" (${dateTime(s.timestamp)})?`)) return;
    const res = await safeWrite(() => db.symptoms.delete(s.id!));
    if (res.ok) {
      toast('ลบบันทึกแล้ว');
      if (draft.id === s.id) setDraft(emptyDraft(day));
    } else toast(res.error, 'error');
  };

  const edit = (s: Symptom) => {
    const d = new Date(s.timestamp);
    setDraft({
      id: s.id,
      category: s.category,
      severity: s.severity,
      day: s.day,
      time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      durationMin: s.durationMin === null ? '' : String(s.durationMin),
      notes: s.notes,
    });
    setErrors({});
    document.getElementById('symptom-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => document.getElementById('sym-category-' + s.category)?.focus(), 300);
  };

  const listed = useMemo(() => symptoms.filter((s) => range === 0 || s.day > day - range), [symptoms, range, day]);
  const occ = useMemo(() => occurrencesByDay(symptoms), [symptoms]);
  const week = Array.from({ length: 7 }, (_, i) => day - 6 + i).filter((d) => d >= 1);

  const byDay = new Map<number, Symptom[]>();
  for (const s of listed) byDay.set(s.day, [...(byDay.get(s.day) ?? []), s]);

  return (
    <div>
      <PageHeader title="บันทึกอาการ" en="Symptom Log" description="บันทึกอาการที่เกี่ยวกับการมองเห็น ความรุนแรง 0–10 ระยะเวลา และหมายเหตุ ข้อมูลเก็บในเครื่องนี้เท่านั้น" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <Card title={editing ? 'แก้ไขบันทึกอาการ' : 'บันทึกอาการใหม่'} id="symptom-form">
          {isDemo && (
            <div className="mb-3">
              <Notice tone="caution">โหมดสาธิต: บันทึกนี้จะถูกเพิ่มในภารกิจสาธิตและทำเครื่องหมาย "บันทึกโดยผู้ใช้"</Notice>
            </div>
          )}
          <form onSubmit={submit} noValidate className="space-y-4">
            <fieldset>
              <legend className="label">ประเภทอาการ</legend>
              <div className="grid grid-cols-2 gap-2">
                {SYMPTOM_CATEGORIES.map((c) => (
                  <label key={c} className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${draft.category === c ? 'border-brand bg-alt font-semibold' : 'border-line'}`}>
                    <input id={`sym-category-${c}`} type="radio" name="category" value={c} checked={draft.category === c} onChange={() => setDraft({ ...draft, category: c })} className="h-4 w-4 accent-[rgb(var(--c-brand))]" />
                    {SYMPTOM_LABEL[c]}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="sev" className="label">
                ความรุนแรง: <span className="num">{draft.severity}/10</span> {draft.severity === 0 && '(ไม่มีอาการ — ไม่นับในการแจ้งเตือน)'}
              </label>
              <input id="sev" type="range" min={0} max={10} step={1} value={draft.severity} onChange={(e) => setDraft({ ...draft, severity: Number(e.target.value) })} className="w-full" aria-valuetext={`${draft.severity} จาก 10`} />
              <div className="num flex justify-between text-xs text-ink-muted" aria-hidden>
                <span>0 ไม่มี</span>
                <span>5 ปานกลาง</span>
                <span>10 รุนแรงมาก</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="sday" className="label">
                  วันภารกิจ
                </label>
                <input id="sday" type="number" inputMode="numeric" min={1} max={day} className="field num" value={draft.day} onChange={(e) => setDraft({ ...draft, day: Number(e.target.value) })} aria-invalid={!!errors.day} aria-describedby={errors.day ? 'sday-err' : undefined} />
                {errors.day && (
                  <p id="sday-err" className="mt-1 text-sm text-danger">
                    {errors.day}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="stime" className="label">
                  เวลา
                </label>
                <input id="stime" type="time" className="field num" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} aria-invalid={!!errors.time} />
                {errors.time && <p className="mt-1 text-sm text-danger">{errors.time}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="sdur" className="label">
                ระยะเวลา (นาที) <span className="font-normal text-ink-muted">ไม่บังคับ</span>
              </label>
              <input id="sdur" type="number" inputMode="numeric" min={0} max={1440} className="field num" value={draft.durationMin} onChange={(e) => setDraft({ ...draft, durationMin: e.target.value })} aria-invalid={!!errors.durationMin} aria-describedby={errors.durationMin ? 'sdur-err' : undefined} />
              {errors.durationMin && (
                <p id="sdur-err" className="mt-1 text-sm text-danger">
                  {errors.durationMin}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="snotes" className="label">
                หมายเหตุ <span className="font-normal text-ink-muted">ไม่บังคับ · ไม่ถูกส่งออกในรายงาน PDF</span>
              </label>
              <textarea id="snotes" rows={3} maxLength={500} className="field" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn-primary">
                {editing ? 'บันทึกการแก้ไข' : 'บันทึกอาการ'}
              </button>
              {editing && (
                <button type="button" className="btn-secondary" onClick={() => setDraft(emptyDraft(day))}>
                  ยกเลิกการแก้ไข
                </button>
              )}
            </div>
          </form>
        </Card>

        <div className="space-y-5">
          <Card title="ภาพรวม 7 วัน" id="week">
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="ตาราง (เลื่อนดูด้านข้างได้)">
              <table className="num w-full min-w-[480px] text-center text-sm">
                <caption className="sr-only">จำนวนครั้งของแต่ละอาการ 7 วันล่าสุด</caption>
                <thead>
                  <tr>
                    <th scope="col" className="px-2 py-1 text-left text-ink-muted">อาการ</th>
                    {week.map((d) => (
                      <th key={d} scope="col" className="px-2 py-1 font-semibold text-ink">
                        D{d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SYMPTOM_CATEGORIES.map((c) => (
                    <tr key={c} className="border-t border-line">
                      <th scope="row" className="px-2 py-1.5 text-left font-normal text-ink">
                        {SYMPTOM_LABEL[c]}
                        {!RELEVANT_SYMPTOMS.includes(c) && <span className="text-ink-muted"> *</span>}
                      </th>
                      {week.map((d) => {
                        const n = (occ.get(d) ?? []).filter((s) => s.category === c).length;
                        return (
                          <td key={d} className={`px-2 py-1.5 ${n ? 'font-bold text-ink' : 'text-ink-muted'}`}>
                            {n || '·'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="border-t-2 border-ink/30">
                    <th scope="row" className="px-2 py-1.5 text-left font-semibold">
                      วันที่มีอาการ (≥2)
                    </th>
                    {week.map((d) => (
                      <td key={d} className="px-2 py-1.5">
                        {isSymptomDay(occ, d) ? <span className="tag bg-caution-bg text-caution">▲ ใช่</span> : <span className="text-ink-muted">–</span>}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="hint mt-2">* อ่อนล้านับเป็น "วันที่มีอาการ" สำหรับเกณฑ์เหลือง แต่ไม่นับเป็น "อาการที่เกี่ยวข้อง" สำหรับเกณฑ์แดง</p>
          </Card>

          <Card
            title="ประวัติอาการ"
            id="history"
            actions={
              <div role="group" aria-label="ช่วงเวลา" className="flex gap-1">
                {([7, 30, 0] as const).map((r) => (
                  <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)} className={`min-h-[40px] rounded-lg px-3 text-sm ${range === r ? 'bg-brand text-white' : 'border border-line text-ink hover:bg-alt'}`}>
                    {r === 0 ? 'ทั้งหมด' : `${r} วัน`}
                  </button>
                ))}
              </div>
            }
          >
            {listed.length === 0 ? (
              <EmptyState title="ยังไม่มีบันทึกอาการในช่วงนี้">ถ้าไม่มีอาการ ไม่จำเป็นต้องบันทึก</EmptyState>
            ) : (
              <ol className="max-h-[36rem] space-y-4 overflow-y-auto pr-1" tabIndex={0} aria-label="รายการประวัติอาการ">
                {[...byDay.entries()].map(([d, list]) => (
                  <li key={d}>
                    <h3 className="num mb-1 text-sm font-semibold text-ink-muted">{dayLabel(d)}</h3>
                    <ul className="space-y-2">
                      {list.map((s, i) => (
                        <li key={s.id ?? `syn-${d}-${i}`} className="rounded-lg border border-line p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold text-ink">
                              {SYMPTOM_LABEL[s.category]} · <span className="num">ความรุนแรง {s.severity}/10</span>
                            </p>
                            <SourceBadge source={s.source} />
                          </div>
                          <p className="num text-sm text-ink-muted">
                            {dateTime(s.timestamp)}
                            {s.durationMin !== null && ` · ${s.durationMin} นาที`}
                          </p>
                          {s.notes && <p className="mt-1 text-sm text-ink">{s.notes}</p>}
                          {s.source === 'user' && (
                            <div className="mt-2 flex gap-2">
                              <button type="button" className="btn-ghost min-h-[40px] px-3 text-sm" onClick={() => edit(s)}>
                                แก้ไข
                              </button>
                              <button type="button" className="btn-danger min-h-[40px] px-3 text-sm" onClick={() => remove(s)}>
                                ลบ
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
