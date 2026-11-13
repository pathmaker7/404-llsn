// Opens the app in headless Chrome over http, plays it like a visitor, fails on any page error, saves screenshots.
// Run: node tools/smoke.cjs
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright-core');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'docs', 'screenshots');

// A static server for one folder (the app needs http: ES modules and data files).
function serve(dir) {
  const types = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json', png: 'image/png', mp4: 'video/mp4' };
  const srv = http.createServer((q, r) => {
    const f = path.join(dir, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
    if (!f.startsWith(dir) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': types[f.split('.').pop()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv)));
}
module.exports = { serve };
if (require.main !== module) return;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const errors = [], app = await serve(path.join(ROOT, 'app')), url = `http://127.0.0.1:${app.address().port}/`;
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => errors.push('page error: ' + e.message));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });

  // 1. First screen: the 3D map with every site, nothing else to decide.
  await page.goto(url);
  await page.waitForFunction(() => window.__app && window.__app.ready, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  const front = await page.evaluate(() => ({ sites: document.querySelectorAll('#sites li').length, pins: document.querySelectorAll('#pins > *').length, nav: [...document.querySelectorAll('#topbar nav button')].map((b) => b.textContent) }));
  await page.screenshot({ path: path.join(OUT, 'map.png') });
  if (front.sites !== 6 || front.pins !== 6) errors.push('the map does not show the six sites: ' + JSON.stringify(front));

  // 2. Click a site: the answer panel, complete and in view without opening anything.
  await page.click('#sites li:nth-child(1) button');
  await page.waitForFunction(() => window.__verdict && document.body.classList.contains('mode-surface'), null, { timeout: 90000 });
  await page.waitForTimeout(2500);
  const v0 = await page.evaluate(() => ({ date: __verdict.date, today: new Date().toISOString().slice(0, 10), rows: document.querySelectorAll('.v-rows tr').length, tips: [...document.querySelectorAll('.v-rows .tip')].map((t) => t.dataset.tip.length),
    strip: document.querySelectorAll('#verdict .day').length, count: document.querySelector('.v-count').innerText, head: document.querySelector('.v-head').innerText, good: __verdict.good,
    green: document.querySelectorAll('#verdict .day.ok').length, hash: location.hash, variant: __app.S.variant, text: document.getElementById('verdict').innerText }));
  await page.screenshot({ path: path.join(OUT, 'site.png') });
  console.log('site view:', JSON.stringify({ ...v0, text: undefined, tips: v0.tips.length }));
  if (v0.date !== v0.today) errors.push('the default landing day is not today: ' + v0.date);
  if (v0.rows !== 11 || v0.tips.length !== 11 || v0.tips.some((n) => n < 30)) errors.push('the eleven checks with their explanations are not all shown');
  if (v0.strip !== 120 || v0.green !== v0.good || !new RegExp('^' + v0.good + '\\b').test(v0.count.trim())) errors.push('the landing day strip and its count disagree: ' + JSON.stringify([v0.strip, v0.green, v0.good, v0.count]));
  if (/undefined|NaN|\{\w+\}/.test(v0.text)) errors.push('raw text in the answer panel');
  if (v0.variant !== 'best' || !/^#site=\w+&land=\d{4}-\d\d-\d\d$/.test(v0.hash)) errors.push('not on the best spot, or the address is not short: ' + v0.variant + ' ' + v0.hash);
  // The colours of the strip are the verdicts: clicking a green day must give SURVIVED, a red one LOST.
  for (const cls of ['ok', 'bad']) {
    if (!(await page.locator(`#verdict .day.${cls}:not(.now)`).count())) continue;
    await page.locator(`#verdict .day.${cls}:not(.now)`).first().click(); await page.waitForTimeout(300);
    if ((await page.evaluate(() => __verdict.ok)) !== (cls === 'ok')) errors.push(`a ${cls} day did not give the matching verdict`);
  }

  // 3. Any day, past or future: the date field, the year buttons, and the 3D clock follow.
  await page.fill('#v-day', '2030-05-01'); await page.dispatchEvent('#v-day', 'change'); await page.waitForTimeout(500);
  const v1 = await page.evaluate(() => ({ date: __verdict.date, clock: document.getElementById('d-time').textContent }));
  if (v1.date !== '2030-05-01' || !v1.clock.startsWith('2030-05-01')) errors.push('picking a day in 2030 did not move the landing: ' + JSON.stringify(v1));
  await page.click('.v-date button:has-text("−1")'); await page.waitForTimeout(300);
  if ((await page.evaluate(() => __verdict.date)) !== '2029-05-01') errors.push('the minus one year button did not work');
  await page.fill('#v-day', '2022-03-10'); await page.dispatchEvent('#v-day', 'change'); await page.waitForTimeout(300);
  if ((await page.evaluate(() => __verdict.date)) !== '2022-03-10') errors.push('a past day did not work');

  // 4. Play the stay in 3D, switch language, go back to the map.
  await page.click('#play'); await page.waitForTimeout(2500);
  const moved = await page.evaluate(() => document.getElementById('d-time').textContent);
  if (moved.startsWith('2022-03-10 00:00')) errors.push('pressing play did not move the time');
  await page.screenshot({ path: path.join(OUT, 'site-playing.png') });
  for (const [l, re] of [['ru', /[а-яё]/i], ['ky', /[өүң]/i], ['en', /Longest night/]]) {
    await page.selectOption('#lang', l);
    const t = await page.evaluate(() => document.getElementById('verdict').innerText + [...document.querySelectorAll('#verdict .tip')].map((x) => x.dataset.tip).join(' '));
    if (!re.test(t) || /undefined|NaN|\{\w+\}/.test(t)) errors.push(`language ${l} is not applied cleanly`);
  }
  await page.click('#back'); await page.waitForTimeout(800);
  if (!(await page.evaluate(() => document.body.classList.contains('mode-overview')))) errors.push('the South pole button did not return to the map');

  // 5. Phone width: no sideways scroll.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('#sites li:nth-child(4) button');
  await page.waitForFunction(() => document.body.classList.contains('mode-surface'), null, { timeout: 90000 }); await page.waitForTimeout(2000);
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  await page.screenshot({ path: path.join(OUT, 'site-390.png') });
  if (w > 390) errors.push('sideways scroll at 390 px: ' + w);
  app.close();

  // 6. The explainer page: loads, no broken images.
  const ex = await serve(path.join(ROOT, 'explainer'));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`http://127.0.0.1:${ex.address().port}/`); await page.waitForTimeout(500);
  const broken = await page.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src')));
  if (broken.length) errors.push('explainer: broken images ' + broken.join());
  ex.close(); await browser.close();

  if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
  console.log('no errors');
})();
