// Renders public/icons/icon.svg to the PNG sizes the web app manifest needs.
import { createRequire } from 'node:module';
// Uses the machine's preinstalled Playwright (run with NODE_PATH=$(npm root -g)).
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const svg = readFileSync(resolve('public/icons/icon.svg'), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
const jobs = [
  { file: 'icon-192.png', size: 192, pad: 0 },
  { file: 'icon-512.png', size: 512, pad: 0 },
  { file: 'icon-maskable-512.png', size: 512, pad: 0.12 },
];
for (const j of jobs) {
  await page.setViewportSize({ width: j.size, height: j.size });
  const inner = Math.round(j.size * (1 - j.pad * 2));
  await page.setContent(`<body style="margin:0;background:#13294B;display:grid;place-items:center;width:${j.size}px;height:${j.size}px">
    <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body>`);
  await page.screenshot({ path: resolve('public/icons', j.file), omitBackground: false });
}
await browser.close();
console.log('icons written');
