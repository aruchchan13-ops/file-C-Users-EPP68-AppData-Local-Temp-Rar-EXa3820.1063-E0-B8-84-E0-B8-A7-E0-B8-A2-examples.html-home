import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { CountermeasureRecord } from '../../types';
import { useMission } from '../../hooks/useMission';
import { useUi } from '../../hooks/useUi';
import { CM_KEYS, CM_META, MIN_GROUP_DAYS, adherence, countermeasureInsights, deleteCountermeasure, isAdherent, upsertCountermeasure } from '../../services/countermeasureService';
import { Card, EmptyState, Notice, PageHeader, SourceBadge, Stat } from '../../components/ui';
import { Icon } from '../../components/layout/Icon';
import { pct } from '../../utils/format';

interface Draft {
  lbnpMin: string;
  cuffsMin: string;
  exerciseMin: string;
  nutrition: '' | 'yes' | 'no';
}

const toDraft = (r?: CountermeasureRecord): Draft => ({
  lbnpMin: r?.lbnpMin == null ? '' : String(r.lbnpMin),
  cuffsMin: r?.cuffsMin == null ? '' : String(r.cuffsMin),
  exerciseMin: r?.exerciseMin == null ? '' : String(r.exerciseMin),
  nutrition: r?.nutrition == null ? '' : r.nutrition ? 'yes' : 'no',
});

const INSIGHT_NOTE = 'These comparisons describe associations within the user’s own data. They do not establish causation. Demo data are synthetic.';

export function CountermeasuresPage() {
  const { dataset, day, countermeasures, series, dayLabel, isDemo } = useMission();
  const { toast } = useUi();
  const [editDay, setEditDay] = useState(day);
  const existing = countermeasures.find((c) => c.day === editDay);
  const [draft, setDraft] = useState<Draft>(toDraft(existing));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => setEditDay(day), [day]);
  useEffect(() => {
    setDraft(toDraft(countermeasures.find((c) => c.day === editDay)));
    setErrors({});
  }, [editDay, countermeasures]);

  const parseMin = (v: string, key: string, e: Record<string, string>) => {
    if (v === '') return null;
    if (!/^\d+$/.test(v) || Number(v) > 600) {
      e[key] = 'ระบุเป็นนาที 0–600';
      return null;
    }
    return Number(v);
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const e: Record<string, string> = {};
    const values = {
      lbnpMin: parseMin(draft.lbnpMin, 'lbnpMin', e),
      cuffsMin: parseMin(draft.cuffsMin, 'cuffsMin', e),
      exerciseMin: parseMin(draft.exerciseMin, 'exerciseMin', e),
      nutrition: draft.nutrition === '' ? null : draft.nutrition === 'yes',
    };
    if (Object.values(values).every((v) => v === null)) e.form = 'กรอกอย่างน้อย 1 รายการ';
    setErrors(e);
    if (Object.keys(e).length) return;
    const res = await upsertCountermeasure(dataset, editDay, values);
    if (res.ok) toast(`บันทึกมาตรการป้องกันของวันที่ ${editDay} แล้ว`);
    else toast(res.error, 'error');
  };

  const remove = async () => {
    if (!window.confirm(`ลบบันทึกมาตรการป้องกันที่คุณแก้ไขของวันที่ ${editDay}?`)) return;
    const res = await deleteCountermeasure(dataset, editDay);
    if (res.ok) toast('ลบบันทึกแล้ว');
    else toast(res.error, 'error');
  };

  const week = adherence(countermeasures, Math.max(1, day - 6), day);
  const insights = useMemo(() => countermeasureInsights(countermeasures, series, day), [countermeasures, series, day]);
  const last7 = Array.from({ length: 7 }, (_, i) => day - 6 + i).filter((d) => d >= 1);
  const byDay = new Map(countermeasures.map((c) => [c.day, c]));
  const months = Math.ceil(day / 30);

  const numField = (key: 'lbnpMin' | 'cuffsMin' | 'exerciseMin', cm: (typeof CM_KEYS)[number]) => (
    <div>
      <label htmlFor={key} className="label">
        {CM_META[cm].en}
        <span className="block text-xs font-normal text-ink-muted">
          {CM_META[cm].label} · เป้าหมาย ≥ {CM_META[cm].target} นาที/วัน
        </span>
      </label>
      <div className="flex items-center gap-2">
        <input id={key} type="number" inputMode="numeric" min={0} max={600} className="field num" value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `${key}-err` : undefined} />
        <span className="text-sm text-ink-muted">นาที</span>
      </div>
      {errors[key] && (
        <p id={`${key}-err`} className="mt-1 text-sm text-danger">
          {errors[key]}
        </p>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader title="มาตรการป้องกัน" en="Countermeasure Tracker" description="บันทึกการใช้มาตรการป้องกันประจำวัน ดูการทำตามเป้า และความสัมพันธ์กับคะแนนการมองเห็นในข้อมูลของคุณเอง" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,24rem)_1fr]">
        <Card title="บันทึกประจำวัน" id="cmform">
          <form onSubmit={submit} noValidate className="space-y-4">
            <div>
              <label htmlFor="cmday" className="label">
                วันภารกิจ
              </label>
              <input id="cmday" type="number" inputMode="numeric" min={1} max={day} className="field num" value={editDay} onChange={(e) => setEditDay(Math.min(day, Math.max(1, Number(e.target.value) || 1)))} />
              <p className="hint mt-1">
                {dayLabel(editDay)} {existing ? <SourceBadge source={existing.source} /> : '· ยังไม่มีบันทึก'}
              </p>
            </div>
            {numField('lbnpMin', 'lbnp')}
            {numField('cuffsMin', 'cuffs')}
            {numField('exerciseMin', 'exercise')}
            <fieldset>
              <legend className="label">
                {CM_META.nutrition.en}
                <span className="block text-xs font-normal text-ink-muted">{CM_META.nutrition.label} ตามแผน</span>
              </legend>
              <div className="flex gap-2">
                {(
                  [
                    ['yes', 'ใช่'],
                    ['no', 'ไม่'],
                    ['', 'ไม่ระบุ'],
                  ] as const
                ).map(([v, l]) => (
                  <label key={v} className={`btn flex-1 cursor-pointer ${draft.nutrition === v ? 'bg-brand text-white' : 'border border-line text-ink'}`}>
                    <input type="radio" name="nutrition" className="sr-only" checked={draft.nutrition === v} onChange={() => setDraft({ ...draft, nutrition: v })} />
                    {l}
                  </label>
                ))}
              </div>
            </fieldset>
            {errors.form && <p className="text-sm text-danger">{errors.form}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn-primary">
                {existing ? 'บันทึกการแก้ไข' : 'บันทึก'}
              </button>
              {existing?.source === 'user' && (
                <button type="button" className="btn-danger" onClick={remove}>
                  ลบ{isDemo ? ' (กลับไปใช้ข้อมูลจำลอง)' : ''}
                </button>
              )}
            </div>
            {isDemo && <p className="hint">โหมดสาธิต: การแก้ไขจะแทนข้อมูลจำลองของวันนั้น และทำเครื่องหมาย "บันทึกโดยผู้ใช้"</p>}
          </form>
        </Card>

        <div className="space-y-5">
          <Card title="ภาพรวม 7 วัน" id="week">
            <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {week.perKey.map((a) => (
                <Stat key={a.key} label={CM_META[a.key].en.split(' (')[0]} value={a.pct === null ? '—' : `${a.pct}%`} sub={`${a.met}/${a.recorded} วันที่บันทึก`} />
              ))}
            </div>
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="ตาราง (เลื่อนดูด้านข้างได้)">
              <table className="num w-full min-w-[520px] text-center text-sm">
                <caption className="sr-only">การทำตามเป้าแต่ละวัน</caption>
                <thead>
                  <tr>
                    <th scope="col" className="px-2 py-1 text-left text-ink-muted">มาตรการ</th>
                    {last7.map((d) => (
                      <th key={d} scope="col" className="px-2 py-1">
                        <button type="button" className={`rounded px-2 py-1 ${d === editDay ? 'bg-brand text-white' : 'text-link underline'}`} onClick={() => setEditDay(d)} aria-label={`แก้ไขวันที่ ${d}`}>
                          D{d}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CM_KEYS.map((k) => (
                    <tr key={k} className="border-t border-line">
                      <th scope="row" className="px-2 py-1.5 text-left font-normal">
                        {CM_META[k].en.split(' (')[0]}
                      </th>
                      {last7.map((d) => {
                        const a = isAdherent(byDay.get(d), k);
                        return (
                          <td key={d} className="px-2 py-1.5">
                            <span className="inline-flex justify-center">
                              {a === null ? <Icon name="minus" size={16} className="text-ink-muted" /> : a ? <Icon name="check" size={18} className="text-safe" /> : <Icon name="close" size={16} className="text-danger" />}
                            </span>
                            <span className="sr-only">{a === null ? 'ไม่ได้บันทึก' : a ? 'ตามเป้า' : 'ต่ำกว่าเป้า'}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="hint mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1"><Icon name="check" size={16} className="text-safe" /> ตามเป้า</span>
              <span className="inline-flex items-center gap-1"><Icon name="close" size={14} className="text-danger" /> ต่ำกว่าเป้า</span>
              <span className="inline-flex items-center gap-1"><Icon name="minus" size={14} /> ไม่ได้บันทึก (ไม่นับใน %)</span>
              <span>เป้าหมายเป็นค่าเริ่มต้นสำหรับสาธิต ให้ทีมแพทย์กำหนด</span>
            </p>
          </Card>

          <Card title="เปรียบเทียบคะแนนการมองเห็น: วันที่ทำ vs ไม่ได้ทำ" id="insights">
            <p className="mb-3 text-sm text-ink-muted">
              ค่าเฉลี่ยคะแนนรวม (% ของ baseline) ในวันที่ทำตามเป้า เทียบกับวันที่ไม่ได้ทำ แสดงเมื่อมีข้อมูลอย่างน้อย {MIN_GROUP_DAYS} วันในแต่ละกลุ่ม
            </p>
            <ul className="space-y-3">
              {insights.map((i) => (
                <li key={i.key} className="rounded-lg border border-line p-3">
                  <p className="font-semibold text-ink">{CM_META[i.key].en}</p>
                  {i.sufficient ? (
                    <>
                      <dl className="num mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                        <div>
                          <dt className="text-ink-muted">ทำตามเป้า</dt>
                          <dd className="font-semibold">{pct(i.withMean)}</dd>
                        </div>
                        <div>
                          <dt className="text-ink-muted">ไม่ได้ทำ</dt>
                          <dd className="font-semibold">{pct(i.withoutMean)}</dd>
                        </div>
                        <div>
                          <dt className="text-ink-muted">จำนวนวัน</dt>
                          <dd className="font-semibold">
                            {i.nWith} / {i.nWithout}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-ink-muted">ผลต่าง</dt>
                          <dd className="font-semibold">{i.diff === null ? '—' : `${i.diff > 0 ? '+' : ''}${i.diff.toFixed(1)} จุด`}</dd>
                        </div>
                      </dl>
                      <p className="mt-2 text-sm text-ink">
                        Associated with a {Math.abs(i.diff ?? 0).toFixed(1)}-point {(i.diff ?? 0) >= 0 ? 'higher' : 'lower'} average vision score on days the target was met (n = {i.nWith} vs {i.nWithout}).
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-ink-muted">
                      ข้อมูลยังไม่พอเปรียบเทียบ (ทำตามเป้า {i.nWith} วัน, ไม่ได้ทำ {i.nWithout} วัน — ต้องการอย่างน้อย {MIN_GROUP_DAYS} วันต่อกลุ่ม)
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <Notice tone="info" title="หมายเหตุ">
                <span lang="en">{INSIGHT_NOTE}</span>
                <span className="mt-1 block">
                  การเปรียบเทียบนี้อธิบายความสัมพันธ์ในข้อมูลของคุณเองเท่านั้น ไม่ได้พิสูจน์ว่ามาตรการเป็นสาเหตุ (เช่น ช่วงหลังของภารกิจอาจทั้งทำมาตรการน้อยลงและคะแนนลดลงจากเหตุอื่น)
                </span>
              </Notice>
            </div>
          </Card>

          <Card title="ประวัติรายเดือน" id="monthly">
            {countermeasures.length === 0 ? (
              <EmptyState title="ยังไม่มีบันทึกมาตรการป้องกัน" />
            ) : (
              <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="ตาราง (เลื่อนดูด้านข้างได้)">
                <table className="num w-full min-w-[520px] text-left text-sm">
                  <thead className="bg-alt">
                    <tr>
                      <th scope="col" className="px-3 py-2">ช่วง</th>
                      {CM_KEYS.map((k) => (
                        <th key={k} scope="col" className="px-3 py-2">
                          {CM_META[k].en.split(' (')[0]}
                        </th>
                      ))}
                      <th scope="col" className="px-3 py-2">วันที่บันทึก</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: months }, (_, m) => {
                      const from = m * 30 + 1;
                      const to = Math.min(day, from + 29);
                      const a = adherence(countermeasures, from, to);
                      return (
                        <tr key={m} className="border-t border-line">
                          <th scope="row" className="px-3 py-1.5 font-normal">
                            เดือนที่ {m + 1} (D{from}–{to})
                          </th>
                          {a.perKey.map((p) => (
                            <td key={p.key} className="px-3 py-1.5">
                              {p.pct === null ? '—' : `${p.pct}%`}
                            </td>
                          ))}
                          <td className="px-3 py-1.5">
                            {a.daysLogged}/{to - from + 1}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
