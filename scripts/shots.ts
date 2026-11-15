// Automated playthrough + screenshots (verification). Requires `npm run build` first.
// Usage: npx tsx scripts/shots.ts <outDir> [chromePath]

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const outDir = process.argv[2] ?? 'shots';
const chromePath = process.argv[3] || path.join(process.env.LOCALAPPDATA ?? '', 'ms-playwright/chromium-1228/chrome-win64/chrome.exe');
fs.mkdirSync(outDir, { recursive: true });

const dist = path.resolve('dist');
const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const p = path.join(dist, decodeURIComponent((req.url ?? '/').split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url!.split('?')[0]));
  if (!p.startsWith(dist) || !fs.existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] ?? 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise<void>((r) => server.listen(4318, r));

const browser = await chromium.launch({ executablePath: chromePath });
const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.clock.install();
const savePath = process.argv[4];
if (savePath) { const data = fs.readFileSync(savePath, 'utf8'); await page.addInitScript((d) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('dinozaury-save-v1', d); sessionStorage.setItem('seeded', '1'); } }, data); }
await page.goto('http://localhost:4318/');
await page.waitForSelector('.topbar');
const shot = async (name: string) => { await page.screenshot({ path: path.join(outDir, name + '.png') }); console.log('shot', name); };
const tab = async (label: string) => { await page.getByRole('button', { name: label }).first().click(); await page.clock.runFor(300); };

await shot('01-start');
if (savePath) {
  await page.getByRole('button', { name: 'Do pracy!' }).click().catch(() => {});
  await page.clock.runFor(1500);
  await shot('m1-park');
  await tab('🌳 Drzewo życia');
  await page.getByRole('button', { name: 'Dinozaury', exact: true }).first().click().catch(() => {});
  await page.clock.runFor(500);
  await shot('m2-tree');
  await tab('🧬 Laboratorium');
  await shot('m3-lab');
  await tab('⛏️ Wykopaliska');
  await shot('m4-dig');
  await browser.close(); server.close(); process.exit(0);
}
await tab('⛏️ Wykopaliska');
// dig until the first layer is done (tutorial fossils)
for (let round = 0; round < 12; round++) {
  const tiles = await page.$$('.tile:not(.cleared)');
  for (const t of tiles.slice(0, 70)) await t.click({ timeout: 1000 }).catch(() => {});
  await page.clock.runFor(500);
}
await shot('02-dig');
await tab('🧬 Laboratorium');
await page.getByRole('button', { name: 'Ekstrahuj wszystko' }).click().catch(() => {});
await page.clock.runFor(5 * 60_000);
await shot('03-lab');
const synth = page.getByRole('button', { name: /Syntezuj/ }).first();
if (await synth.isEnabled().catch(() => false)) await synth.click();
await page.clock.runFor(3 * 60_000);
await tab('🏞️ Park');
await page.locator('.chip').first().click().catch(() => {});
await page.clock.runFor(1500);
await shot('04-park');
await tab('🌳 Drzewo życia');
await page.getByRole('button', { name: 'Dinozaury', exact: true }).first().click().catch(() => {});
await page.clock.runFor(500);
await shot('05-tree');
await page.getByRole('button', { name: 'Oś czasu' }).click();
await page.clock.runFor(300);
await shot('06-timeline');
await tab('⚙️ Inne');
await page.getByText('Odsłoń całą kolekcję').click();
await page.clock.runFor(300);
await tab('🌳 Drzewo życia');
await page.getByRole('button', { name: 'Drzewo', exact: true }).click();
await page.getByRole('button', { name: 'Teropody', exact: true }).first().click().catch(() => {});
await page.clock.runFor(500);
await shot('07-tree-theropods');
await page.locator('svg image').nth(5).click().catch(() => {});
await page.clock.runFor(500);
await shot('08-encyclopedia');
await page.keyboard.press('Escape');
await page.locator('.modal .close').click().catch(() => {});
await tab('⚙️ Inne');
await page.getByRole('button', { name: /Galeria/ }).click();
await page.clock.runFor(500);
await shot('09-gallery');
await tab('🏗️ Stacje');
await shot('10-buildings');

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
server.close();
