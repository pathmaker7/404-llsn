// "What if we land 1 km off" test. Run: node tools/test-nearby.cjs
//   BASE_URL=https://...   test a deployed site instead of the local app folder
//   VIEWPORT=390x844       window size (default 1440x900)
//   SHOTS=/some/dir        where screenshots go (default: nearby-shots in the system temp folder)
// One line per check; exit code 1 on any failed check or page error.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { serve, launch } = require('./smoke.cjs');

const [VW, VH] = (process.env.VIEWPORT || '1440x900').split('x').map(Number);
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'nearby-shots');
const TAG = `${VW}x${VH}`;
const INDEX = require('../app/data/index.json');
const fails = [];
const check = (ok, name, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); if (!ok) fails.push(name); };

// Great circle distance and initial bearing on the Moon's sphere, written here on purpose (not taken from the app).
const R = 1737400, D = Math.PI / 180;
const dist = (a, b) => { const h = Math.sin((b.lat - a.lat) * D / 2) ** 2 + Math.cos(a.lat * D) * Math.cos(b.lat * D) * Math.sin((b.lon - a.lon) * D / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const bearing = (a, b) => { const dl = (b.lon - a.lon) * D, y = Math.sin(dl) * Math.cos(b.lat * D), x = Math.cos(a.lat * D) * Math.sin(b.lat * D) - Math.sin(a.lat * D) * Math.cos(b.lat * D) * Math.cos(dl); return (Math.atan2(y, x) / D + 360) % 360; };
const angDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const AZ = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
// How many solid marks the sentence says (in English).
const sayCount = (s) => /^All 8 spots .* survive too/.test(s) ? 8 : /lost too|^Only the target/.test(s) ? 0 : /^1 km to the/.test(s) ? 1 : +(s.match(/^(\d+) of 8/) || [])[1];

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const srv = process.env.BASE_URL ? null : await serve(path.join(__dirname, '..', 'app'));
  const url = process.env.BASE_URL || `http://127.0.0.1:${srv.address().port}/`;
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: VW, height: VH } });
  await ctx.addInitScript(() => { try { localStorage.setItem('kidHelp', 'off'); } catch (e) { /* no storage */ } }); // the first visit help has its own test (test-tour.cjs)
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', (e) => errs.push('page error: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console error: ' + m.text()); });
  p.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(url.replace(/\/$/, ''))) errs.push(`${r.status()} ${r.url()}`); });
  const shot = (name) => p.screenshot({ path: path.join(SHOTS, `nearby-${TAG}-${name}.png`) });
  const ready = (pg = p) => pg.waitForFunction(() => window.__all && window.__all.ready && window.__app && window.__app.ready, null, { timeout: 120000 });
  const done = (date) => p.waitForFunction((d) => window.__nearby.state === 'done' && window.__nearby.date === d && window.__verdict.date === d && document.querySelector('#v-extra .nb[data-state="done"]'), date, { timeout: 60000 });
  const openSite = async (id) => { // a real click on the site's row of the list, going back to the map first when a site is open
    if (await p.$('#back:visible')) { await p.click('#back'); await p.waitForTimeout(700); }
    await p.click(`#sites li[data-id="${id}"] button`);
    await p.waitForFunction((id) => window.__app.S.siteId === id && window.__verdict && document.querySelector('#v-extra .nb'), id, { timeout: 60000 });
  };
  const setDay = async (d) => { await p.fill('#v-day', d); await done(d); };
  const read = () => p.evaluate(() => {
    const nb = document.querySelector('#v-extra .nb'); if (!nb) return null;
    const ms = [...nb.querySelectorAll('.nb-m')], side = ms.filter((m) => !m.classList.contains('nb-c')), c = ms.find((m) => m.classList.contains('nb-c'));
    return { state: nb.dataset.state, marks: ms.length, side: side.length, solid: side.filter((m) => m.classList.contains('ok')).length, hollow: side.filter((m) => m.classList.contains('bad')).length,
      waiting: ms.filter((m) => m.classList.contains('wait')).length, centre: c ? c.classList.contains('ok') : null, radii: [...new Set(ms.map((m) => m.getAttribute('r')))].join(),
      fills: side.map((m) => [m.classList.contains('ok') ? 'ok' : 'bad', getComputedStyle(m).fill, getComputedStyle(m).stroke]), say: nb.querySelector('.nb-say')?.textContent, title: nb.querySelector('.nb-title')?.textContent,
      tip: nb.querySelector('.tip')?.dataset.tip, tabindex: nb.querySelector('.tip')?.getAttribute('tabindex'), far: nb.classList.contains('nb-far'), text: nb.textContent };
  });
  // Every neighbour judged the ordinary way: the 8 points are added as a user adds a point by coordinates (main.js#addCustom: makeSite,
  // registerSite, the hourly Sun and Earth of the whole period), then judged with the panel's own judgeAt on the full series.
  const indep = (spots, date) => p.evaluate(async ({ spots, date }) => {
    const { loadSite } = await import('./src/data.js'), { judgeAt } = await import('./src/verdict.js'), S = window.__app.S, t = Date.parse(date + 'T00:00:00Z') / 1000, W = Math.round(S.missionDays * 24), out = [];
    for (const s of spots) {
      const e = await window.__app.kid.addCustom(s.lat, s.lon, null), v = e.variants.databook, site = await loadSite(v.dir);
      const x = judgeAt(site, Math.round((t - site.t0) / 3600), W, v.slope_deg, S.extra[v.dir] ?? v.slope_deg);
      out.push({ id: s.id, ok: x.ok, slope: v.slope_deg, rows: x.rows.map((r) => `${r.id}:${r.ok}:${r.v}`).join('|'), lat: e.lat, lon: e.lon });
    }
    return out;
  }, { spots, date });
  const mine = () => p.evaluate(() => window.__nearby.results.map((r) => ({ id: r.id, ok: r.ok, slope: r.slope, rows: r.rows.map((x) => `${x.id}:${x.ok}:${x.v}`).join('|'), lat: r.lat, lon: r.lon })));
  const centre = () => p.evaluate(() => window.__nearby.centre);
  const fits = (name) => p.evaluate(() => { const nb = document.querySelector('#v-extra .nb'), r = nb.getBoundingClientRect(), W = window.innerWidth, v = document.getElementById('verdict'), s = nb.querySelector('.nb-say');
    return { ok: r.left >= 0 && r.right <= W && nb.scrollWidth <= nb.clientWidth + 1 && v.scrollWidth <= v.clientWidth + 1 && document.documentElement.scrollWidth <= W && (!s || s.scrollWidth <= s.clientWidth + 1), r: [r.left, r.right].map(Math.round), W, sw: [nb.scrollWidth, nb.clientWidth, v.scrollWidth, v.clientWidth] }; })
    .then((f) => check(f.ok, `the box fits the ${TAG} screen (${name})`, JSON.stringify(f)));
  const verdicts = {};

  await p.goto(url);
  await ready();
  await p.waitForTimeout(4200); // the opening move ends

  // 0. the plug-in is loaded and exposes its results; no box before a site is open
  check(await p.evaluate(() => !!window.__nearby && Array.isArray(window.__nearby.DIRS) && window.__nearby.DIRS.length === 8 && typeof window.__nearby.offset === 'function' && Array.isArray(window.VerdictExtras) && window.VerdictExtras.length >= 1), 'the plug-in is registered and exposes __nearby');

  // 1. the geometry, by maths alone: every prepared site and the extreme cases, 8 spots each, 1000 m +-5 m, on the right bearing
  const pts = [...INDEX.sites.map((s) => ({ name: s.name, lat: s.lat, lon: s.lon })), { name: 'lat -89.9999', lat: -89.9999, lon: 0 }, { name: 'the pole itself', lat: -90, lon: 0 }, { name: 'lat -89.99', lat: -89.99, lon: 120 }, { name: 'lon 179.99', lat: -86, lon: 179.99 }];
  const worst = { d: 0, b: 0, name: '' };
  let bad = 0;
  for (const pt of pts) {
    const spots = await p.evaluate(({ la, lo }) => window.__nearby.DIRS.map(([id, az]) => ({ id, az, ...window.__nearby.offset(la, lo, az) })), { la: pt.lat, lo: pt.lon });
    for (const s of spots) {
      const e = Math.abs(dist(pt, s) - 1000), be = Math.abs(pt.lat) > 89.999 ? 0 : angDiff(bearing(pt, s), AZ[s.id]);
      if (e > worst.d) Object.assign(worst, { d: e, name: pt.name + ' ' + s.id }); if (be > worst.b) worst.b = be;
      if (e > 5 || be > 0.5) bad++;
    }
  }
  check(bad === 0 && pts.length === 19, `all 8 spots of ${pts.length} places (15 sites, the pole, edge cases) are 1000 m away, within 5 m, on their compass bearing`, `worst ${worst.d.toFixed(3)} m (${worst.name}), bearing off by ${worst.b.toFixed(3)} deg`);

  // 2. open a site with a real click: the box is there at once with "checking…", then it finishes
  const t0 = Date.now();
  await p.click('#sites li[data-id="mm"] button');
  await p.waitForFunction(() => window.__app.S.siteId === 'mm' && window.__verdict && document.querySelector('#v-extra .nb'), null, { timeout: 60000 });
  const first = await read();
  const waitNote = await p.evaluate(() => window.__nearby.state);
  await p.waitForFunction(() => window.__nearby.state === 'done' && document.querySelector('#v-extra .nb[data-state="done"]'), null, { timeout: 60000 });
  const cold = await p.evaluate(() => window.__nearby.ms), coldWall = Date.now() - t0;
  check(first && first.state === 'checking' && /^Checking the 8 spots/.test(first.say) && first.waiting === 9 && waitNote === 'checking', 'the first open draws the box at once with "checking…" (9 dashed marks)', first && first.say);
  check(cold.cold === true && cold.maxPiece < 30, 'first open of a site: the work runs in pieces, none longer than 30 ms', `${cold.wall} ms until the box is done (the 7 MB polar terrain is fetched on the way), ${cold.busy} ms of work in total, longest piece ${cold.maxPiece} ms`);
  console.log(`     TIMING first open of a site: click to finished box ${coldWall} ms; inside the module: ${cold.wall} ms wall, ${cold.busy} ms of work, longest single piece ${cold.maxPiece} ms`);

  // 3. fixed landing days, so the result does not depend on today's date: marks, sentence, centre, and every neighbour against the ordinary path
  const DAYS = ['2026-12-05', '2027-01-18', '2027-03-02', '2027-05-20', '2027-08-11', '2028-02-09', '2029-06-30', '2030-10-01', '2027-02-10', '2027-04-14'];
  let mixed = 0, solidSeen = new Set(), checked = 0, same = 0, total = 0, targetOk = 0, sentenceOk = 0, markOk = 0, shapeOk = 0;
  const warm = [];
  for (const d of DAYS) {
    await setDay(d);
    const bx = await read(), mm = await mine(), cen = await centre();
    verdicts[d] = await p.evaluate(() => JSON.stringify(window.__verdict));
    warm.push(await p.evaluate(() => window.__nearby.ms));
    const ok = await p.evaluate(() => window.__verdict.ok), ind = await indep(mm.map((m) => ({ id: m.id, lat: m.lat, lon: m.lon })), d);
    const solid = mm.filter((m) => m.ok).length;
    markOk += bx.marks === 9 && bx.side === 8 && bx.solid === solid && bx.hollow === 8 - solid && bx.waiting === 0 ? 1 : 0;
    shapeOk += bx.radii === '5' && bx.fills.every(([k, f, s]) => k === 'ok' ? f !== 'none' && !/rgba\(0, 0, 0, 0\)/.test(f) : /rgba\(0, 0, 0, 0\)|transparent/.test(f) && s !== 'none') ? 1 : 0;
    sentenceOk += sayCount(bx.say) === solid ? 1 : 0;
    targetOk += bx.centre === ok && cen.ok === ok ? 1 : 0;
    for (let k = 0; k < 8; k++) { total++; if (ind[k].ok === mm[k].ok && ind[k].slope === mm[k].slope && ind[k].rows === mm[k].rows && ind[k].lat === mm[k].lat && ind[k].lon === mm[k].lon) same++; else console.log(`     DIFF ${d} ${mm[k].id}: box ${mm[k].ok} ${mm[k].slope} ${mm[k].rows}\n                       independent ${ind[k].ok} ${ind[k].slope} ${ind[k].rows}`); }
    if (solid > 0 && solid < 8 || solid > 0 && !ok) mixed++; solidSeen.add(solid + (ok ? 'T' : 'L')); checked++;
    console.log(`     ${d}: target ${ok ? 'survives' : 'lost'}, ${solid} of 8 around survive: "${bx.say}"`);
  }
  check(markOk === checked, `on ${checked} landing days: exactly 8 marks around the centre, solid plus hollow is 8, solid marks equal the survivors, nothing left on "checking…"`, `${markOk}/${checked}`);
  check(shapeOk === checked, 'state is never shown by size: all 9 marks have the same radius, a survivor is filled, a lost spot is hollow with a red outline', `${shapeOk}/${checked}`);
  check(sentenceOk === checked, 'the number in the sentence equals the number of solid marks, on every day', `${sentenceOk}/${checked}`);
  check(targetOk === checked, 'the centre mark shows the target verdict (__verdict.ok) on every day', `${targetOk}/${checked}`);
  check(same === total, `all ${total} neighbour verdicts (survived or lost, slope and every check value) equal the same points added the ordinary way and judged on the full ten year series`, `${same}/${total}`);
  check(mixed >= 1 && solidSeen.size >= 3, 'the days checked are not all alike: neighbours disagree with each other or with the target on some', [...solidSeen].join(' '));

  // 4. geometry of the points actually judged, for this site and for the site closest to the pole (Shackleton rim)
  const cenMM = await centre(), resMM = await p.evaluate(() => window.__nearby.results.map((r) => ({ id: r.id, lat: r.lat, lon: r.lon })));
  const dm = resMM.map((s) => Math.abs(dist(cenMM, s) - 1000)), bm = resMM.map((s) => angDiff(bearing(cenMM, s), AZ[s.id]));
  check(resMM.length === 8 && Math.max(...dm) < 5 && Math.max(...bm) < 0.5, 'the 8 judged spots are 1000 m from the target (within 5 m) on their bearings', `worst ${Math.max(...dm).toFixed(3)} m, ${Math.max(...bm).toFixed(3)} deg`);
  const sr = INDEX.sites.reduce((a, s) => (s.lat < a.lat ? s : a));
  await openSite(sr.id);
  await p.waitForFunction(() => window.__nearby.state === 'done' && document.querySelector('#v-extra .nb[data-state="done"]'), null, { timeout: 60000 });
  const cenSR = await centre(), resSR = await p.evaluate(() => window.__nearby.results.map((r) => ({ id: r.id, lat: r.lat, lon: r.lon, ok: r.ok })));
  const ds = resSR.map((s) => Math.abs(dist(cenSR, s) - 1000)), bs = resSR.map((s) => angDiff(bearing(cenSR, s), AZ[s.id]));
  check(Math.abs(cenSR.lat - sr.lat) < 1e-6 && resSR.length === 8 && Math.max(...ds) < 5 && Math.max(...bs) < 0.5, `${sr.name} (${sr.lat}, the closest site to the pole): the 8 judged spots are 1000 m away (within 5 m) on their bearings`, `worst ${Math.max(...ds).toFixed(3)} m, ${Math.max(...bs).toFixed(3)} deg`);
  await fits(sr.name);
  await shot('1-' + sr.id);
  const srRead = await read();
  check(srRead.marks === 9 && sayCount(srRead.say) === srRead.solid, `${sr.name}: box complete`, srRead.say);

  // 5. a day change: the box updates, never stays on "checking…"; the answer is instant when the days were seen before
  await openSite('mm');
  await p.waitForFunction(() => window.__nearby.state === 'done', null, { timeout: 60000 });
  await setDay('2027-05-20');
  const dayBtn = p.locator('#verdict .days .day').nth(40);
  const stamp = Date.now();
  await dayBtn.click();
  const after = await p.evaluate(() => ({ v: window.__verdict.date, n: window.__nearby.date }));
  await p.waitForFunction(() => window.__nearby.state === 'done' && window.__nearby.date === window.__verdict.date && document.querySelector('#v-extra .nb[data-state="done"]'), null, { timeout: 60000 });
  const chg = await p.evaluate(() => ({ ms: window.__nearby.ms, date: window.__verdict.date, n: window.__nearby.date, waiting: !!document.querySelector('#v-extra .nb-wait'), sync: window.__nearby.sync, maxSync: window.__nearby.maxSync }));
  check(chg.n === chg.date && chg.date !== '2027-05-20' && !chg.waiting && after.v === after.n, 'a click on another landing day updates the box to that day and it does not stay on "checking…"', `${'2027-05-20'} -> ${chg.date}`);
  console.log(`     TIMING day change 40 days on (uncached): click to finished box ${Date.now() - stamp} ms; inside the module ${chg.ms.wall} ms wall, ${chg.ms.busy} ms of work, longest piece ${chg.ms.maxPiece} ms`);
  // one day on (23 of 24 hours new)... and a day seen before is answered inside the same render
  await p.evaluate(() => document.querySelectorAll('#verdict .v-date button')[1].click()); // the next day
  await p.waitForFunction(() => window.__nearby.state === 'done' && window.__nearby.date === window.__verdict.date, null, { timeout: 60000 });
  const oneDay = await p.evaluate(() => window.__nearby.ms);
  console.log(`     TIMING day change by one day: ${oneDay.wall} ms wall, ${oneDay.busy} ms of work, longest piece ${oneDay.maxPiece} ms`);
  const sameRender = await p.evaluate(() => { const i = document.getElementById('v-day'); i.value = '2027-03-02'; i.dispatchEvent(new Event('change')); const nb = document.querySelector('#v-extra .nb'); return { state: nb.dataset.state, sync: window.__nearby.sync, date: window.__nearby.date }; });
  check(sameRender.state === 'done' && sameRender.date === '2027-03-02' && sameRender.sync < 25, 'a landing day seen before is answered inside the same render', `box "${sameRender.state}" at once, the render waited ${sameRender.sync} ms`);
  const st = await p.evaluate(() => ({ maxSync: window.__nearby.maxSync, pieces: window.__nearby.log.map((l) => l.maxPiece) }));
  check(st.maxSync < 25 && Math.max(...st.pieces) < 30, 'the render never waits for the work: the longest wait inside a render and the longest piece of work stay under 25 and 30 ms', `render wait ${st.maxSync} ms, piece ${Math.max(...st.pieces)} ms`);
  // a new day while the old work still runs: the old work is dropped and the box shows the last day
  const dropBefore = await p.evaluate(() => window.__nearby.dropped);
  const mid = await p.evaluate(() => { for (const d of ['2029-01-10', '2029-03-20']) { const i = document.getElementById('v-day'); i.value = d; i.dispatchEvent(new Event('change')); }
    return { state: window.__nearby.state, wait: !!document.querySelector('#v-extra .nb-wait'), date: window.__nearby.date }; }); // read in the same task: the work has not had a turn yet
  await done('2029-03-20');
  const dropAfter = await p.evaluate(() => window.__nearby.dropped), lastRead = await read();
  check(mid.state === 'checking' && mid.wait && dropAfter > dropBefore && lastRead.state === 'done', 'a new day while the old one is still being computed drops the old work and ends on the last day', `${JSON.stringify(mid)}, dropped jobs ${dropBefore} -> ${dropAfter}, ${lastRead.state}`);
  const mm2 = await mine(), ind2 = await indep(mm2.map((m) => ({ id: m.id, lat: m.lat, lon: m.lon })), '2029-03-20');
  check(ind2.every((x, k) => x.ok === mm2[k].ok && x.rows === mm2[k].rows), 'the dropped day left nothing behind: the last day equals the ordinary judgement too');

  // 6. the target verdict is not touched: the same site and days with the module replaced by its empty stub give the same __verdict
  const p2 = await ctx.newPage();
  await p2.route('**/src/nearby.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'export {};' }));
  p2.on('pageerror', (e) => errs.push('page error (stub): ' + e.message));
  await p2.goto(url); await ready(p2); await p2.waitForTimeout(3000);
  await p2.click('#sites li[data-id="mm"] button');
  await p2.waitForFunction(() => window.__app.S.siteId === 'mm' && window.__verdict, null, { timeout: 60000 });
  let equal = 0, tested = 0;
  for (const d of ['2030-10-01', '2027-04-14', '2026-12-05', '2027-02-10']) {
    await p2.fill('#v-day', d); await p2.waitForFunction((d) => window.__verdict.date === d, d, { timeout: 30000 });
    const v = await p2.evaluate(() => JSON.stringify(window.__verdict)); tested++; if (v === verdicts[d]) equal++; else console.log(`     DIFF verdict ${d}\n        with the module  ${verdicts[d]}\n        without          ${v}`);
  }
  check(equal === tested && tested === 4, 'the target verdict (__verdict: survived or lost, every row) is identical with and without the module', `${equal}/${tested}`);
  check(await p2.evaluate(() => !window.__nearby && !document.querySelector('.nb')), 'without the module there is no box (the comparison page really ran without it)');
  await p2.close();

  // 7. texts: the English words, then Russian and Kyrgyz after pressing the language buttons
  await p.bringToFront();
  await setDay('2030-10-01'); // target survives, 5 of 8 around
  const en = await read();
  check(en.title === 'What if we land 1 km off?' && en.say === '5 of 8 spots 1 km around also survive.' && /^Each of the 8 spots is judged with the same survival rule/.test(en.tip), 'English: title, sentence and tooltip', `${en.title} | ${en.say}`);
  check(/320 m/.test(en.tip) && /80 m/.test(en.tip) && /own slope/.test(en.tip) && /640 m/.test(en.tip) && /100 m precision/.test(en.tip) && /not judged on equal terms/.test(en.tip) && !/["<]/.test(en.tip) && en.tabindex === '0', 'the tooltip names the 320 m against 80 m terrain, the slope used, the unequal terms and the 1 km against 100 m limit; it is focusable', en.tip.slice(0, 80) + '…');
  await fits('en');
  await shot('2-en');
  for (const [l, re, say] of [['ru', /[а-яё]/i, /^В 5 из 8 мест/], ['ky', /[а-яёңүө]/i, /^1 км тегерегиндеги 8 жердин 5 жеринде/]]) {
    await p.click(`#lang button[data-l="${l}"]`);
    await p.waitForFunction(() => window.__nearby.state === 'done' && document.querySelector('#v-extra .nb[data-state="done"]'), null, { timeout: 30000 });
    const t = await read();
    check(re.test(t.title) && say.test(t.say) && !/[{}]/.test(t.say + t.tip) && re.test(t.tip) && !/Checking|survive/.test(t.text), `${l}: title, sentence and tooltip are in ${l}`, t.say);
    const marks = await p.evaluate(() => [...document.querySelectorAll('#v-extra .nb-m title')].map((x) => x.textContent));
    check(marks.length === 9 && marks.every((m) => re.test(m)) && !marks.some((m) => /[{}]/.test(m)), `${l}: every mark has its own name in ${l}`, marks[0]);
    await fits(l);
    if (l === 'ky') await shot('3-ky');
    // the unit of the sentence, every case of it, in this language: no placeholder left
    const all = await p.evaluate(() => { const w = window.__nearby.words, mk = (ids) => window.__nearby.DIRS.map(([id]) => ({ id, ok: ids.includes(id) })), I = window.I18n, out = [];
      for (const [ids, ok] of [[[], true], [[], false], [['N', 'E', 'S', 'W', 'NE', 'SE', 'SW', 'NW'], true], [['NE'], false], [['NE', 'S'], false], [['W'], true], [['W', 'E'], true], [['N', 'E', 'S', 'W', 'NE', 'SE', 'SW', 'NW'], false]]) { const x = w(mk(ids), ok); out.push(I.t(x.key, x.vars)); } return out; });
    check(all.length === 8 && all.every((s) => s && !/[{}]/.test(s)) && new Set(all).size === 8, `${l}: all 8 sentences of the box read in full and differ`, all.slice(3, 5).join(' / '));
  }
  await p.click('#lang button[data-l="en"]');
  await p.waitForFunction(() => window.__nearby.state === 'done' && document.querySelector('#v-extra .nb[data-state="done"]'), null, { timeout: 30000 });
  const allEn = await p.evaluate(() => { const w = window.__nearby.words, mk = (ids) => window.__nearby.DIRS.map(([id]) => ({ id, ok: ids.includes(id) })), I = window.I18n;
    return [[[], true], [[], false], [['N', 'E', 'S', 'W', 'NE', 'SE', 'SW', 'NW'], true], [['NE'], false], [['NE', 'S'], false], [['W'], true], [['W', 'E'], true]].map(([ids, ok]) => I.t(w(mk(ids), ok).key, w(mk(ids), ok).vars)); });
  check(JSON.stringify(allEn) === JSON.stringify(['Only the target survives. None of the 8 spots 1 km around does.', 'All 8 spots 1 km around are lost too.', 'All 8 spots 1 km around survive too.', '1 km to the north east this landing survives.', '2 of 8 spots 1 km around survive, for example 1 km to the north east.', '1 of 8 spots 1 km around also survives.', '2 of 8 spots 1 km around also survive.']), 'English sentences: the target survives and none around, all lost, all agree, one neighbour saves a lost target, two do, one or two survive with the target', allEn.join(' | '));

  // 8. a real case where the target is lost and a neighbour survives, read from the page
  await openSite('nb');
  await setDay('2027-02-10');
  const nbR = await read(), nbV = await p.evaluate(() => window.__verdict.ok);
  const nbInd = await indep(await p.evaluate(() => window.__nearby.results.map((m) => ({ id: m.id, lat: m.lat, lon: m.lon }))), '2027-02-10'), nbMine = await mine();
  check(nbV === false && nbR.solid >= 1 && /^(1 km to the .* this landing survives\.|\d of 8 spots 1 km around survive, for example 1 km to the .*\.)$/.test(nbR.say) && nbInd.every((x, k) => x.ok === nbMine[k].ok && x.rows === nbMine[k].rows), 'Nobile rim on 2027-02-10: the target is lost, a neighbour survives, the sentence names where, and every neighbour equals the ordinary judgement', nbR.say);
  await fits('nobile');

  // 9. the tooltip stays on the screen
  await p.hover('#v-extra .nb .tip');
  const tip = await p.evaluate(() => { const e = document.querySelector('#v-extra .nb .tip'), r = e.getBoundingClientRect(), a = getComputedStyle(e, '::after'); return { left: r.left, w: parseFloat(a.width), disp: a.content !== 'none', tt: a.textTransform, W: window.innerWidth }; });
  check(tip.disp && tip.left + tip.w <= tip.W && tip.tt === 'none', 'the open tooltip stays inside the screen width and is not in capitals', JSON.stringify(tip));
  await shot('4-tooltip');

  // 10. outside the polar terrain: nothing to judge, one muted line, no marks
  const far = await p.evaluate(async () => { const e = await window.__app.kid.addCustom(30, 10, null); await window.__app.kid.enterSite(e.id, 'databook'); return e.id; });
  await p.waitForFunction(() => document.querySelector('#v-extra .nb-far'), null, { timeout: 30000 });
  const fr = await read();
  check(fr.far && fr.marks === 0 && fr.text === 'Spots around the target are only checked near the south pole.' && (await p.evaluate(() => window.__nearby.state)) === 'far', 'a point far from the south pole shows one muted line and no marks', fr.text);
  await fits('far');

  check(errs.length === 0, 'no page errors', errs.join(' | '));
  await b.close(); if (srv) srv.close();
  if (fails.length) { console.error(`FAIL ${fails.length} check(s): ${fails.join('; ')}`); process.exit(1); }
  console.log(`nearby spots work at ${TAG}`);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
