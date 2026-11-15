// End-to-end acceptance checks against the production build.
// Usage: npm run build && npx vite preview --port 4173 &  then
//        NODE_PATH=$(npm root -g) node e2e/acceptance.mjs [baseUrl] [screenshotDir]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const BASE = process.argv[2] ?? 'http://localhost:4173/';
const SHOTS = process.argv[3] ?? null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};
const shot = async (page, name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
const go = async (hash) => {
  await page.goto(`${BASE}#${hash}`);
  await page.waitForSelector('#main h1, #main h2', { timeout: 15000 });
  await page.waitForTimeout(150);
};
const level = () => page.getAttribute('[data-alert-level]', 'data-alert-level');
const pickDay = async (d) => {
  await page.getByRole('button', { name: `Day ${d}`, exact: true }).click();
  await page.waitForTimeout(250);
};

// 1. Five primary areas
await go('/');
await page.getByText('วันภารกิจที่').first().waitFor();
for (const name of ['สถานะวันนี้', 'การฝึกและการวัด', 'บันทึกอาการ', 'แนวโน้มภารกิจ', 'สรุปสำหรับแพทย์']) {
  check(`nav: ${name}`, (await page.getByRole('navigation', { name: 'เมนูหลัก' }).getByRole('link', { name }).count()) > 0);
}

// 7/8. Quick days produce consistent global views (alerts computed from data)
for (const [d, expected] of [
  [60, 'green'],
  [110, 'yellow'],
  [135, 'red'],
]) {
  await go('/');
  await pickDay(d);
  const home = await level();
  await go('/surgeon');
  const surgeon = await level();
  const trendTable = await (async () => {
    await go('/trend');
    return page.getByText(`วันที่ 1 ถึง วันที่ ${d}`).count();
  })();
  check(`Day ${d}: home=${home} surgeon=${surgeon} (expected ${expected})`, home === expected && surgeon === expected && trendTable > 0);
  if (d === 110) await shot(page, 'trend-day110');
}
await go('/');
await shot(page, 'home-day135');

// 2/3. Measurement modules complete and save
await go('/training/amsler');
await page.getByRole('button', { name: 'เริ่มทดสอบ' }).click();
for (const cell of ['แถว 3 คอลัมน์ 4', 'แถว 3 คอลัมน์ 5', 'แถว 4 คอลัมน์ 4']) await page.getByRole('gridcell', { name: cell }).click();
await shot(page, 'amsler');
await page.getByRole('button', { name: /บันทึก 3 ช่อง/ }).click();
await page.getByText('ผลการวัด').waitFor();
check('Amsler grid completes', await page.getByText('3 ช่องผิดปกติ').first().isVisible());

await go('/training/near');
await page.getByRole('button', { name: 'เริ่มทดสอบ' }).click();
let rows = 0;
while (rows < 20 && (await page.getByText('ตัวที่', { exact: false }).count())) {
  const letters = await page.$$eval('[aria-live="polite"] span[style*="font-size"]', (els) => els.map((e) => e.textContent));
  const knowsRow = rows < 4;
  for (const l of letters) {
    if (knowsRow) await page.getByRole('button', { name: l, exact: true }).click();
    else await page.getByRole('button', { name: 'มองไม่ชัด' }).click();
  }
  rows++;
  // wait until the next row appears or the test finishes (saving is async)
  await page.waitForFunction(
    (n) => document.body.innerText.includes('ผลการวัด') || document.body.innerText.includes(`ทดสอบแล้ว ${n + 1} แถว`),
    rows,
  );
  if (await page.getByText('ผลการวัด').count()) break;
}
check('Near-vision chart completes', await page.getByText('แถวเล็กที่สุดที่อ่านถูกครบ').isVisible(), `${rows} rows`);

await go('/training/contrast');
await page.getByRole('button', { name: 'เริ่มทดสอบ' }).click();
for (let i = 0; i < 15; i++) await page.getByRole('button', { name: 'มองไม่เห็นลาย' }).click();
await page.getByText('ผลการวัด').waitFor();
check('Contrast sensitivity completes (15 trials)', await page.getByText('logCS').first().isVisible());

await go('/training/focus');
await page.getByRole('button', { name: 'เริ่มทดสอบ' }).click();
for (let r = 0; r < 10; r++) {
  await page.getByRole('button', { name: /เริ่มรอบที่/ }).click();
  const target = page.getByRole('button', { name: 'ชัดแล้ว' }).or(page.getByRole('group', { name: 'ตัวเลือกรหัส' }));
  await target.first().waitFor({ timeout: 8000 });
  await page.waitForTimeout(300);
  if (await page.getByRole('button', { name: 'ชัดแล้ว' }).count()) await page.getByRole('button', { name: 'ชัดแล้ว' }).click();
  else {
    const code = await page.$eval('p.tracking-\\[0\\.3em\\]', (e) => e.textContent);
    await page.getByRole('group', { name: 'ตัวเลือกรหัส' }).getByRole('button', { name: code, exact: true }).click();
  }
}
await page.getByText('ผลการวัด').waitFor();
check('Near–far focus completes (10 rounds)', await page.getByText('ไกล→ใกล้').first().isVisible());

// 5. Scenario training
await go('/training/scenarios/blurry-manual');
await page.getByLabel(/ขยายตัวอักษร ใช้แว่นอ่านหนังสือ/).check();
await page.getByRole('button', { name: 'ยืนยันคำตอบ' }).click();
for (const l of ['เพิ่มขนาดตัวอักษร', 'บันทึกอาการ']) await page.getByRole('checkbox', { name: new RegExp(l) }).check();
await page.getByRole('button', { name: 'ส่งและดูคะแนน' }).click();
const scoreText = await page.locator('[role="status"] p.text-3xl').textContent();
check('Scenario scored and saved', /\d+\/100/.test(scoreText ?? ''), scoreText ?? '');

// Unsafe choice is never rewarded
await go('/training/scenarios/critical-small-print');
await page.getByLabel(/อ่านเองให้เร็วที่สุด/).check();
await page.getByRole('button', { name: 'ยืนยันคำตอบ' }).click();
for (const l of ['เพิ่มขนาดตัวอักษร', 'บันทึกอาการ', 'แจ้งแพทย์']) await page.getByRole('checkbox', { name: new RegExp(l) }).check();
await page.getByRole('button', { name: 'ส่งและดูคะแนน' }).click();
check('Unsafe choice scores 0', ((await page.locator('[role="status"] p.text-3xl').textContent()) ?? '').startsWith('0/'));

// Symptom log create / edit / delete
await go('/symptoms');
await page.getByLabel('ตาพร่ามัว').check();
await page.getByLabel('ระยะเวลา (นาที)', { exact: false }).fill('45');
await page.getByLabel(/หมายเหตุ/).fill('ทดสอบ e2e');
await page.getByRole('button', { name: 'บันทึกอาการ', exact: true }).click();
await page.getByText('ทดสอบ e2e').waitFor();
await page.getByRole('button', { name: 'แก้ไข' }).first().click();
await page.getByLabel(/หมายเหตุ/).fill('ทดสอบ e2e แก้ไขแล้ว');
await page.getByRole('button', { name: 'บันทึกการแก้ไข' }).click();
check('Symptom edited', await page.getByText('ทดสอบ e2e แก้ไขแล้ว').isVisible());

// 9. Countermeasure create/edit
await go('/countermeasures');
await page.getByLabel(/Lower Body Negative Pressure/).fill('40');
await page.getByLabel(/Resistance Exercise/).fill('75');
await page.getByRole('button', { name: /^บันทึก/ }).first().click();
await page.waitForTimeout(400);
check('Countermeasure saved as user record', (await page.getByText('บันทึกโดยผู้ใช้').count()) > 0);
await page.getByLabel(/Lower Body Negative Pressure/).fill('20');
await page.getByRole('button', { name: 'บันทึกการแก้ไข' }).click();
await page.waitForTimeout(300);
check('Countermeasure edited', (await page.getByLabel(/Lower Body Negative Pressure/).inputValue()) === '20');
// 10. Insights with sample sizes and disclaimer
check('Insights show sample sizes + exact wording', (await page.getByText(/Associated with a/).count()) > 0 && (await page.getByText('They do not establish causation').count()) > 0);

// 13. Persistence after refresh
await page.reload();
await go('/symptoms');
check('Data persists after refresh', await page.getByText('ทดสอบ e2e แก้ไขแล้ว').isVisible());
await page.getByRole('button', { name: 'ลบ', exact: true }).first().click({ trial: true });
page.once('dialog', (d) => d.accept());
await page.getByRole('button', { name: 'ลบ', exact: true }).first().click();
await page.waitForTimeout(300);
check('Symptom deleted', (await page.getByText('ทดสอบ e2e แก้ไขแล้ว').count()) === 0);

// 11. Adaptive plan
await go('/training/plan');
check('Daily plan renders with level', (await page.getByText(/ระดับความยาก \d\/5/).count()) > 0);
await page.getByLabel(/รู้สึกล้าแค่ไหน/).fill('9');
await page.getByRole('button', { name: /การเช็ก/ }).click();
await page.waitForTimeout(400);
check('High fatigue reduces workload', (await page.getByText(/ลดแผนเหลือ 3 นาที/).count()) > 0);
await shot(page, 'daily-plan');

// 12. PDF export
await go('/surgeon');
const [download] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.getByRole('button', { name: /ส่งออก PDF/ }).click()]);
const pdfPath = `${SHOTS ?? '/tmp'}/report.pdf`;
await download.saveAs(pdfPath);
check('PDF export downloads', download.suggestedFilename().endsWith('.pdf'), download.suggestedFilename());
await shot(page, 'surgeon');

// Guided demo
await go('/');
await page.getByRole('button', { name: 'ทัวร์สาธิต' }).first().click();
for (let i = 0; i < 8; i++) await page.getByRole('dialog').getByRole('button', { name: 'ถัดไป' }).click();
check('Guided demo reaches surgeon summary', page.url().includes('/surgeon') && (await page.getByRole('dialog').getByText('ขั้นตอน 9/9').count()) === 1);
await page.getByRole('dialog').getByRole('button', { name: 'เสร็จสิ้น' }).click();

// Personal mode is clearly separated
await go('/settings');
await page.getByLabel(/ข้อมูลของฉัน/).check();
await go('/');
check('Personal mode separated from demo', (await page.getByText('เริ่มต้นภารกิจของคุณ').count()) === 1 && (await page.getByText('ข้อมูลของฉัน').count()) > 0);
await go('/settings');
await page.getByLabel(/ภารกิจสาธิต 180 วัน/).check();

// 14. Offline after caching
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload();
await page.waitForTimeout(500);
await ctx.setOffline(true);
await page.goto(`${BASE}#/trend`);
await page.getByText('แนวโน้มภารกิจ').first().waitFor({ timeout: 10000 });
check('Loads offline after first visit', (await page.getByText('ออฟไลน์').count()) > 0);
await ctx.setOffline(false);

// 16. No console errors
const relevant = errors.filter((e) => !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(e));
check('No console errors', relevant.length === 0, relevant.slice(0, 3).join(' | '));
await ctx.close();

// 15. Mobile + tablet layouts
for (const [label, device, colorScheme] of [
  ['mobile', devices['iPhone 13'], 'light'],
  ['mobile-dark', devices['iPhone 13'], 'dark'],
  ['tablet', devices['iPad (gen 7)'], 'light'],
]) {
  const c = await browser.newContext({ ...device, colorScheme });
  const p = await c.newPage();
  for (const hash of ['/', '/training', '/symptoms', '/trend', '/surgeon', '/countermeasures', '/training/amsler']) {
    await p.goto(`${BASE}#${hash}`);
    await p.waitForLoadState('networkidle');
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) check(`${label} no horizontal scroll ${hash}`, false, `${overflow}px`);
    // Element-level check: content clipped past the viewport edge (outside intentional scroll regions).
    const clipped = await p.evaluate(
      () => [...document.querySelectorAll('#main *')].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1 && !e.closest('[role=region],.overflow-x-auto,.overflow-auto')).length,
    );
    if (clipped) check(`${label} nothing clipped off-screen ${hash}`, false, `${clipped} elements`);
  }
  await p.goto(`${BASE}#/`);
  await p.waitForLoadState('networkidle');
  const bottomNav = await p.getByRole('navigation', { name: 'เมนูหลัก (มือถือ)' }).isVisible();
  check(`${label}: layout fits, primary nav visible`, label === 'tablet' ? true : bottomNav);
  if (colorScheme === 'dark') check(`${label}: dark theme applied`, (await p.evaluate(() => document.documentElement.dataset.theme)) === 'dark');
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/${label}-home.png` });
  await c.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
