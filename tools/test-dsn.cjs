// Dishes on Earth test. Run: node tools/test-dsn.cjs
//   BASE_URL=https://...   test a deployed site instead of the local app folder
//   VIEWPORT=390x844       window size (default 1440x900)
//   SHOTS=/some/dir        where screenshots go (default: dsn-shots in the system temp folder)
// One line per check; exit code 1 on any failed check or page error.
// The geometry is checked here in Node, by another route than the page takes: the page rotates the Moon's J2000 vector into the
// observer's horizon frame (Rotation_EQJ_HOR); this file takes the Moon of date, the sidereal time and the observer's position
// and normal by hand, and takes the altitude from a dot product.
const fs = require('fs');
const os = require('os');
const path = require('path');
const A = require('astronomy-engine');
const { chromium } = require('playwright-core');
const { serve, launch } = require('./smoke.cjs');

const [VW, VH] = (process.env.VIEWPORT || '1440x900').split('x').map(Number);
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'dsn-shots');
const TAG = `${VW}x${VH}`;
const INDEX = require('../app/data/index.json');
const site = (id) => INDEX.sites.find((s) => s.id === id);
const fails = [];
const check = (ok, name, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); if (!ok) fails.push(name); };
const DAY = 86400, D2R = Math.PI / 180;
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// The three complexes as the app states them (the app lists the source; this test reads them from the page, so a changed number is caught by the checks below).
const NAMES = { goldstone: 'Goldstone', madrid: 'Madrid', canberra: 'Canberra' };
const F = 1 / 298.257223563, RE = 6378.137, KM_AU = 149597870.7;

// Altitude of the Moon (degrees, no refraction) seen from a point on Earth, by hand.
function moonAlt(unixSec, lat, lon) {
  const t = A.MakeTime(new Date(unixSec * 1000));
  const m = A.RotateVector(A.Rotation_EQJ_EQD(t), A.GeoVector(A.Body.Moon, t, false)); // Moon, equator of date, AU
  const theta = (A.SiderealTime(t) * 15 + lon) * D2R, phi = lat * D2R;                   // local sidereal angle, geodetic latitude
  const phiG = Math.atan((1 - F) ** 2 * Math.tan(phi)), rho = RE * (1 - F * Math.sin(phi) ** 2); // geocentric latitude, radius (km)
  const o = [rho * Math.cos(phiG) * Math.cos(theta), rho * Math.cos(phiG) * Math.sin(theta), rho * Math.sin(phiG)];
  const s = [m.x * KM_AU - o[0], m.y * KM_AU - o[1], m.z * KM_AU - o[2]], len = Math.hypot(...s);
  const up = [Math.cos(phi) * Math.cos(theta), Math.cos(phi) * Math.sin(theta), Math.sin(phi)];
  return Math.asin((s[0] * up[0] + s[1] * up[1] + s[2] * up[2]) / len) / D2R;
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const srv = process.env.BASE_URL ? null : await serve(path.join(__dirname, '..', 'app'));
  const url = process.env.BASE_URL || `http://127.0.0.1:${srv.address().port}/`;
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: VW, height: VH } });
  await ctx.addInitScript(() => { try { localStorage.setItem('kidHelp', 'off'); } catch (e) { /* no storage */ } }); // the first visit help has its own test (test-tour.cjs)
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', (e) => errs.push('page error: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && /verdict plug-in/.test(m.text())) errs.push('a plug-in threw: ' + m.text()); }); // the host catches a throwing plug-in and logs it
  p.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(url.replace(/\/$/, ''))) errs.push(`${r.status()} ${r.url()}`); });
  const shot = (name) => p.screenshot({ path: path.join(SHOTS, `dsn-${TAG}-${name}.png`) });
  const line = () => p.evaluate(() => { const e = document.querySelector('#verdict #v-extra .v-dsn'); return e && { text: e.textContent, tip: e.querySelector('.tip')?.dataset.tip || '', tipTab: e.querySelector('.tip')?.getAttribute('tabindex'), tipCls: e.querySelector('.tip')?.className, busy: e.hasAttribute('aria-busy') }; });
  const settle = (date) => p.waitForFunction((d) => window.__verdict && window.__verdict.date === d && window.__dsn && window.__dsn.done && window.__dsn.t === Date.parse(d + 'T00:00:00Z') / 1000, date, { timeout: 60000 });
  const toDate = async (date) => { await p.fill('#v-day', date); await settle(date); };
  const dsn = () => p.evaluate(() => { const d = window.__dsn, { fn, alts, ...rest } = d; return rest; });

  await p.goto(url);
  await p.waitForFunction(() => window.__all && window.__all.ready, null, { timeout: 120000 });
  await p.waitForTimeout(1500);

  // 1. Open a site with real clicks: the line is in the answer panel, under the checks, and says what __dsn says.
  await p.locator('#sites li[data-id="cr"] button').click();
  await p.waitForFunction(() => window.__verdict && document.body.classList.contains('mode-surface') && window.__dsn && window.__dsn.done, null, { timeout: 90000 });
  const st = await dsn(), first = await line();
  check(!!first && first.tipCls === 'tip' && first.tipTab === '0' && first.tip.length > 100, 'the line sits in the answer panel with a tip (class tip, tabindex 0, data-tip)', first && first.text.slice(0, 60));
  check(first && first.text === st.line, 'the line shown is the line __dsn holds', first && first.text);
  const sayRe = /^Dish on Earth: a dish can see the Moon for (100%|over 99%|less than 1%|\d{1,2}%) of the hours Earth is in view\. At landing: (none|(Goldstone|Madrid|Canberra)(, (Goldstone|Madrid|Canberra))*)\.$/;
  const noEarthRe = /^Dish on Earth: Earth never rises over the horizon here during this stay, so there is nothing for a dish to hear\.$/;
  check(sayRe.test(first.text) || noEarthRe.test(first.text), 'the line has the wording from the brief (share of radio hours, then where at landing)', first.text);
  const order = await p.evaluate(() => { const x = document.querySelector('#v-extra'), t = document.querySelector('#verdict .v-rows'); return !!(t.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING) && x.parentElement.id === 'verdict'; });
  check(order, 'the line is under the table of checks');
  console.log(`     ${INDEX.sites.find((s) => s.id === 'cr').name}, landing ${st.site ? iso(st.t) : ''}, ${st.W} h: ${st.radioHours} radio hours, a dish sees the Moon in ${st.upHours}; at landing ${st.landing.join(', ') || 'none'}; first fill ${st.cost.ms.toFixed(1)} ms in all, longest slice ${st.cost.slice.toFixed(1)} ms`);
  check(st.cost.slice < 30, 'the first fill never holds the page for more than 30 ms in one go', `${st.cost.slice.toFixed(1)} ms (total ${st.cost.ms.toFixed(1)} ms for ${st.radioHours + 1} hours)`);
  // the tooltip says what the brief asks, in plain words, with the source
  const tip = first.tip;
  check(/geometry only/i.test(tip) && /10°/.test(tip) && /our own planning value, not a NASA rule/.test(tip) && /scheduled pass/.test(tip) && /link budget/.test(tip) && /120°/.test(tip) && /almost always in view of at least one/.test(tip) && /usually near 100%/.test(tip) && /eyes\.nasa\.gov\/dsn\/config\.xml/.test(tip) && !/["<]/.test(tip), 'the tooltip states: geometry only, 10° is our own value, a scheduled pass and a link budget are needed, three sites 120° apart, source', tip.slice(0, 80) + '...');
  check(!/[\u2013\u2014]|--/.test(first.text + tip), 'no dash used as punctuation in the line or the tip');
  await shot('1-line');

  // 2. Geometry in Node, independent of the page. Every hour of the stay: the Moon's altitude at each complex, and the flags the page used.
  const page = await p.evaluate(async () => {
    const d = window.__dsn, { loadSky } = await import('./src/data.js'), sky = await loadSky(d.site), n = d.i1 - d.i0;
    const earth = Array.from({ length: n }, (_, k) => sky.ch.earthVis[d.i0 + k] > 0.5 ? 1 : 0);
    const alts = Array.from({ length: n }, (_, k) => d.alts(d.hour0 + k));
    return { earth, alts, mask: d.mask, hour0: d.hour0, cx: d.complexes.map((c) => ({ id: c.id, lat: c.lat, lon: c.lon })), radio: d.radioHours, up: d.upHours, landing: d.landing, share: d.share, W: d.W, n };
  });
  const names = page.cx.map((c) => c.id);
  check(names.join() === 'goldstone,madrid,canberra' && page.cx.every((c) => Math.abs(c.lat) < 90 && Math.abs(c.lon) <= 180), 'the page names the three complexes, Goldstone, Madrid and Canberra', JSON.stringify(page.cx.map((c) => [c.id, c.lat, c.lon])));
  const near = (c, id, lat, lon) => c.id === id && Math.abs(c.lat - lat) < 0.3 && Math.abs(c.lon - lon) < 0.3;
  check(near(page.cx[0], 'goldstone', 35.3, -116.9) && near(page.cx[1], 'madrid', 40.4, -4.2) && near(page.cx[2], 'canberra', -35.4, 149.1), 'the coordinates are the known places (Goldstone near 35.3 N 116.9 W, Madrid near 40.4 N 4.2 W, Canberra near 35.4 S 149.1 E)');
  let worst = 0, flagsBad = 0, edge = 0, nodeRadio = 0, nodeSeen = 0, pageSeenAgain = 0;
  for (let k = 0; k < page.n; k++) {
    const sec = (page.hour0 + k) * 3600, alt = page.cx.map((c) => moonAlt(sec, c.lat, c.lon));
    for (let j = 0; j < 3; j++) worst = Math.max(worst, Math.abs(alt[j] - page.alts[k][j]));
    if (!page.earth[k]) { if (page.mask[k] !== 0) flagsBad++; continue; }
    nodeRadio++;
    if (!(page.mask[k] & 8)) flagsBad++;
    if (page.mask[k] & 7) pageSeenAgain++;
    // an hour that the two routes could split on (within 0.1° of the threshold) is not held against the page
    const mine = alt.some((a) => a >= 10), theirs = (page.mask[k] & 7) !== 0, borderline = alt.some((a) => Math.abs(a - 10) < 0.1);
    if (mine) nodeSeen++;
    if (mine !== theirs && !borderline) flagsBad++;
    if (borderline) edge++;
    for (let j = 0; j < 3; j++) if (!(Math.abs(alt[j] - 10) < 0.1) && ((alt[j] >= 10) !== !!(page.mask[k] & (1 << j)))) flagsBad++;
  }
  check(worst < 0.05 && page.n >= 24, 'the Moon altitude at the three complexes agrees with the hand computation in Node, every hour of the stay', `${page.n} hours (${page.cx.length} complexes each), worst difference ${worst.toFixed(4)}°`);
  check(flagsBad === 0, 'every hour is flagged as the Node geometry says (Earth hidden: nothing counted; Earth in view: each complex up at 10° or more)', `${flagsBad} wrong, ${edge} within 0.1° of 10° left out`);
  check(nodeRadio === page.radio && pageSeenAgain === page.up, 'the radio hours and the hours a dish sees the Moon add up', `radio ${nodeRadio} = ${page.radio}, seen ${page.up} (Node ${nodeSeen})`);
  check(Math.abs(nodeSeen - page.up) <= edge, 'the share of radio hours agrees with Node, up to the hours on the 10° edge', `page ${(page.share * 100).toFixed(1)}%, Node ${(nodeSeen / nodeRadio * 100).toFixed(1)}%`);
  { const want = page.share === 1 ? '100%' : page.share >= 0.995 ? 'over 99%' : page.share > 0 && page.share < 0.005 ? 'less than 1%' : Math.round(page.share * 100) + '%';
    check(first.text.includes(`for ${want} of the hours`), 'the percentage on screen is the share rounded', `${want}`); }
  const land = page.cx.filter((c) => moonAlt(page.hour0 * 3600, c.lat, c.lon) >= 10).map((c) => c.id);
  check(JSON.stringify(land) === JSON.stringify(page.landing) || page.cx.some((c) => Math.abs(moonAlt(page.hour0 * 3600, c.lat, c.lon) - 10) < 0.1), 'the complexes named "At landing" are the ones with the Moon up in Node', `${land.join(', ') || 'none'}`);

  // 3. A fact that can fail: the complex on the far side of Earth from the Moon is NOT counted. Find, in Node, landing moments (00:00 UTC) with the Moon
  //    high over one complex and below the horizon at both others, then land there with a real date change and read the line.
  const lo = await p.evaluate(() => document.getElementById('v-day').min), hi = await p.evaluate(() => document.getElementById('v-day').max);
  const picks = {};
  for (let t = Math.max(Date.parse('2027-01-01T00:00:00Z'), Date.parse(lo + 'T00:00:00Z')) / 1000; t < Math.min(Date.parse('2027-12-31T00:00:00Z'), Date.parse(hi + 'T00:00:00Z')) / 1000; t += DAY) {
    const alt = page.cx.map((c) => moonAlt(t, c.lat, c.lon));
    for (let j = 0; j < 3; j++) if (alt[j] >= 40 && alt.every((a, i) => i === j || a < -10) && !picks[names[j]]) picks[names[j]] = { t, alt };
  }
  const nPicks = Object.keys(picks).length;
  check(!!picks.madrid && !!picks.canberra, 'Node finds landing moments with the Moon high over one complex and below the horizon at the other two', Object.entries(picks).map(([k, v]) => `${k} ${iso(v.t)} ${v.alt.map((a) => a.toFixed(0)).join('/')}`).join('; '));
  for (const [id, pk] of Object.entries(picks)) {
    await toDate(iso(pk.t));
    const l = await line(), d = await dsn(), others = names.filter((n) => n !== id).map((n) => NAMES[n]);
    check(JSON.stringify(d.landing) === JSON.stringify([id]) && l.text.endsWith(`At landing: ${NAMES[id]}.`) && others.every((o) => !l.text.includes(o)) && d.landingAlts[names.indexOf(id)] >= 40 && others.every((o, i) => d.landingAlts[names.indexOf(o.toLowerCase())] < 0),
      `Moon over ${NAMES[id]} on ${iso(pk.t)}: only ${NAMES[id]} is counted at landing, the far side is not`, `${l.text.replace(/^.*(At landing)/, '$1')} (Moon altitude ${d.landingAlts.map((a) => a.toFixed(0)).join('/')})`);
  }
  if (nPicks) await shot('2-far-side');

  // 4. The verdict is the same with and without the line: record survived or lost and every check row on days of both kinds, remove the plug-in, record again.
  const days = await p.evaluate(() => { const ok = [...document.querySelectorAll('.days .day.ok')].map((b) => +b.dataset.t), bad = [...document.querySelectorAll('.days .day.bad')].map((b) => +b.dataset.t), pick = (a) => a.filter((_, i) => i % Math.max(1, Math.floor(a.length / 4)) === 0).slice(0, 4); return [...pick(ok), ...pick(bad)]; });
  const read = async (t) => { await toDate(iso(t)); return p.evaluate(() => ({ date: window.__verdict.date, ok: window.__verdict.ok, rows: JSON.stringify(window.__verdict.rows), head: document.querySelector('.v-head b').textContent, strip: document.querySelector('.days').innerHTML, why: document.querySelector('.v-why').textContent, line: !!document.querySelector('.v-dsn') })); };
  const withLine = []; for (const t of days) withLine.push(await read(t));
  await p.evaluate(() => { const f = window.__dsn.fn, i = globalThis.VerdictExtras.indexOf(f); globalThis.VerdictExtras.splice(i, 1); window.__dsnRemoved = i; });
  await p.locator('#lang button[data-l="en"]').click(); // draws the panel again, now without the plug-in
  const without = [];
  for (const t of days) { await p.fill('#v-day', iso(t)); await p.waitForFunction((d) => window.__verdict.date === d, iso(t)); without.push(await p.evaluate(() => ({ date: window.__verdict.date, ok: window.__verdict.ok, rows: JSON.stringify(window.__verdict.rows), head: document.querySelector('.v-head b').textContent, strip: document.querySelector('.days').innerHTML, why: document.querySelector('.v-why').textContent, line: !!document.querySelector('.v-dsn') }))); }
  const survived = withLine.filter((x) => x.ok).length, lost = withLine.length - survived;
  check(days.length >= 2 && survived >= 1 && lost >= 1, 'days of both kinds were compared', `${survived} survived, ${lost} lost`);
  check(withLine.every((x, i) => x.ok === without[i].ok && x.rows === without[i].rows && x.head === without[i].head && x.strip === without[i].strip && x.why === without[i].why && x.date === without[i].date), 'survived or lost, every check row, the head, the reason and the strip of days are the same with and without the line', withLine.map((x) => (x.ok ? 'S' : 'L')).join(''));
  check(withLine.every((x) => x.line) && without.every((x) => !x.line), 'the line is there with the plug-in and gone without it');
  await p.reload(); // the address keeps the site, so the page opens on it again, with the plug-in back
  await p.waitForFunction(() => window.__verdict && document.body.classList.contains('mode-surface') && window.__dsn && window.__dsn.done, null, { timeout: 90000 });

  // 5. Cost: a first fill of a month is cut into short slices and then cached; stepping a day is nearly free; going back is free.
  const t1 = await p.evaluate(() => window.__dsn.t);
  await p.locator('.v-date > button', { hasText: '+1' }).filter({ hasText: /month|ай|мес/i }).first().click();
  await p.waitForFunction((t) => window.__dsn.done && window.__dsn.t > t, t1, { timeout: 60000 });
  const jump = await dsn();
  await p.locator('.v-date > button').nth(1).click(); // next day
  await p.waitForFunction((t) => window.__dsn.done && window.__dsn.t > t, jump.t, { timeout: 60000 });
  const step = await dsn();
  await p.locator('.v-date > button').first().click(); // back a day: from the memory
  await p.waitForFunction((t) => window.__dsn.done && window.__dsn.t === t, jump.t, { timeout: 60000 });
  const back = await dsn();
  check(jump.cost.slice < 30 && step.cost.ms < 15 && back.cost.ms < 1, 'a month jump is sliced under 30 ms, a day step computes about a day, a step back costs nothing', `jump ${jump.cost.ms.toFixed(1)} ms in slices of at most ${jump.cost.slice.toFixed(1)} ms; next day ${step.cost.ms.toFixed(1)} ms; back ${back.cost.ms.toFixed(1)} ms`);

  // 6. Earth never in view: nothing for a dish to hear. (By a call: no real site has a hidden Earth for a whole stay in this period.) And Earth always in view.
  const syn = await p.evaluate(async () => { const d = window.__dsn, mk = (v, n) => ({ dir: 'synthetic-' + v, t0: d.hour0 * 3600, n, ch: { earthVis: new Float32Array(n).fill(v) } });
    const run = async (s, W) => { const box = document.createElement('div'); document.body.append(box); d.fn(box, { site: s, t: d.hour0 * 3600, W }, { rows: [], ok: true });
      for (let k = 0; k < 200 && box.querySelector('[aria-busy]'); k++) await new Promise((r) => setTimeout(r, 25)); const t = box.textContent; box.remove(); return t; };
    return { none: await run(mk(0, 200), 168), all: await run(mk(1, 800), 720) }; });
  check(noEarthRe.test(syn.none) && !/At landing/.test(syn.none), 'Earth never in view during the stay: the line says there is nothing for a dish to hear', syn.none);
  check(sayRe.test(syn.all) && /for (100%|over 99%|\d\d%) of/.test(syn.all), 'Earth in view all stay: a share and a landing place are given', syn.all);

  // 7. Languages: the line, its words and its tip change, with the same numbers.
  const enNow = (await line()).text;
  for (const [l, re, tipRe, label] of [['ru', /^Антенна на Земле: (антенна видит Луну (100%|более 99%|менее 1%|\d{1,2}%) часов из тех, когда видна Земля\. В момент посадки: (нет|(Голдстоун|Мадрид|Канберра)(, (Голдстоун|Мадрид|Канберра))*)\.|За время этой миссии Земля здесь ни разу не поднимается над горизонтом, поэтому антенне нечего слушать\.)$/, /Сети дальней космической связи NASA.*10°.*120°.*eyes\.nasa\.gov\/dsn\/config\.xml/, 'Russian'],
    ['ky', /^Жердеги антенна: (Жер көрүнүп турган сааттарда антенна Айды (100%|99 пайыздан көп|1 пайыздан аз|\d{1,2}%) убакытта көрө алат\. Конуу учурунда: (жок|(Голдстоун|Мадрид|Канберра)(, (Голдстоун|Мадрид|Канберра))*)\.|Бул миссия учурунда Жер бул жерде горизонттун үстүнө эч качан чыкпайт, ошондуктан антеннага угуучу эч нерсе жок\.)$/, /Терең космос тармагынын.*10°.*120°.*eyes\.nasa\.gov\/dsn\/config\.xml/, 'Kyrgyz']]) {
    await p.locator(`#lang button[data-l="${l}"]`).click();
    await p.waitForFunction(() => window.__dsn && window.__dsn.done);
    const t = await line();
    check(re.test(t.text) && tipRe.test(t.tip) && !/Dish on Earth|geometry only/.test(t.text + t.tip), `the line and its tip are in ${label}`, t.text);
    if (l === 'ky') await shot('3-ky');
  }
  await p.locator('#lang button[data-l="en"]').click();
  check((await line()).text === enNow, 'back in English the line reads as before', enNow);

  // 8. Nothing overflows: the line, the panel and the page stay inside the screen; the tip opens inside it too.
  // The panel may be a little wider than itself for reasons of its own (a month label at the end of the strip of days): only what the line adds counts.
  const fit = await p.evaluate(() => { const e = document.querySelector('.v-dsn'), r = e.getBoundingClientRect(), W = window.innerWidth, hud = e.closest('#hud') || e.closest('#verdict'), hr = hud.getBoundingClientRect(), tip = e.querySelector('.tip'), tr = tip.getBoundingClientRect(), tw = Math.min(300, 0.7 * W);
    const withLine = hud.scrollWidth, pageWith = document.documentElement.scrollWidth; e.style.display = 'none'; const without = hud.scrollWidth, pageWithout = document.documentElement.scrollWidth; e.style.display = '';
    return { ok: r.left >= 0 && r.right <= W && r.right <= hr.left + hud.clientWidth + 1 && e.scrollWidth <= e.clientWidth + 1 && withLine <= without && pageWith <= Math.max(W, pageWithout) && tr.left + tw <= W + 1, r: [r.left, r.right].map(Math.round), W, tipRight: Math.round(tr.left + tw), hud: [withLine, without, hud.clientWidth], page: [pageWith, pageWithout] }; });
  check(fit.ok, `nothing overflows at ${TAG}`, JSON.stringify(fit));
  await p.evaluate(() => { const e = document.querySelector('.v-dsn'); e.scrollIntoView({ block: 'center' }); e.querySelector('.tip').focus(); });
  await p.waitForTimeout(300);
  await shot('4-tip-open');
  const tipBox = await p.evaluate(() => { const tip = document.querySelector('.v-dsn .tip'); tip.focus(); const r = tip.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: window.innerHeight }; });
  check(tipBox.top > 0 && tipBox.bottom < tipBox.h, 'the line is on screen when its tip is open', JSON.stringify(tipBox));

  check(errs.length === 0, 'no page errors', errs.join(' | '));
  await b.close(); if (srv) srv.close();
  if (fails.length) { console.error(`FAIL ${fails.length} check(s): ${fails.join('; ')}`); process.exit(1); }
  console.log(`dishes on Earth work at ${TAG}`);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
