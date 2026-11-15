import { useMemo } from 'react';
import { MEASUREMENT_TYPES } from '../../types';
import { useMission } from '../../hooks/useMission';
import { categoryMean } from '../../services/scoringService';
import { isSymptomDay, occurrencesByDay } from '../../services/alertService';
import { adherence } from '../../services/countermeasureService';
import { MEASUREMENT_META } from '../../services/measurementService';
import { EXAM_DAYS } from '../../services/demoDataService';
import { ChartFigure } from '../../components/charts/ChartFigure';
import { CHART_COLORS, CategoryChart, VisionTrendChart, WeeklyBarChart } from '../../components/charts/Charts';
import { AlertStrip, AlertTransitionsList, ALERT_RULES_TEXT } from '../../components/alerts/AlertCard';
import { Card, PageHeader, SimulatedTag, ThresholdNotice } from '../../components/ui';
import { pct } from '../../utils/format';

export function MissionTrendPage() {
  const { series, timeline, day, maxDay, dateOf, dayLabel, symptoms, countermeasures, isDemo, baselines } = useMission();

  const weekly = useMemo(() => {
    const occ = occurrencesByDay(symptoms);
    const weeks = Math.ceil(day / 7);
    return Array.from({ length: weeks }, (_, i) => {
      const from = i * 7 + 1;
      const to = Math.min(day, from + 6);
      let occurrences = 0;
      let sdays = 0;
      for (let d = from; d <= to; d++) {
        occurrences += occ.get(d)?.length ?? 0;
        if (isSymptomDay(occ, d)) sdays++;
      }
      const adh = adherence(countermeasures, from, to);
      return { label: `ส.${i + 1}`, from, to, occurrences, sdays, adherence: adh.overall === null ? null : Math.round(adh.overall) };
    });
  }, [symptoms, countermeasures, day]);

  const last = series[series.length - 1];
  const early = Math.min(30, day);

  return (
    <div className="space-y-5">
      <PageHeader
        title="แนวโน้มภารกิจ"
        en="Mission Trend"
        description={`ข้อมูลวันที่ 1 ถึง ${dayLabel(day)} · กราฟอัปเดตตามวันภารกิจที่เลือกด้านบน`}
        actions={isDemo ? <SimulatedTag /> : undefined}
      />

      <ChartFigure
        title="คะแนนการมองเห็นเทียบ baseline ส่วนตัว"
        summary={
          <>
            คะแนนรวม = ค่าเฉลี่ยของการวัดที่มีในวันนั้น (% ของ baseline) · ล่าสุด: รายวัน {pct(last?.composite ?? null)}, เฉลี่ย 7 วัน {pct(last?.avg7 ?? null)} · เส้นแนวตั้ง = วันตรวจตาตามกำหนด
          </>
        }
        table={{ headers: ['วัน', 'รายวัน', 'เฉลี่ย 7 วัน', 'ระดับเตือน'], rows: series.map((d, i) => [d.day, pct(d.composite), pct(d.avg7), timeline[i]?.level.toUpperCase() ?? '']) }}
      >
        <VisionTrendChart series={series} maxDay={maxDay} dateOf={dateOf} examDays={EXAM_DAYS} />
      </ChartFigure>

      <Card title="ประวัติการแจ้งเตือน" id="alerts">
        <AlertStrip timeline={timeline} maxDay={maxDay} />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="mb-1 text-sm font-semibold text-ink">การเปลี่ยนระดับ</h3>
            <AlertTransitionsList timeline={timeline} />
          </div>
          <div>
            <h3 className="mb-1 text-sm font-semibold text-ink">กฎการแจ้งเตือน</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
              {ALERT_RULES_TEXT.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-3">
          <ThresholdNotice />
        </div>
      </Card>

      <ChartFigure
        title="เปรียบเทียบแต่ละการวัด (เฉลี่ย 7 วัน)"
        summary="เส้นแต่ละสีและลายเส้นแทนการวัดแต่ละแบบ ช่วยดูว่าด้านใดเปลี่ยนมากที่สุด"
        table={{
          headers: ['การวัด', `เฉลี่ยวันที่ 1–${early}`, `เฉลี่ย 7 วันล่าสุด`, 'Baseline (raw)'],
          rows: MEASUREMENT_TYPES.map((t) => [
            MEASUREMENT_META[t].label,
            pct(categoryMean(series, t, 1, early)),
            pct(categoryMean(series, t, day - 6, day)),
            baselines[t].value === null ? 'กำลังสร้าง' : MEASUREMENT_META[t].format(baselines[t].value),
          ]),
        }}
      >
        <CategoryChart series={series} maxDay={maxDay} dateOf={dateOf} />
      </ChartFigure>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartFigure
          title="ความถี่ของอาการรายสัปดาห์"
          summary={`สัปดาห์ล่าสุด: อาการ ${weekly[weekly.length - 1]?.occurrences ?? 0} ครั้ง, วันที่มีอาการ ${weekly[weekly.length - 1]?.sdays ?? 0} วัน`}
          table={{ headers: ['สัปดาห์', 'วัน', 'จำนวนครั้ง', 'วันที่มีอาการ'], rows: weekly.map((w) => [w.label, `${w.from}–${w.to}`, w.occurrences, w.sdays]) }}
        >
          <WeeklyBarChart
            data={weekly}
            bars={[
              { key: 'occurrences', name: 'จำนวนครั้ง', color: CHART_COLORS.link },
              { key: 'sdays', name: 'วันที่มีอาการ (≥2)', color: CHART_COLORS.caution },
            ]}
          />
        </ChartFigure>
        <ChartFigure
          title="การทำตามมาตรการป้องกันรายสัปดาห์"
          summary={`สัปดาห์ล่าสุดทำตามเป้าเฉลี่ย ${weekly[weekly.length - 1]?.adherence ?? '—'}% (เฉลี่ยของ 4 มาตรการ จากวันที่บันทึก)`}
          table={{ headers: ['สัปดาห์', 'วัน', 'ทำตามเป้า'], rows: weekly.map((w) => [w.label, `${w.from}–${w.to}`, w.adherence === null ? '—' : `${w.adherence}%`]) }}
        >
          <WeeklyBarChart data={weekly} bars={[{ key: 'adherence', name: 'ทำตามเป้า (%)', color: CHART_COLORS.safe }]} unit="%" yMax={100} />
        </ChartFigure>
      </div>
    </div>
  );
}
