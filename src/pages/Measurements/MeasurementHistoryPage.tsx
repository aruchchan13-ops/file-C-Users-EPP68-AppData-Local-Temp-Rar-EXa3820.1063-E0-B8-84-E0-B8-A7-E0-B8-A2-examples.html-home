import { useMemo, useState } from 'react';
import { MEASUREMENT_TYPES, type Measurement, type MeasurementType } from '../../types';
import { useMission } from '../../hooks/useMission';
import { useUi } from '../../hooks/useUi';
import { MEASUREMENT_META, deleteMeasurement } from '../../services/measurementService';
import { normalise, SCORE_MAX, AMSLER_POINTS_PER_CELL } from '../../services/scoringService';
import { Card, EmptyState, PageHeader, SourceBadge } from '../../components/ui';
import { dateTime, pct } from '../../utils/format';

const PAGE = 40;

export function MeasurementHistoryPage() {
  const { measurements, baselines, dayLabel } = useMission();
  const { toast } = useUi();
  const [filter, setFilter] = useState<MeasurementType | 'all'>('all');
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(
    () => measurements.filter((m) => filter === 'all' || m.type === filter).sort((a, b) => b.day - a.day || b.timestamp - a.timestamp),
    [measurements, filter],
  );

  const remove = async (m: Measurement) => {
    if (m.id === undefined || !window.confirm(`ลบผล${MEASUREMENT_META[m.type].label} ของ${dayLabel(m.day)}?`)) return;
    const res = await deleteMeasurement(m.id);
    if (res.ok) toast('ลบผลการวัดแล้ว');
    else toast(res.error, 'error');
  };

  return (
    <div>
      <PageHeader title="ประวัติการวัด" en="Measurement history" description="ผลดิบ (raw) และคะแนนเทียบ baseline แสดงแยกกัน ข้อมูลถึงวันภารกิจที่เลือก" />

      <div className="mb-5 grid gap-4 md:grid-cols-2">
        <Card title="Baseline ส่วนตัว" id="baseline">
          <p className="mb-2 text-sm text-ink-muted">ค่าเฉลี่ยของ 3 วันแรกที่มีผลการวัดที่ใช้ได้ของแต่ละแบบทดสอบ</p>
          <ul className="space-y-1 text-sm">
            {MEASUREMENT_TYPES.map((t) => (
              <li key={t} className="num flex flex-wrap justify-between gap-2">
                <span className="text-ink">{MEASUREMENT_META[t].label}</span>
                <span className="text-ink-muted">
                  {baselines[t].value === null ? `กำลังสร้าง (${baselines[t].daysAvailable}/3 วัน)` : `${MEASUREMENT_META[t].format(baselines[t].value)} · วันที่ ${baselines[t].days.join(', ')}`}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="วิธีคิดคะแนน" id="scoring">
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>คะแนน = % ของ baseline ส่วนตัว ยิ่งสูงยิ่งดีเสมอ (100% = เท่ากับ baseline)</li>
            <li>สายตาใกล้: แปลง logMAR เป็น decimal acuity แล้วเทียบอัตราส่วน (10^−(raw−baseline))</li>
            <li>คอนทราสต์และสลับโฟกัส: ค่าต่ำดีกว่า จึงใช้อัตราส่วนกลับ baseline ÷ raw</li>
            <li>Amsler: baseline มักเป็น 0 จึงหัก {AMSLER_POINTS_PER_CELL} คะแนนต่อช่องที่เพิ่มจาก baseline</li>
            <li>จำกัดคะแนนที่ 0–{SCORE_MAX}% · วันที่ไม่มีการวัดเป็น "ไม่มีข้อมูล" ไม่ใช่ 0</li>
          </ul>
        </Card>
      </div>

      <Card
        title={`ผลการวัด (${rows.length} รายการ)`}
        id="list"
        actions={
          <label className="flex items-center gap-2 text-sm">
            <span className="text-ink-muted">แสดง</span>
            <select className="field min-h-[40px] w-auto py-1" value={filter} onChange={(e) => setFilter(e.target.value as MeasurementType | 'all')}>
              <option value="all">ทุกแบบทดสอบ</option>
              {MEASUREMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {MEASUREMENT_META[t].label}
                </option>
              ))}
            </select>
          </label>
        }
      >
        {rows.length === 0 ? (
          <EmptyState title="ยังไม่มีผลการวัด">เริ่มจากหน้า "การฝึกและการวัด" หรือแผนฝึกประจำวัน</EmptyState>
        ) : (
          <>
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="ตาราง (เลื่อนดูด้านข้างได้)">
              <table className="num w-full min-w-[640px] text-left text-sm">
                <thead className="bg-alt">
                  <tr>
                    <th scope="col" className="px-3 py-2">วันภารกิจ</th>
                    <th scope="col" className="px-3 py-2">แบบทดสอบ</th>
                    <th scope="col" className="px-3 py-2">ผลดิบ (raw)</th>
                    <th scope="col" className="px-3 py-2">คะแนนเทียบ baseline</th>
                    <th scope="col" className="px-3 py-2">ที่มา</th>
                    <th scope="col" className="px-3 py-2">
                      <span className="sr-only">การจัดการ</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, limit).map((m, i) => {
                    const b = baselines[m.type].value;
                    return (
                      <tr key={m.id ?? `s${m.day}-${m.type}-${i}`} className="border-t border-line">
                        <td className="px-3 py-2">
                          {dayLabel(m.day)}
                          {m.source === 'user' && <span className="block text-xs text-ink-muted">{dateTime(m.timestamp)}</span>}
                        </td>
                        <td className="px-3 py-2">{MEASUREMENT_META[m.type].label}</td>
                        <td className="px-3 py-2">{MEASUREMENT_META[m.type].format(m.raw)}</td>
                        <td className="px-3 py-2 font-semibold">{b === null ? '—' : pct(normalise(m.type, m.raw, b))}</td>
                        <td className="px-3 py-2">
                          <SourceBadge source={m.source} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          {m.source === 'user' && (
                            <button type="button" className="btn-danger min-h-[40px] px-3 text-sm" onClick={() => remove(m)}>
                              ลบ
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {rows.length > limit && (
              <button type="button" className="btn-secondary mt-4" onClick={() => setLimit((l) => l + PAGE)}>
                แสดงเพิ่ม ({rows.length - limit} รายการ)
              </button>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
