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
  await page.waitForFunction(() => window.__all && window.__all.ready, null, { timeout: 120000 });
  const front = await page.evaluate(() => ({ sites: document.querySelectorAll('#sites li').length, pins: document.querySelectorAll('#pins > *').length, nav: [...document.querySelectorAll('#topbar nav button')].map((b) => b.textContent) }));
  await page.screenshot({ path: path.join(OUT, 'map.png') });
  if (front.sites !== 15 || front.pins !== 15) errors.push('the map does not show the fifteen sites: ' + JSON.stringify(front));

  // 1b. The timeline of every site: the period can be set, the map can be turned, and a cell's colour is the verdict
  // the site screen gives for that site and day.
  const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
  const all0 = await page.evaluate(() => ({ from: __all.from, to: __all.to, rows: __all.rows }));
  if (days(all0.from, all0.to) < 28 || days(all0.from, all0.to) > 31 || all0.from !== new Date().toISOString().slice(0, 10)) errors.push('the timeline does not open on the next month: ' + all0.from + ' ' + all0.to);
  if (all0.rows.length !== 15 || all0.rows.some((r) => r.total !== days(all0.from, all0.to) || !(r.good >= 0 && r.good <= r.total))) errors.push('timeline rows are wrong: ' + JSON.stringify(all0));
  if (!all0.rows.some((r) => r.good < r.total)) errors.push('the timeline shows no lost day at all');
  // Legibility (the owner could not tell the days apart, nor what the language dropdown was): on the opening period every
  // landing day is its own block with a gap after it, and the language choice is visible buttons with exactly one lit.
  const clear = await page.evaluate(() => {
    const cv = document.querySelector('#sites li canvas'), px = cv.getContext('2d').getImageData(0, Math.floor(cv.height / 2), cv.width, 1).data;
    let gaps = 0; for (let x = 1; x < cv.width; x++) if (px[x * 4 + 3] === 0 && px[(x - 1) * 4 + 3] !== 0) gaps++;
    return { gaps, days: __all.rows[0].total, langs: document.querySelectorAll('#lang button').length, lit: document.querySelectorAll('#lang button.on').length };
  });
  if (clear.gaps !== clear.days || clear.langs !== 3 || clear.lit !== 1) errors.push('days are not separate blocks, or the language buttons are not clear: ' + JSON.stringify(clear));
  // The Moon's own clock: play moves the time, the line on the rows and the Sun that casts the shadows.
  const t0 = await page.evaluate(() => __app.S.mapT);
  await page.click('#a-play'); await page.waitForTimeout(1500);
  const pl = await page.evaluate(() => ({ t: __app.S.mapT, head: getComputedStyle(document.getElementById('a-headline')).display, clock: document.getElementById('a-clock').textContent,
    el: __app.overview.mat.uniforms.sunEl.value, dir: __app.overview.mat.uniforms.sunDir.value.length(), marks: document.querySelectorAll('.skymark').length }));
  await page.click('#a-play');
  if (!(pl.t > t0 + 3600) || pl.head !== 'block' || !/UTC/.test(pl.clock) || !(Math.abs(pl.el) < 0.03) || Math.abs(pl.dir - 1) > 1e-6 || pl.marks !== 2) errors.push('playing the sunlight on the Moon does not work: ' + JSON.stringify({ t0, ...pl }));
  const order = await page.evaluate(() => [...document.querySelectorAll('#sites .cnt b')].map((b) => +b.textContent));
  if (order.some((n, i) => i && n > order[i - 1])) errors.push('sites are not listed best first: ' + order);
  await page.fill('#a-from', '2022-01-01'); await page.dispatchEvent('#a-from', 'change');
  await page.fill('#a-to', '2024-01-01'); await page.dispatchEvent('#a-to', 'change');
  const all1 = await page.evaluate(() => ({ from: __all.from, to: __all.to, total: __all.rows[0].total }));
  if (all1.from !== '2022-01-01' || all1.to !== '2024-01-01' || all1.total !== 730) errors.push('a past to past period did not apply: ' + JSON.stringify(all1));
  await page.click('.a-range button[data-y="0"]');
  if ((await page.evaluate(() => __all.from + ' ' + __all.rows[0].total)) !== '2021-01-01 4004') errors.push('the whole period button did not apply');
  await page.click('.a-range button[data-y="1"]');
  await page.waitForFunction(() => !__app.overview.anim, null, { timeout: 20000 }); // the opening glide from the whole Moon has ended
  const th0 = await page.evaluate(() => __app.overview.theta);
  await page.mouse.move(150, 300); await page.mouse.down(); await page.mouse.move(350, 350, { steps: 6 }); await page.mouse.up(); // starts on bare map, left of every label
  const th1 = await page.evaluate(() => __app.overview.theta); await page.waitForTimeout(400);
  if (Math.abs(th1 - th0) < 20 || (await page.evaluate(() => __app.overview.theta)) !== th1) errors.push('dragging the map did not turn it and hold it: ' + [th0, th1]);
  for (const [name, frac] of [['Peak near Shackleton', 0.1], ['Connecting ridge', 0.5], ['Leibnitz beta plateau', 0.8], ['Slater rim', 0.3], ['Shackleton floor', 0.6]]) {
    const cv = page.locator('#sites li', { hasText: name }).locator('canvas'), box = await cv.boundingBox();
    await cv.hover({ position: { x: box.width * frac, y: 7 } });
    const tip = await page.evaluate(() => document.getElementById('a-tip').textContent);
    await cv.click({ position: { x: box.width * frac, y: 7 } });
    await page.waitForFunction(() => window.__verdict && document.body.classList.contains('mode-surface'), null, { timeout: 90000 }); await page.waitForTimeout(400);
    const got = await page.evaluate(() => ({ date: __verdict.date, ok: __verdict.ok, cell: __all.at(__app.S.siteId, __verdict.date), site: __app.S.siteId }));
    if (got.ok !== got.cell || /lost/.test(tip) === got.ok || !tip.startsWith(name)) errors.push(`timeline cell and site verdict disagree: ${name} ${JSON.stringify(got)} tip "${tip}"`);
    await page.click('#back'); await page.waitForTimeout(600);
    await page.evaluate(() => { window.__verdict = null; });
  }
  await page.click('#topbar nav button[data-panel="validation"]'); await page.waitForTimeout(300);
  const how = await page.evaluate(() => document.getElementById('panel-body').innerText);
  if (!/over 20 evaluated points/.test(how) || /NaN|undefined/.test(how)) errors.push('the How do we know panel does not cover the twenty points cleanly');
  await page.goto(url); await page.reload();
  await page.waitForFunction(() => window.__all && window.__all.ready, null, { timeout: 120000 });

  // 2. Click a site: the answer panel, complete and in view without opening anything.
  await page.locator('#sites li button', { hasText: 'Peak near Shackleton' }).click();
  await page.waitForFunction(() => window.__verdict && document.body.classList.contains('mode-surface'), null, { timeout: 90000 });
  await page.waitForTimeout(2500);
  const v0 = await page.evaluate(() => ({ date: __verdict.date, today: new Date().toISOString().slice(0, 10), rows: document.querySelectorAll('.v-rows tr').length, tips: [...document.querySelectorAll('.v-rows .tip')].map((t) => t.dataset.tip.length),
    strip: document.querySelectorAll('#verdict .day').length, count: document.querySelector('.v-count').innerText, head: document.querySelector('.v-head').innerText, good: __verdict.good,
    green: document.querySelectorAll('#verdict .day.ok').length, hash: location.hash, variant: __app.S.variant, text: document.getElementById('verdict').innerText }));
  await page.screenshot({ path: path.join(OUT, 'site.png') });
  console.log('site view:', JSON.stringify({ ...v0, text: undefined, tips: v0.tips.length }));
  if (v0.date !== v0.today) errors.push('the default landing day is not today: ' + v0.date);
  // The challenge's required output is in view without opening anything: Sun and Earth elevation against the horizon, and time to the next change.
  const sky = await page.evaluate(() => { const b = document.getElementById('skybar'), r = b.getBoundingClientRect(); return { text: b.innerText, shown: r.height > 30 && r.top >= 0 && r.bottom <= innerHeight }; });
  if (!sky.shown || !/Sun[\s\S]*°\s*elevation[\s\S]*Earth[\s\S]*°\s*elevation/.test(sky.text) || !/(sunset|sunrise) in|Earth(set|rise) in/.test(sky.text) || /NaN|undefined/.test(sky.text)) errors.push('Sun and Earth positions are not shown by default on the site screen: ' + JSON.stringify(sky));
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
    await page.click(`#lang button[data-l="${l}"]`);
    const t = await page.evaluate(() => document.getElementById('verdict').innerText + [...document.querySelectorAll('#verdict .tip')].map((x) => x.dataset.tip).join(' '));
    if (!re.test(t) || /undefined|NaN|\{\w+\}/.test(t)) errors.push(`language ${l} is not applied cleanly`);
  }
  await page.click('#back'); await page.waitForTimeout(800);
  if (!(await page.evaluate(() => document.body.classList.contains('mode-overview')))) errors.push('the South pole button did not return to the map');

  // 5. Phone width: no sideways scroll.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#sites li button', { hasText: 'Connecting ridge' }).click();
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
