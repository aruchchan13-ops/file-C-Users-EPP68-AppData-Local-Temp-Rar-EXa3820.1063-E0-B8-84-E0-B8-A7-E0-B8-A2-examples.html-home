import { useRef, useState } from 'react';
import { useMission } from '../../hooks/useMission';
import { useUi } from '../../hooks/useUi';
import { useSurgeonSummary, SYMPTOM_LABEL } from '../../hooks/useSurgeonSummary';
import { MEASUREMENT_META } from '../../services/measurementService';
import { CM_META } from '../../services/countermeasureService';
import { exportPagesToPdf } from '../../services/pdfService';
import { AlertCard } from '../../components/alerts/AlertCard';
import { ChartFigure } from '../../components/charts/ChartFigure';
import { VisionTrendChart } from '../../components/charts/Charts';
import { Card, MedicalDisclaimer, PageHeader, ProgressBar, SimulatedTag, Stat } from '../../components/ui';
import { Icon } from '../../components/layout/Icon';
import { SurgeonReport } from './SurgeonReport';
import { pct } from '../../utils/format';

export function FlightSurgeonPage() {
  const { day, dayLabel, dateOf, isDemo, maxDay } = useMission();
  const { toast } = useUi();
  const s = useSurgeonSummary();
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const exportPdf = async () => {
    setExporting(true);
    // wait one frame for the offscreen report to mount
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      const pages = Array.from(reportRef.current?.querySelectorAll<HTMLElement>('[data-pdf-page]') ?? []);
      if (!pages.length) throw new Error('no pages');
      await exportPagesToPdf(pages, `EyeReady-summary-day${day}${isDemo ? '-demo' : ''}.pdf`);
      toast('สร้างไฟล์ PDF แล้ว');
    } catch (e) {
      console.warn(e);
      toast('สร้าง PDF ไม่สำเร็จ กรุณาลองอีกครั้ง', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="สรุปสำหรับแพทย์ประจำเที่ยวบิน"
        en="Flight Surgeon Summary"
        description={`ข้อมูลสรุป ณ ${dayLabel(day)} · ส่งออกได้เฉพาะข้อมูลสรุป ไม่มีบันทึกดิบหรือข้อมูลส่วนตัว`}
        actions={
          <button type="button" className="btn-primary" onClick={exportPdf} disabled={exporting} aria-busy={exporting}>
            <Icon name="download" size={18} /> {exporting ? 'กำลังสร้าง PDF…' : 'ส่งออก PDF'}
          </button>
        }
      />
      {isDemo && (
        <p className="mb-4 flex items-center gap-2 text-sm text-ink-muted">
          <SimulatedTag /> รายงานนี้สร้างจากภารกิจสาธิต ไม่ใช่การวัดจริงของนักบินอวกาศ
        </p>
      )}

      <div className="space-y-5">
        <AlertCard showLinks={false} />

        <section className="card overflow-hidden" aria-labelledby="cmp-title">
          <h2 id="cmp-title" className="px-4 pt-4 text-lg font-semibold text-ink sm:px-5">
            Baseline ส่วนตัวและผลการวัดล่าสุด
          </h2>
          <p className="px-4 pb-3 text-sm text-ink-muted sm:px-5">ผลดิบและคะแนนที่ปรับเทียบ baseline แยกกัน · คะแนน 100% = เท่ากับ baseline สูงกว่า = ดีกว่า</p>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="ตาราง (เลื่อนดูด้านข้างได้)">
            <table className="num w-full min-w-[720px] text-left text-sm">
              <caption className="sr-only">ตารางเปรียบเทียบผลการวัดกับ baseline</caption>
              <thead className="bg-alt text-ink">
                <tr>
                  {['การวัด', 'Baseline (raw)', 'ผลล่าสุด (raw)', 'คะแนนล่าสุด', 'เฉลี่ย 7 วัน', 'เฉลี่ย 30 วัน', '30 วันก่อนหน้า'].map((h) => (
                    <th key={h} scope="col" className="px-4 py-2 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.tests.map((t) => (
                  <tr key={t.type} className="border-t border-line">
                    <th scope="row" className="px-4 py-2 font-semibold text-ink">
                      {MEASUREMENT_META[t.type].label}
                    </th>
                    <td className="px-4 py-2">
                      {t.baseline.value === null ? `กำลังสร้าง (${t.baseline.daysAvailable}/3)` : MEASUREMENT_META[t.type].format(t.baseline.value)}
                      {t.baseline.value !== null && <span className="block text-xs text-ink-muted">วันที่ {t.baseline.days.join(', ')}</span>}
                    </td>
                    <td className="px-4 py-2">
                      {t.latestRaw === null ? '—' : MEASUREMENT_META[t.type].format(t.latestRaw)}
                      {t.latestDay !== null && <span className="block text-xs text-ink-muted">{dayLabel(t.latestDay)}</span>}
                    </td>
                    <td className="px-4 py-2 font-semibold">{pct(t.latestScore)}</td>
                    <td className="px-4 py-2">{pct(t.mean7)}</td>
                    <td className="px-4 py-2">{pct(t.mean30)}</td>
                    <td className="px-4 py-2">{pct(t.prior30)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <ChartFigure
          title="แนวโน้มการมองเห็น 30 วัน"
          summary={`${dayLabel(s.from30)} ถึง ${dayLabel(day)}: ค่าเฉลี่ย 7 วันล่าสุด ${pct(s.series30[s.series30.length - 1]?.avg7 ?? null)} ของ baseline`}
          table={{ headers: ['วัน', 'รายวัน', 'เฉลี่ย 7 วัน'], rows: s.series30.map((d) => [d.day, pct(d.composite), pct(d.avg7)]) }}
        >
          <VisionTrendChart series={s.series30} fromDay={s.from30} maxDay={Math.min(maxDay, Math.max(day, s.from30 + 1))} dateOf={dateOf} examDays={s.exam.schedule} height={260} />
        </ChartFigure>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="ประวัติอาการ (30 วัน)" id="sym">
            <div className="mb-3 grid grid-cols-3 gap-3">
              <Stat label="ครั้งทั้งหมด" value={s.symptoms.total30} />
              <Stat label="วันที่มีอาการ ใน 7 วัน" value={s.symptoms.symptomDays7} sub="≥2 ครั้ง/วัน" />
              <Stat label="วันที่มีอาการ ใน 30 วัน" value={s.symptoms.symptomDays30} />
            </div>
            <table className="num w-full text-left text-sm">
              <thead className="bg-alt">
                <tr>
                  <th scope="col" className="px-3 py-2">อาการ</th>
                  <th scope="col" className="px-3 py-2">ครั้ง</th>
                  <th scope="col" className="px-3 py-2">รุนแรงสุด</th>
                </tr>
              </thead>
              <tbody>
                {s.symptoms.byCategory.map((c) => (
                  <tr key={c.category} className="border-t border-line">
                    <td className="px-3 py-1.5">{SYMPTOM_LABEL[c.category]}</td>
                    <td className="px-3 py-1.5">{c.count}</td>
                    <td className="px-3 py-1.5">{c.maxSeverity ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title="การทำตามมาตรการป้องกัน" id="cm">
            <table className="num w-full text-left text-sm">
              <thead className="bg-alt">
                <tr>
                  <th scope="col" className="px-3 py-2">มาตรการ</th>
                  <th scope="col" className="px-3 py-2">7 วัน</th>
                  <th scope="col" className="px-3 py-2">30 วัน</th>
                </tr>
              </thead>
              <tbody>
                {s.adh30.perKey.map((a, i) => (
                  <tr key={a.key} className="border-t border-line">
                    <td className="px-3 py-1.5">{CM_META[a.key].en}</td>
                    <td className="px-3 py-1.5">{s.adh7.perKey[i].pct === null ? '—' : `${s.adh7.perKey[i].pct}%`}</td>
                    <td className="px-3 py-1.5">{a.pct === null ? '—' : `${a.pct}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="hint mt-2">% ของวันที่บันทึกที่ทำได้ตามเป้า วันที่ไม่ได้บันทึกไม่นับ</p>
          </Card>

          <Card title="บริบทการตรวจตา" id="exam">
            <p className="text-ink">
              {s.exam.nextExam === null
                ? 'ไม่มีนัดตรวจถัดไปในตาราง'
                : s.exam.daysToNext === 0
                  ? `มีนัดตรวจตาวันนี้ (วันที่ ${s.exam.nextExam})`
                  : `นัดตรวจตาครั้งถัดไป: ${dayLabel(s.exam.nextExam)} — อีก ${s.exam.daysToNext} วัน`}
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              กำหนดการ{isDemo ? ' (จำลอง)' : ' (ค่าเริ่มต้น)'}: วันที่ {s.exam.schedule.join(', ')} · การตรวจตาบนสถานี (เช่น OCT, ตรวจจอประสาทตา) ทำโดยทีมแพทย์ EyeReady ช่วยเตรียมข้อมูลแนวโน้มก่อนการตรวจ
            </p>
            {s.exam.lastExam !== null && <p className="mt-1 text-sm text-ink-muted">ตรวจครั้งล่าสุด: {dayLabel(s.exam.lastExam)}</p>}
          </Card>

          <Card title="การฝึกและคะแนนสถานการณ์" id="train">
            <div className="mb-3 grid grid-cols-2 gap-3">
              <Stat label="ฝึกสถานการณ์ครบ" value={`${s.training.completionRate}%`} sub={`${s.training.completed}/6`} />
              <Stat label="คะแนนเฉลี่ย" value={s.training.averageScore === null ? '—' : s.training.averageScore.toFixed(0)} sub={`บทเรียน ${s.lessonsDone}/${s.lessonsTotal}`} />
            </div>
            <ProgressBar value={s.training.completionRate} label="อัตราการฝึกครบ" />
            <ul className="mt-3 space-y-1 text-sm">
              {s.training.perScenario.map((p) => (
                <li key={p.scenario.id} className="flex justify-between gap-2">
                  <span>{p.scenario.title}</span>
                  <span className="num shrink-0 text-ink-muted">{p.best === null ? 'ยังไม่ฝึก' : `${p.best}`}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <MedicalDisclaimer />
      </div>

      {exporting && <SurgeonReport ref={reportRef} />}
    </div>
  );
}
