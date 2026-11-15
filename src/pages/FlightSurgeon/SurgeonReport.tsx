import { forwardRef } from 'react';
import { useMission } from '../../hooks/useMission';
import { useSurgeonSummary, SYMPTOM_LABEL } from '../../hooks/useSurgeonSummary';
import { ALERT_META } from '../../services/alertService';
import { MEASUREMENT_META } from '../../services/measurementService';
import { CM_META } from '../../services/countermeasureService';
import { TrendSvg } from '../../components/charts/TrendSvg';
import { AlertShape } from '../../components/ui';
import { longDate, pct } from '../../utils/format';

const PAGE: React.CSSProperties = { width: 794, height: 1123, padding: '44px 48px', boxSizing: 'border-box', background: '#fff', color: '#0E1B33', fontFamily: '"IBM Plex Sans Thai", sans-serif', fontSize: 13, lineHeight: 1.55, position: 'relative' };
const H2: React.CSSProperties = { fontSize: 16, fontWeight: 700, margin: '18px 0 6px', color: '#13294B' };
const TH: React.CSSProperties = { textAlign: 'left', padding: '5px 6px', background: '#F2F4F8', fontWeight: 600, borderBottom: '1px solid #D6DCE7' };
const TD: React.CSSProperties = { padding: '6px 6px 9px', lineHeight: 1.6, borderBottom: '1px solid #E6EAF1', verticalAlign: 'top' };

/** Two fixed A4 pages of summary-only content, rasterised by pdfService. */
export const SurgeonReport = forwardRef<HTMLDivElement>(function SurgeonReport(_, ref) {
  const { current, currentReasons, dayLabel, isDemo, dateOf } = useMission();
  const s = useSurgeonSummary();
  const meta = ALERT_META[current.level];
  const levelColor = { green: '#1A6340', yellow: '#7A4F00', red: '#B3261E' }[current.level];
  const generated = new Date();

  const header = (page: number) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, borderBottom: '3px solid #13294B', paddingBottom: 10, marginBottom: 12, lineHeight: 1.6 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#13294B' }}>EyeReady · สรุปสำหรับแพทย์ประจำเที่ยวบิน</div>
        <div style={{ color: '#44506A' }}>Flight Surgeon Summary · หน้า {page}/2</div>
      </div>
      <div style={{ textAlign: 'right', color: '#44506A' }}>
        <div>
          <strong style={{ color: '#0E1B33' }}>วันภารกิจ {s.day}</strong> ({longDate(dateOf(s.day))})
        </div>
        <div>สร้างรายงาน: {generated.toLocaleString('th-TH')}</div>
        {isDemo && <div style={{ color: '#7A4F00', fontWeight: 700, background: '#FFF3D6', padding: '2px 8px', display: 'inline-block', borderRadius: 4, marginTop: 6, lineHeight: 1.4 }}>ข้อมูลจำลอง — ไม่ใช่ข้อมูลจริง</div>}
      </div>
    </div>
  );

  const disclaimer = (
    <div style={{ position: 'absolute', left: 48, right: 48, bottom: 36, fontSize: 11, color: '#44506A', borderTop: '1px solid #D6DCE7', paddingTop: 6 }}>
      ข้อจำกัดสำคัญ: EyeReady ไม่ได้ป้องกัน วินิจฉัย หรือรักษา SANS เป็นเครื่องมือเฝ้าระวังด้วยตนเองและเตรียมความพร้อม การแจ้งเตือนบอกแนวโน้มที่ควรใส่ใจ ไม่ใช่การวินิจฉัย
      ค่าเกณฑ์เป็นค่าเริ่มต้นที่ต้องปรับร่วมกับแพทย์ แบบทดสอบบนหน้าจอไม่ใช่การตรวจทางคลินิก รายงานนี้มีเฉพาะข้อมูลสรุป ไม่มีบันทึกดิบหรือข้อมูลส่วนตัว และสร้างในอุปกรณ์โดยไม่ส่งออนไลน์
    </div>
  );

  return (
    <div ref={ref} aria-hidden style={{ position: 'fixed', left: -10000, top: 0 }}>
      <div data-pdf-page style={PAGE}>
        {header(1)}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', border: `2px solid ${levelColor}`, borderRadius: 10, padding: '10px 12px' }}>
          <AlertShape level={current.level} size={30} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: levelColor }}>
              สถานะเตือน: {meta.en} — {meta.label}
            </div>
            {currentReasons.map((r) => (
              <div key={r}>• {r}</div>
            ))}
            <div style={{ marginTop: 4 }}>
              <strong>แนะนำ:</strong> {meta.action}
            </div>
          </div>
        </div>

        <div style={H2}>ผลการวัดเทียบ baseline ส่วนตัว</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['การวัด', 'Baseline (วันที่ใช้)', 'ผลล่าสุด', 'คะแนนล่าสุด', 'เฉลี่ย 7 วัน', 'เฉลี่ย 30 วัน', '30 วันก่อนหน้า'].map((h) => (
                <th key={h} style={TH}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.tests.map((t) => (
              <tr key={t.type}>
                <td style={TD}>{MEASUREMENT_META[t.type].label}</td>
                <td style={TD}>{t.baseline.value === null ? `กำลังสร้าง (${t.baseline.daysAvailable}/3)` : `${MEASUREMENT_META[t.type].format(t.baseline.value)} (D${t.baseline.days.join(', D')})`}</td>
                <td style={TD}>{t.latestRaw === null ? '—' : `${MEASUREMENT_META[t.type].format(t.latestRaw)} (D${t.latestDay})`}</td>
                <td style={TD}>{pct(t.latestScore)}</td>
                <td style={TD}>{pct(t.mean7)}</td>
                <td style={TD}>{pct(t.mean30)}</td>
                <td style={TD}>{pct(t.prior30)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 11, color: '#44506A', marginTop: 4 }}>คะแนน = % ของ baseline ส่วนตัว (ค่าเฉลี่ย 3 วันแรกที่วัดได้) · สูงกว่า = ดีกว่า · วันที่ไม่มีการวัดไม่ถูกนับเป็นศูนย์</div>

        <div style={H2}>แนวโน้ม 30 วัน ({dayLabel(s.from30)} – {dayLabel(s.day)})</div>
        <TrendSvg series={s.series30} from={s.from30} to={s.day} />
        <div style={{ fontSize: 11, color: '#44506A' }}>เส้นเข้ม = ค่าเฉลี่ย 7 วัน · เส้นจาง = รายวัน · เส้นประน้ำตาล = เกณฑ์เหลือง 90% · เส้นประแดง = เกณฑ์แดง 80%</div>
        {disclaimer}
      </div>

      <div data-pdf-page style={PAGE}>
        {header(2)}
        <div style={H2}>สรุปอาการ (30 วันล่าสุด)</div>
        <div>
          รวม {s.symptoms.total30} ครั้ง · มีอาการ {s.symptoms.anyDays30} วัน · "วันที่มีอาการ" (≥2 ครั้ง/วัน): {s.symptoms.symptomDays7} วันใน 7 วัน, {s.symptoms.symptomDays30} วันใน 30 วัน
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
          <thead>
            <tr>
              <th style={TH}>อาการ</th>
              <th style={TH}>จำนวนครั้ง</th>
              <th style={TH}>ความรุนแรงสูงสุด (0–10)</th>
            </tr>
          </thead>
          <tbody>
            {s.symptoms.byCategory.map((c) => (
              <tr key={c.category}>
                <td style={TD}>{SYMPTOM_LABEL[c.category]}</td>
                <td style={TD}>{c.count}</td>
                <td style={TD}>{c.maxSeverity ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={H2}>การทำตามมาตรการป้องกัน (countermeasures)</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH}>มาตรการ</th>
              <th style={TH}>เป้าหมาย/วัน</th>
              <th style={TH}>7 วัน</th>
              <th style={TH}>30 วัน</th>
            </tr>
          </thead>
          <tbody>
            {s.adh30.perKey.map((a, i) => {
              const a7 = s.adh7.perKey[i];
              const m = CM_META[a.key];
              return (
                <tr key={a.key}>
                  <td style={TD}>{m.en}</td>
                  <td style={TD}>{m.target === null ? 'ใช่' : `≥ ${m.target} ${m.unit}`}</td>
                  <td style={TD}>{a7.pct === null ? '—' : `${a7.pct}% (${a7.met}/${a7.recorded} วัน)`}</td>
                  <td style={TD}>{a.pct === null ? '—' : `${a.pct}% (${a.met}/${a.recorded} วัน)`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={H2}>บริบทการตรวจตา</div>
        <div>
          กำหนดการตรวจตา{isDemo ? ' (จำลอง)' : ''}: วันที่ {s.exam.schedule.join(', ')} ·{' '}
          {s.exam.nextExam === null ? 'ไม่มีนัดตรวจถัดไปในตาราง' : s.exam.daysToNext === 0 ? `มีนัดตรวจวันนี้ (วันที่ ${s.exam.nextExam})` : `นัดถัดไป วันที่ ${s.exam.nextExam} (อีก ${s.exam.daysToNext} วัน)`}
          {s.exam.lastExam !== null && ` · ตรวจครั้งล่าสุด วันที่ ${s.exam.lastExam}`}
        </div>

        <div style={H2}>การฝึก</div>
        <div>
          สถานการณ์ฝึกครบ {s.training.completed}/6 ({s.training.completionRate}%) · คะแนนเฉลี่ย {s.training.averageScore === null ? '—' : s.training.averageScore.toFixed(0)} · บทเรียน {s.lessonsDone}/{s.lessonsTotal}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
          <tbody>
            {s.training.perScenario.map((p) => (
              <tr key={p.scenario.id}>
                <td style={TD}>{p.scenario.title}</td>
                <td style={TD}>{p.best === null ? 'ยังไม่ฝึก' : `ดีที่สุด ${p.best}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {disclaimer}
      </div>
    </div>
  );
});
