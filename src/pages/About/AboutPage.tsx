import { Link } from 'react-router-dom';
import { Card, MedicalDisclaimer, PageHeader, SimulatedTag } from '../../components/ui';
import { ALERT_RULES_TEXT } from '../../components/alerts/AlertCard';
import { AMSLER_POINTS_PER_CELL, BASELINE_DAYS_REQUIRED } from '../../services/scoringService';
import { DEMO_DAYS, EXAM_DAYS } from '../../services/demoDataService';

export function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="เกี่ยวกับ EyeReady และข้อจำกัด" en="About & Limitations" />

      <MedicalDisclaimer />

      <Card title="วัตถุประสงค์" id="purpose">
        <p className="text-ink">
          EyeReady เป็นเว็บแอปแบบออฟไลน์ (Progressive Web App) สำหรับนักบินอวกาศ ใช้เฝ้าระวังการเปลี่ยนแปลงของการมองเห็นเทียบกับค่าของตัวเอง
          ฝึกการตอบสนองเมื่อการมองเห็นเปลี่ยน ติดตามมาตรการป้องกัน และสร้างรายงานสรุปให้แพทย์ประจำเที่ยวบิน พัฒนาสำหรับ NASA Space Apps Challenge 2026
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-ink">
          <li>EyeReady ไม่ใช่เครื่องมือวินิจฉัย (not a diagnostic tool)</li>
          <li>EyeReady ไม่สามารถป้องกัน SANS ได้</li>
          <li>ค่าเกณฑ์การแจ้งเตือนเป็นค่าเริ่มต้น (starter values) ที่ต้องปรับร่วมกับแพทย์</li>
          <li>ข้อมูลในโหมดสาธิตทั้งหมดเป็นข้อมูลสังเคราะห์ (synthetic)</li>
          <li>การทบทวนทางคลินิกและการทดสอบกับอาสาสมัครเป็นขั้นตอนการพัฒนาในอนาคต</li>
        </ul>
      </Card>

      <Card title="SANS คืออะไร" id="sans">
        <p className="text-ink">
          Spaceflight Associated Neuro-ocular Syndrome (SANS) คือกลุ่มการเปลี่ยนแปลงของดวงตาและเส้นประสาทตาที่พบในนักบินอวกาศระหว่างหรือหลังภารกิจระยะยาว
          เช่น ขั้วประสาทตาบวม ด้านหลังลูกตาแบนลง รอยพับของชั้นคอรอยด์ และค่าสายตาเปลี่ยนไปทางยาวซึ่งทำให้มองใกล้ไม่ชัด
          สมมติฐานหลักเกี่ยวข้องกับการที่ของเหลวในร่างกายเคลื่อนไปทางศีรษะในสภาวะไร้น้ำหนัก กลไกยังอยู่ระหว่างการวิจัย
        </p>
        <p className="mt-2">
          <Link to="/training/lessons/understanding-sans" className="link">
            อ่านบทเรียนสั้น: ทำความรู้จัก SANS
          </Link>
        </p>
      </Card>

      <Card title="ระบบการวัด" id="measure">
        <ul className="list-disc space-y-2 pl-5 text-ink">
          <li>
            <strong>สายตาระยะใกล้:</strong> ตาราง 12 แถว (logMAR 1.0 ถึง −0.1) แถวละ 3 ตัวอักษร Sloan หยุดเมื่ออ่านผิด ≥ 2 ตัวในแถว ให้คะแนนแบบทีละตัวอักษร (0.1/3 logMAR ต่อตัว)
            ขนาดตัวอักษรคำนวณสำหรับระยะ 40 ซม. และอิงการปรับเทียบหน้าจอ
          </li>
          <li>
            <strong>Amsler grid:</strong> ตาราง 20×20 เส้น แตะได้ 10×10 ช่อง นับจำนวนช่องที่เส้นคด บิด หรือหายไป
          </li>
          <li>
            <strong>ความไวต่อคอนทราสต์:</strong> วงกลมลายคลื่นไซน์ 3 ทิศทาง (ตั้ง เฉียงซ้าย เฉียงขวา) วิธีขั้นบันได 1-up/2-down ขั้นละ 0.1 log unit 15 ข้อ ผล = ค่าเฉลี่ย contrast ของ 6 ข้อสุดท้าย
          </li>
          <li>
            <strong>สลับโฟกัสใกล้–ไกล:</strong> 10 รอบสลับทิศทาง จับเวลาจากสัญญาณถึงการตอบ (ไกล→ใกล้ ตรวจด้วยคำตอบ, ใกล้→ไกล รายงานเอง) ตัดรอบที่ตอบเร็วกว่า 150 ms
          </li>
        </ul>
        <p className="hint mt-3">แบบทดสอบบนหน้าจอขึ้นกับขนาด ความสว่าง และ gamma ของจอ จึงใช้ติดตามแนวโน้มเทียบกับตัวเองบนอุปกรณ์เดิมเท่านั้น ไม่ใช่การวัดทางคลินิก</p>
      </Card>

      <Card title="Baseline ส่วนตัวและคะแนน" id="baseline">
        <p className="text-ink">
          Baseline ของแต่ละแบบทดสอบ = ค่าเฉลี่ยของ {BASELINE_DAYS_REQUIRED} วันแรกที่มีผลการวัดที่ใช้ได้ คะแนนรายวัน = % ของ baseline โดยกลับทิศให้ "สูงกว่า = ดีกว่า" เสมอ
          (สำหรับ Amsler ที่ baseline มักเป็น 0 ใช้การหัก {AMSLER_POINTS_PER_CELL} คะแนนต่อช่องที่เพิ่ม) คะแนนรวมของวัน = ค่าเฉลี่ยของการวัดที่มีในวันนั้น
          วันที่ไม่มีการวัดถือว่า "ไม่มีข้อมูล" ไม่ใช่ศูนย์ ผลดิบและคะแนนแสดงแยกกันเสมอ
        </p>
      </Card>

      <Card title="ตรรกะการแจ้งเตือน" id="alerts">
        <ul className="list-disc space-y-1 pl-5 text-ink">
          {ALERT_RULES_TEXT.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-ink-muted">
          การนับอาการ: 1 ครั้ง = 1 บันทึกที่ความรุนแรง ≥ 1 · "วันที่มีอาการ" = วันที่มี ≥ 2 ครั้ง (ครอบคลุมทั้ง ≥ 2 ประเภทหรือ ≥ 2 ครั้ง) · อาการที่เกี่ยวข้องสำหรับเกณฑ์แดง =
          อาการด้านการมองเห็นและปวดศีรษะ (ไม่รวมอ่อนล้า) · วันที่ไม่มีคะแนนทำให้นับ "ติดต่อกัน" ไม่ต่อเนื่อง ทุกการแจ้งเตือนคำนวณจากข้อมูลจริงของแต่ละวัน
        </p>
      </Card>

      <Card title="ข้อมูลจำลอง" id="sim">
        <p className="flex flex-wrap items-center gap-2 text-ink">
          <SimulatedTag /> โหมดสาธิตใช้ภารกิจสังเคราะห์ {DEMO_DAYS} วันที่สร้างแบบกำหนดได้ (deterministic) — วันเดียวกันให้ผลเดิมเสมอ
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink">
          <li>วันที่ 1–90: การมองเห็นคงที่ มีความคลาดเคลื่อนเล็กน้อย อาการน้อย</li>
          <li>วันที่ 91–105: ลดลงทีละน้อย 0.45 จุด/วัน บนดัชนีประสิทธิภาพการมองเห็น (baseline = 100)</li>
          <li>วันที่ 106–180: ลดลงต่อ 0.5 จุด/วัน อาการถี่ขึ้น และรูปแบบการทำตามมาตรการป้องกันเปลี่ยนไป</li>
          <li>เหตุการณ์ที่ได้จากการคำนวณ (ไม่ได้กำหนดตายตัว): เตือนเหลืองราววันที่ 109, เตือนแดงราววันที่ 134, นัดตรวจตาวันที่ {EXAM_DAYS[2]}</li>
        </ul>
        <p className="mt-2 text-sm text-ink-muted">ข้อมูลจำลองไม่ใช่การวัดจริงของนักบินอวกาศและไม่ใช่หลักฐานทางคลินิก</p>
      </Card>

      <Card title="ข้อจำกัดทางคลินิก" id="limits">
        <ul className="list-disc space-y-1 pl-5 text-ink">
          <li>ยังไม่ผ่านการตรวจสอบความถูกต้องทางคลินิก (clinical validation) ค่าเกณฑ์ยังไม่ได้ปรับร่วมกับแพทย์</li>
          <li>แบบทดสอบบนหน้าจอขึ้นกับอุปกรณ์ แสง ระยะ และความร่วมมือของผู้ใช้</li>
          <li>ไม่ได้วัดโครงสร้างของตา (เช่น OCT, ความหนาของ RNFL, ภาพจอประสาทตา) ซึ่งเป็นส่วนสำคัญในการประเมิน SANS</li>
          <li>การเปรียบเทียบมาตรการป้องกันเป็นความสัมพันธ์ (associations) ไม่ใช่เหตุและผล</li>
        </ul>
      </Card>

      <Card title="ความเป็นส่วนตัว" id="privacy">
        <p className="text-ink">
          ข้อมูลทั้งหมดเก็บใน IndexedDB ของอุปกรณ์นี้ ไม่มี backend ไม่มีฐานข้อมูลภายนอก ไม่มีการล็อกอิน และไม่ส่งข้อมูลทางการแพทย์ออกไป
          รายงาน PDF สร้างในเครื่องและมีเฉพาะข้อมูลสรุป
        </p>
      </Card>

      <Card title="แผนพัฒนาในอนาคต" id="future">
        <ul className="list-disc space-y-1 pl-5 text-ink">
          <li>ทบทวนค่าเกณฑ์และวิธีวัดร่วมกับจักษุแพทย์และแพทย์เวชศาสตร์การบิน</li>
          <li>ทดสอบกับอาสาสมัครบนพื้นโลก (เช่น การศึกษาแบบนอนศีรษะต่ำ head-down tilt) เพื่อประเมินความน่าเชื่อถือแบบวัดซ้ำ</li>
          <li>ปรับเทียบหน้าจอแบบอัตโนมัติและควบคุมความสว่าง</li>
          <li>เชื่อมกับผลตรวจบนสถานี (OCT, fundoscopy) ผ่านช่องทางที่ได้รับอนุมัติ</li>
          <li>ส่งออกข้อมูลแบบเข้ารหัสสำหรับทีมแพทย์ภาคพื้น</li>
        </ul>
      </Card>
    </div>
  );
}
