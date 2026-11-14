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
// The browser a test plays the page in: Chrome by default; ENGINE=webkit is Safari's engine, which iPhones use too
// (get it once with: node node_modules/playwright-core/cli.js install webkit).
const launch = () => (process.env.ENGINE === 'webkit' ? require('playwright-core').webkit.launch() : chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }));
module.exports = { serve, launch };
if (require.main !== module) return;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const errors = [], app = await serve(path.join(ROOT, 'app')), url = `http://127.0.0.1:${app.address().port}/`;
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => { try { localStorage.setItem('kidHelp', 'off'); } catch (e) { /* no storage */ } }); // the first visit help has its own test (test-tour.cjs)
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
  // The bodies read as themselves (the owner saw "a part of it and a bigger circle around it"): the app opens from far enough to
  // show the whole Moon, and the Moon and the Earth carry their real NASA pictures.
  const bodies = await page.evaluate(() => { const o = __app.overview, w = (t) => (t && t.image && t.image.width) || 0;
    return { from: o.introFrom, moon: w(o.mat.uniforms.moon.value), earth: w(o.earthBody.material.uniforms.map.value), sun: !!o.sunBody }; });
  if (!(bodies.from >= 5e6) || bodies.moon < 1024 || bodies.earth < 1024 || !bodies.sun) errors.push('the Moon, Earth or Sun is not shown as the real body: ' + JSON.stringify(bodies));
  // Legibility (the owner could not tell the days apart, nor what the language dropdown was): on the opening period every
  // landing day is its own block with a gap after it, and the language choice is visible buttons with exactly one lit.
  const clear = await page.evaluate(() => {
    const cv = document.querySelector('#sites li canvas'), px = cv.getContext('2d').getImageData(0, Math.floor(cv.height / 2), cv.width, 1).data;
    let gaps = 0; for (let x = 1; x < cv.width; x++) if (px[x * 4 + 3] === 0 && px[(x - 1) * 4 + 3] !== 0) gaps++;
    return { gaps, days: __all.rows[0].total, langs: document.querySelectorAll('#lang button').length, lit: document.querySelectorAll('#lang button.on').length };
  });
  // Not by colour alone (about one man in twelve cannot tell red from green): a lost day is a hollow block, a surviving
  // day a solid one, and both are the same height (height means nothing here). Read at the centre and top of every block.
  const shape = await page.evaluate(() => {
    const li = [...document.querySelectorAll('#sites li.a-row')].find((l) => { const r = __all.rows.find((x) => x.id === l.dataset.id); return r.good > 0 && r.good < r.total; });
    const cv = li.querySelector('canvas'), g = cv.getContext('2d'), r = __all.rows.find((x) => x.id === li.dataset.id);
    let solid = 0, hollow = 0, short = 0;
    for (let d = 0; d < r.total; d++) { const x = Math.floor(((d + 0.5) / r.total) * cv.width);
      const mid = g.getImageData(x, Math.floor(cv.height / 2), 1, 1).data[3], top = g.getImageData(x, 0, 1, 1).data[3];
      if (mid === 255) solid++; else if (mid > 0) hollow++; if (top !== 255) short++; }
    return { solid, hollow, short, good: r.good, total: r.total };
  });
  if (shape.solid !== shape.good || shape.hollow !== shape.total - shape.good || shape.short) errors.push('lost days are not hollow blocks of the same height as surviving days: ' + JSON.stringify(shape));
  if (clear.gaps !== clear.days || clear.langs !== 3 || clear.lit !== 1) errors.push('days are not separate blocks, or the language buttons are not clear: ' + JSON.stringify(clear));
  // The Moon's own clock: play moves the time, the line on the rows and the Sun that casts the shadows.
  const t0 = await page.evaluate(() => __app.S.mapT);
  await page.click('#a-play'); await page.waitForTimeout(1500);
  const pl = await page.evaluate(() => ({ t: __app.S.mapT, head: getComputedStyle(document.getElementById('a-headline')).display, clock: document.getElementById('a-clock').textContent,
    el: __app.overview.mat.uniforms.sunEl.value, dir: __app.overview.mat.uniforms.sunDir.value.length(), marks: document.querySelectorAll('.skymark').length }));
  await page.click('#a-play');
  if (!(pl.t > t0 + 3600) || pl.head !== 'block' || !/UTC/.test(pl.clock) || !(Math.abs(pl.el) < 0.03) || Math.abs(pl.dir - 1) > 1e-6 || pl.marks !== 2) errors.push('playing the sunlight on the Moon does not work: ' + JSON.stringify({ t0, ...pl }));
  // Each site's dot on the Moon is the verdict of the day under the time line, so the dots change while it plays.
  const dots = await page.evaluate(async () => {
    const S = __app.S, [a, b] = S.all.range(), keep = S.mapT, seen = {}, wrong = [];
    for (let t = a + 43200; t < b; t += 86400) {
      S.mapT = t; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const date = new Date(t * 1000).toISOString().slice(0, 10);
      for (const s of __app.overview.sites) { (seen[s.id] ||= new Set()).add(s.el.dataset.s); if (s.el.dataset.s !== (__all.at(s.id, date) ? 'ok' : 'bad')) wrong.push(s.id + ' ' + date); }
    }
    S.mapT = keep;
    return { wrong: wrong.length, first: wrong[0], changed: Object.values(seen).filter((x) => x.size > 1).length };
  });
  if (dots.wrong || !dots.changed) errors.push('the dots on the Moon do not follow the day under the time line: ' + JSON.stringify(dots));
  // The limits are the user's: a longer battery and radio limit can only add safe days, the address carries them, and reset restores the defaults.
  const sum = () => page.evaluate(() => __all.rows.reduce((a, r) => a + r.good, 0));
  const g0 = await sum();
  await page.fill('#a-night', '10'); await page.dispatchEvent('#a-night', 'change'); await page.fill('#a-radio', '10'); await page.dispatchEvent('#a-radio', 'change');
  const g1 = await sum(), hashL = await page.evaluate(() => location.hash);
  await page.click('#a-reset');
  const g2 = await sum();
  if (!(g1 > g0) || g2 !== g0 || !/battery=10/.test(hashL) || !/radio=10/.test(hashL) || /battery|radio/.test(await page.evaluate(() => location.hash))) errors.push('changing the mission limits does not re-judge the sites: ' + JSON.stringify({ g0, g1, g2, hashL }));
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
  await page.mouse.move(1300, 250); await page.mouse.down(); await page.mouse.move(1100, 300, { steps: 6 }); await page.mouse.up(); // starts on bare map, right of every label and clear of the kids cards on the left
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
  // 1c. Add a known landing site and a point of your own: each gets a row and a verdict, the address keeps them, and you can stand there.
  await page.selectOption('#a-famous', { label: 'Apollo 11 (1969)' });
  await page.fill('#a-lat', '-88'); await page.fill('#a-lon', '45'); await page.click('#a-addbtn');
  await page.waitForFunction(() => __all.rows.length === 17 && ![...document.querySelectorAll('#sites .cnt')].some((c) => c.textContent === '…'), null, { timeout: 60000 });
  const added = await page.evaluate(async () => {
    const { makeSite } = await import('./src/custom.js'), { loadPolar } = await import('./src/data.js'), idx = __app.S.index.sites, grid = await loadPolar();
    const diff = async (dir) => { const m = await (await fetch(`data/sites/${dir}/meta.json`)).json(), c = makeSite(m.lat, m.lon, grid).meta.mask.el_deg;
      let sum = 0; for (let k = 0; k < 720; k++) sum += Math.abs(m.mask.el_deg[Math.round((k * 0.5) / m.mask.az_step_deg)] - c[k]); return +(sum / 720).toFixed(2); };
    return { hash: location.hash, kinds: idx.filter((x) => x.custom).map((x) => x.custom), slopeSite: await diff('sr'), floorSite: await diff('sf'), peakSite: await diff('mm'), dip: makeSite(0.67, 23.47, grid).meta.mask.el_deg[0] };
  });
  console.log('added sites:', JSON.stringify(added));
  // The 320 m horizon is honest only if it stays near the 80 m one where both exist: under half a degree on a slope and on a
  // crater floor, under two degrees on a narrow peak (the numbers the app tells the user).
  if (added.kinds.join() !== 'smooth,coarse' || !/add=/.test(added.hash) || !(added.slopeSite < 0.5) || !(added.floorSite < 0.5) || !(added.peakSite < 2) || Math.abs(added.dip + 0.0869) > 0.002) errors.push('added sites are wrong: ' + JSON.stringify(added));
  await page.locator('#sites li button', { hasText: 'Apollo 11' }).click();
  await page.waitForFunction(() => window.__verdict && document.body.classList.contains('mode-surface'), null, { timeout: 90000 }); await page.waitForTimeout(1500);
  const apollo = await page.evaluate(() => ({ note: document.getElementById('h-variant-note').textContent, rows: document.querySelectorAll('.v-rows tr').length, sky: document.getElementById('sky-lines').innerText, pole: __verdict.rows.find((r) => r.id === 'pole').ok }));
  await page.screenshot({ path: path.join(OUT, 'added-site.png') });
  if (!/smooth curve of the Moon/.test(apollo.note) || apollo.rows !== 11 || !/°/.test(apollo.sky) || /NaN|undefined/.test(apollo.sky) || apollo.pole !== false) errors.push('standing on an added site does not work: ' + JSON.stringify(apollo));
  await page.click('#back'); await page.waitForTimeout(600);
  await page.reload();
  await page.waitForFunction(() => window.__all && window.__all.ready && __all.rows.length === 17, null, { timeout: 120000 }).catch(() => errors.push('added sites did not come back from the address'));
  // A site name comes from the address, which anyone can craft into a link: it must arrive as text, never as markup.
  await page.goto(url + '#add=' + encodeURIComponent('10,10,<img src=x onerror="window.__xss=1"><b>bold</b>')); await page.reload();
  await page.waitForFunction(() => window.__all && window.__all.ready && __all.rows.length === 16, null, { timeout: 120000 }).catch(() => errors.push('a site with a crafted name was not added'));
  await page.locator('#sites li button', { hasText: 'onerror' }).click().catch(() => errors.push('the crafted site has no row'));
  await page.waitForFunction(() => document.body.classList.contains('mode-surface'), null, { timeout: 90000 }).catch(() => {}); await page.waitForTimeout(800);
  const xss = await page.evaluate(() => ({ ran: window.__xss === 1, tags: document.querySelectorAll('#sites img, #h-name img, #h-name b').length, name: document.getElementById('h-name').textContent }));
  if (xss.ran || xss.tags || /[<>]/.test(xss.name)) errors.push('a crafted site name in the address is rendered as markup: ' + JSON.stringify(xss));
  await page.goto(url); await page.reload(); await page.waitForFunction(() => window.__all && window.__all.ready, null, { timeout: 120000 });
  // 1d. Replay a real landing: the app stands on Chandrayaan-3's site at its touchdown and shows what really happened next
  // to the model. The model's sunset must fall on 4 September 2023, the day ISRO put the lander to sleep.
  await page.selectOption('#a-famous', { label: 'Chandrayaan-3 (2023)' });
  await page.waitForFunction(() => window.__history && window.__verdict && document.body.classList.contains('mode-surface'), null, { timeout: 90000 }); await page.waitForTimeout(1500);
  const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);
  const hist = await page.evaluate(() => ({ date: __verdict.date, key: __history.key, set: __history.set, rise: __history.rise, box: document.querySelector('.v-hist').innerText, t: __app.S.t, go: document.querySelectorAll('.v-hist button').length }));
  await page.screenshot({ path: path.join(OUT, 'real-landing.png') });
  if (hist.date !== '2023-08-23' || hist.key !== 'Ch3' || day(hist.set) !== '2023-09-04' || day(hist.rise) !== '2023-08-21' || !/4 September 2023/.test(hist.box) || /undefined|NaN|\{\w+\}/.test(hist.box) || hist.t !== Date.parse('2023-08-23T12:33:00Z') / 1000 || hist.go !== 0)
    errors.push('replaying Chandrayaan-3 is wrong: ' + JSON.stringify({ ...hist, set: day(hist.set), rise: day(hist.rise) }));
  await page.fill('#v-day', '2023-10-01'); await page.dispatchEvent('#v-day', 'change'); await page.waitForTimeout(300);
  await page.click('.v-hist button').catch(() => errors.push('no button back to the real landing day')); await page.waitForTimeout(300);
  if ((await page.evaluate(() => __verdict.date)) !== '2023-08-23') errors.push('the button back to the real landing day did not work');
  await page.click('#back'); await page.waitForTimeout(600);
  // The table on screen can be taken away as a file: one line per site and landing day, under one header line.
  const csv = await page.evaluate(() => { document.getElementById('a-csv').click(); return { n: __csv.length, head: __csv[0], row: __csv[1], rows: __all.rows.length, total: __all.rows[0].total }; });
  if (csv.n !== 1 + csv.rows * csv.total || !/^site,landing_day_utc,survives_14_days,failed_check/.test(csv.head) || !/^"[^"]+",\d{4}-\d\d-\d\d,(yes|no),/.test(csv.row)) errors.push('the CSV file is wrong: ' + JSON.stringify(csv));
  await page.click('#topbar nav button[data-panel="validation"]'); await page.waitForTimeout(800);
  const how = await page.evaluate(() => document.getElementById('panel-body').innerText);
  if (!/over 20 evaluated points/.test(how) || /NaN|undefined/.test(how)) errors.push('the How do we know panel does not cover the twenty points cleanly');
  if (!/Against NASA's own illumination maps/i.test(how) || !/Against four real landings/i.test(how) || !/Chandrayaan-3/.test(how) || !/Earth in view: mean difference \d/.test(how)) // headings are shown in capitals errors.push('the How do we know panel lacks the NASA map comparison or the real landings');
  await page.goto('about:blank'); await page.goto(url); // a clean start: the replay above left its landing day and site in the address
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
  if (!sky.shown || !/Sun[\s\S]*°[\s\S]*Earth[\s\S]*°/.test(sky.text) || !/(sunset|sunrise) in|Earth(set|rise) in/.test(sky.text) || /NaN|undefined/.test(sky.text)) errors.push('Sun and Earth positions are not shown by default on the site screen: ' + JSON.stringify(sky));
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

  // 2b. Any moment to the second: typing a date and time moves the sky clock there, and the back button says where it goes.
  await page.fill('#sky-when', '2028-02-03T04:05:06'); await page.dispatchEvent('#sky-when', 'change'); await page.waitForTimeout(400);
  const when = await page.evaluate(() => ({ t: __app.S.t, land: __verdict.date, back: document.getElementById('back').textContent, bar: getComputedStyle(document.getElementById('hud')).overflowY }));
  if (when.t !== Date.parse('2028-02-03T04:05:06Z') / 1000 || when.land !== '2028-02-03' || !/All sites/.test(when.back) || when.bar !== 'scroll') errors.push('exact time, back button or scrollbar is wrong: ' + JSON.stringify(when));
  // The numbers and view options are open on a desktop and the button closes them; the options are switches, not bare checkboxes.
  const open = await page.evaluate(() => { const h = document.documentElement, o = document.getElementById('opt-horizon'), m = document.getElementById('more'), r = (e) => e.getBoundingClientRect();
    const a = { min: h.classList.contains('min'), label: m.textContent, w: o.offsetWidth, look: getComputedStyle(o).appearance, over: r(m).bottom > r(document.getElementById('viewtools')).top };
    m.click(); const b = { min: h.classList.contains('min'), label: m.textContent, w: o.offsetWidth }; m.click(); return { a, b }; });
  if (open.a.min || open.a.label !== 'Hide details' || open.a.w !== 30 || open.a.look !== 'none' || open.a.over || !open.b.min || open.b.label !== 'Details' || open.b.w !== 0) errors.push('details are not open by default, or do not close: ' + JSON.stringify(open));
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
