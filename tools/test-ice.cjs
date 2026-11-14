// Ice hunter test. Run: node tools/test-ice.cjs
//   BASE_URL=https://...   test a deployed site instead of the local app folder
//   VIEWPORT=390x844       window size (default 1440x900)
//   SHOTS=/some/dir        where screenshots go (default: ice-shots in the system temp folder)
// One line per check; exit code 1 on any failed check or page error.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright-core');
const { serve } = require('./smoke.cjs');

const [VW, VH] = (process.env.VIEWPORT || '1440x900').split('x').map(Number);
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'ice-shots');
const TAG = `${VW}x${VH}`;
const INDEX = require('../app/data/index.json');
const site = (id) => INDEX.sites.find((s) => s.id === id);
const fails = [];
const check = (ok, name, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); if (!ok) fails.push(name); };

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const srv = process.env.BASE_URL ? null : await serve(path.join(__dirname, '..', 'app'));
  const url = process.env.BASE_URL || `http://127.0.0.1:${srv.address().port}/`;
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const ctx = await b.newContext({ viewport: { width: VW, height: VH } });
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', (e) => errs.push('page error: ' + e.message));
  p.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(url.replace(/\/$/, ''))) errs.push(`${r.status()} ${r.url()}`); });
  const ready = async () => { await p.waitForFunction(() => window.__all && window.__all.ready && window.__ice, null, { timeout: 120000 }); };
  const shot = (name) => p.screenshot({ path: path.join(SHOTS, `ice-${TAG}-${name}.png`) });
  const card = () => p.evaluate(() => { const c = document.getElementById('ice-card'); return c.hidden ? null : { text: c.innerText, main: c.querySelector('.ice-main')?.textContent || '', head: c.querySelector('h3')?.textContent || '', big: c.querySelector('.ice-big')?.textContent || '', foot: c.querySelector('.ice-foot')?.textContent || '', sparks: c.querySelectorAll('.ice-sparks svg').length, link: c.querySelector('.ice-ctx a')?.href || '', ctx: c.querySelector('.ice-ctx')?.textContent || '', tag: c.querySelector('.ice-tag')?.textContent || '', stat: c.querySelector('.ice-stat')?.textContent || '', note: !!c.querySelector('details.ice-note:not([open])') }; });
  const fits = (name) => p.evaluate(() => { const r = document.getElementById('ice-card').getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight, c = document.getElementById('ice-card');
    return { ok: r.left >= 0 && r.right <= W && r.top >= 0 && r.bottom <= H && c.scrollWidth <= c.clientWidth + 1 && document.documentElement.scrollWidth <= W, r: [r.left, r.top, r.right, r.bottom].map(Math.round), W, H, sw: c.scrollWidth, cw: c.clientWidth }; })
    .then((f) => check(f.ok, `card fits the ${TAG} screen (${name})`, JSON.stringify(f.r)));
  const rows = () => p.evaluate(() => window.__all.rows.length);
  // The screen point of a Moon spot that is bare Moon (the canvas is the top element) with a latitude between lo and hi.
  const findSpot = (lo, hi) => p.evaluate(([lo, hi]) => { const cv = document.getElementById('gl'), r = cv.getBoundingClientRect();
    for (let y = 0.2; y < 0.8; y += 0.02) for (let x = 0.15; x < 0.85; x += 0.02) { const px = r.width * x, py = r.height * y;
      if (document.elementFromPoint(r.left + px, r.top + py) !== cv) continue;
      const at = window.__ov.pick(px, py, r.width, r.height); if (at && at.lat > lo && at.lat < hi) return { x: r.left + px, y: r.top + py, at }; } return null; }, [lo, hi]);
  // A clear screen point on the map that picks within `maxKm` of a prepared site (pins and panels may cover the exact point).
  const siteSpotNow = (s, maxKm) => p.evaluate(([la, lo, maxKm]) => { const ov = window.__ov, cv = document.getElementById('gl'), r = cv.getBoundingClientRect(), D = Math.PI / 180;
    const site = ov.sites.find((q) => Math.abs(q.lat - la) < 1e-6 && Math.abs(q.lon - lo) < 1e-6), v = site.pos.clone().project(ov.camera), cx = (v.x * 0.5 + 0.5) * r.width, cy = (-v.y * 0.5 + 0.5) * r.height;
    const dist = (a) => Math.acos(Math.min(1, Math.sin(la * D) * Math.sin(a.lat * D) + Math.cos(la * D) * Math.cos(a.lat * D) * Math.cos((lo - a.lon) * D))) * 1737.4;
    for (let d = 0; d <= 40; d += 2) for (let k = 0; k < (d ? 8 : 1); k++) { const px = cx + d * Math.cos(k * Math.PI / 4), py = cy + d * Math.sin(k * Math.PI / 4);
      if (px < 0 || py < 0 || px > r.width || py > r.height || document.elementFromPoint(r.left + px, r.top + py) !== cv) continue;
      const at = ov.pick(px, py, r.width, r.height); if (at && dist(at) < maxKm) return { x: r.left + px, y: r.top + py, at, km: dist(at) }; }
    return null; }, [s.lat, s.lon, maxKm]);
  // The labels of neighbouring sites shift with the turn of the Moon and may cover a spot: try the current turn, then a set of fixed ones.
  const siteSpot = async (s, maxKm = 2.5) => {
    for (const th of [null, 0, 45, 90, 135, 180, 225, 270, 315]) {
      if (th !== null) await p.evaluate((th) => { window.__app.S.held = true; window.__ov.theta = th; return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); }, th);
      const pt = await siteSpotNow(s, maxKm); if (pt) return pt;
    }
    return null;
  };
  // Why no clear point: what covers the site's spot on the screen (for the failure message).
  const whyNot = (s) => p.evaluate(([la, lo]) => { const ov = window.__ov, r = document.getElementById('gl').getBoundingClientRect(), q = ov.sites.find((x) => Math.abs(x.lat - la) < 1e-6 && Math.abs(x.lon - lo) < 1e-6), v = q.pos.clone().project(ov.camera), x = (v.x * 0.5 + 0.5) * r.width, y = (-v.y * 0.5 + 0.5) * r.height, e = document.elementFromPoint(x, y);
    return JSON.stringify({ x: Math.round(x), y: Math.round(y), top: e ? e.tagName + '#' + e.id + '.' + e.className : null, held: window.__app.S.held, dist: ov.dist }); }, [s.lat, s.lon]);
  const tap = async (pt) => { const n = await p.evaluate(() => window.__ice.results); await p.mouse.click(pt.x, pt.y); await p.waitForFunction((n) => window.__ice.results > n && window.__ice.phase === 'result', n, { timeout: 60000 }); };

  await p.goto(url);
  await ready();
  await p.waitForTimeout(4200); // the opening move ends

  // 0. the button sits in the column on the map, second place, and the card is closed
  const btn = await p.evaluate(() => { const e = document.getElementById('ice-btn'); return e && { inBar: e.parentElement.id === 'kidbar', cls: e.className, order: getComputedStyle(e).order, text: e.textContent.trim(), pressed: e.getAttribute('aria-pressed'), card: document.getElementById('ice-card').hidden }; });
  check(btn && btn.inBar && /kidbtn/.test(btn.cls) && btn.order === '2' && btn.pressed === 'false' && btn.card, 'Ice hunter button in #kidbar, order 2, mode off, no card', JSON.stringify(btn));

  // a. the judge: permanently dark crater floors, in the model's own words
  const darkSpots = [];
  for (const id of ['sf', 'ff']) {
    const s = site(id), r = await p.evaluate(([la, lo]) => window.__ice.judge(la, lo), [s.lat, s.lon]);
    if (r.dark) darkSpots.push(s);
    console.log(`     ${s.name}: model says ${r.dark ? 'dark' : 'lit ' + (r.share * 100).toFixed(2) + '%'} (${r.lit} of ${r.n} hours), prepared 80 m data says ${s.variants.databook.summary_full_period.pct_sunlit_any.toFixed(2)}% sunlit`);
    if (!r.dark) console.log(`NOTE the 320 m model does not call ${s.name} fully dark; the test does not bend the rule and uses a spot the model calls dark`);
  }
  check(darkSpots.length > 0, 'at least one known permanently dark crater floor is dark in the 320 m model', darkSpots.map((s) => s.name).join(', '));
  // b. a lit ridge: non zero share, equal to the share recomputed here from the hourly series of that spot
  const cr = site('cr');
  const ridge = await p.evaluate(async ([la, lo]) => { const r = await window.__ice.judge(la, lo), { loadSky } = await import('./src/data.js'), sky = await loadSky('ice');
    let lit = 0; for (let i = 0; i < sky.n; i++) if (sky.ch.sunFrac[i] > 0) lit++; return { r, lit, n: sky.n }; }, [cr.lat, cr.lon]);
  check(ridge.r.lit > 0 && !ridge.r.dark && ridge.lit === ridge.r.lit && ridge.n === ridge.r.n, 'Connecting ridge is lit; the judge counts the same hours as the hourly series', `${(ridge.lit / ridge.n * 100).toFixed(2)}% (${ridge.lit} of ${ridge.n})`);
  const ref = cr.variants.databook.summary_full_period.pct_sunlit_any;
  check(Math.abs(ridge.lit / ridge.n * 100 - ref) < 15, 'Connecting ridge share is close to the prepared 80 m site', `320 m model ${(ridge.lit / ridge.n * 100).toFixed(1)}% vs prepared ${ref.toFixed(1)}%`);
  check(await p.evaluate(() => { const w = window.__ice.shareWords; return [{ lit: 0, n: 100, share: 0 }, { lit: 1, n: 1000, share: 0.001 }, { lit: 999, n: 1000, share: 0.999 }, { lit: 40, n: 100, share: 0.4 }].map((x) => w(x).key + (w(x).vars ? w(x).vars.p : '')).join() === 'kIDark,kILitLess,kILitMost,kILit40%'; }), 'wording rules: dark, less than 1%, over 99%, and a plain share');

  // c. the mode: hint, cursor, a tap is ours (no row), a looking state, a result card
  await p.click('#ice-btn');
  const on = await p.evaluate(() => ({ on: window.__ice.on, pressed: document.getElementById('ice-btn').getAttribute('aria-pressed'), cls: document.getElementById('ice-btn').classList.contains('on'), cursor: getComputedStyle(document.getElementById('gl')).cursor }));
  check(on.on && on.pressed === 'true' && on.cls && on.cursor === 'crosshair', 'mode on: button lit, cursor is a crosshair', JSON.stringify(on));
  const hint = await card();
  check(hint && /Tap a dark spot near the pole/.test(hint.big), 'the hint says what to do', hint && hint.big);
  await fits('hint');
  await shot('1-mode-on-hint');
  const rows0 = await rows();
  // the Moon turns slowly: a marker must keep its spot while it does
  const lookSpot = await findSpot(-87, -84);
  if (!lookSpot) throw new Error('no bare Moon to click');
  const phases = await p.evaluate(({ la, lo }) => { const pr = window.__ice.hunt(la, lo), ph = window.__ice.phase, txt = document.getElementById('ice-card').innerText, spin = !!document.querySelector('#ice-card .ice-spin'), mk = window.__ice.marks.map((m) => m.cls).join();
    return pr.then(() => ({ ph, txt, spin, mk, after: window.__ice.phase })); }, { la: lookSpot.at.lat, lo: lookSpot.at.lon });
  check(phases.ph === 'looking' && phases.spin && /Checking the Sun/.test(phases.txt) && /looking$/.test(phases.mk) && phases.after === 'result', 'a tap shows a looking state (card and marker) and then the result', `${phases.ph} -> ${phases.after}`);
  await p.evaluate(() => { window.__app.S.held = false; });
  const m0 = await p.evaluate(() => { const i = window.__ice.marks.length - 1; return { i, xy: window.__ice.markXY(i), el: (() => { const e = document.querySelectorAll('.ice-mark')[i]; return { l: parseFloat(e.style.left), t: parseFloat(e.style.top), shown: e.style.display !== 'none' }; })() }; });
  await p.waitForTimeout(1500);
  const m1 = await p.evaluate((i) => { const e = document.querySelectorAll('.ice-mark')[i], xy = window.__ice.markXY(i); return { xy, l: parseFloat(e.style.left), t: parseFloat(e.style.top), shown: e.style.display !== 'none' }; }, m0.i);
  check(m1.shown && Math.hypot(m1.l - m1.xy.x, m1.t - m1.xy.y) < 3 && Math.hypot(m1.xy.x - m0.xy.x, m1.xy.y - m0.xy.y) > 2, 'the marker follows its Moon spot while the Moon turns', `moved ${Math.hypot(m1.xy.x - m0.xy.x, m1.xy.y - m0.xy.y).toFixed(1)} px, off its spot by ${Math.hypot(m1.l - m1.xy.x, m1.t - m1.xy.y).toFixed(2)} px`);
  await p.evaluate(() => { window.__app.S.held = true; }); // stop the turn: clicks must land where they were aimed

  // c. a real click with the mode on: a result card, no row in the grid
  const clk = await findSpot(-87.5, -84.5);
  const before = await p.evaluate(() => window.__ice.results);
  await tap(clk);
  const res = await card(), rowsMode = await rows();
  check(res && /^(The Sun never reaches here!|The Sun reaches this spot\.)$/.test(res.head) && (await p.evaluate(() => window.__ice.results)) > before, 'a real click with the mode on gives a result card', res && res.head);
  check(rowsMode === rows0, 'the ice tap added no row to the grid', `${rows0} -> ${rowsMode}`);
  await fits('result');

  // the dark crater floor by a real click: sparkle, the words, the NASA line and link, a closed note, the counter
  let darkClick = null;
  for (const s of darkSpots) {
    const pt = await siteSpot(s); if (!pt) { console.log(`NOTE no clear screen point for ${s.name} (covered by a label or a panel)`); continue; }
    await tap(pt); const r = await p.evaluate(() => window.__ice.last);
    if (r.dark) { darkClick = { s, pt, r }; break; }
    console.log(`NOTE a click near ${s.name} landed on a spot the model calls lit; trying the next floor`);
  }
  check(!!darkClick, 'a real click on a permanently dark crater floor gives a dark result', darkClick && `${darkClick.s.name}, ${darkClick.pt.km.toFixed(2)} km from the site point`);
  const dark = await card();
  const [ya, yb] = await p.evaluate(() => [2021, 2031]);
  check(dark.head === 'The Sun never reaches here!' && dark.sparks === 3 && dark.main === `This spot did not see the Sun once from ${ya} to ${yb} in our model. Water ice could hide in places like this.`, 'dark card: sparkle and the exact sentence, with "could"', dark.main);
  check(/LCROSS/.test(dark.ctx) && /Cabeus/.test(dark.ctx) && dark.link === 'https://science.nasa.gov/mission/lcross/', 'dark card: one line of NASA context with a source link', dark.link);
  check(dark.note && !/there is ice|has ice/i.test(dark.text), 'the honest note is closed; nothing says "there is ice"');
  const mk = await p.evaluate(() => { const m = window.__ice.marks.at(-1), e = [...document.querySelectorAll('.ice-mark')].at(-1), r = e.getBoundingClientRect(); return { cls: m.cls, shown: e.style.display !== 'none', x: r.left, y: r.top, svg: !!e.querySelector('svg') }; });
  check(mk.cls === 'dark' && mk.shown && mk.svg && Math.hypot(mk.x - darkClick.pt.x, mk.y - darkClick.pt.y) < 25, 'a sparkle marker stands on the tapped spot', `${Math.hypot(mk.x - darkClick.pt.x, mk.y - darkClick.pt.y).toFixed(1)} px from the click`);
  await fits('dark');
  await p.waitForTimeout(1000); // the marker pops in for 0.6 s
  await shot('2-dark-result');

  // d. the counter: counts a distinct dark spot once, survives a reload
  const c1 = await p.evaluate(() => ({ n: window.__ice.count, ls: JSON.parse(localStorage.getItem('iceFound') || '[]').length, badge: document.querySelector('.ice-badge').textContent }));
  const foot1 = (await card()).foot;
  check(c1.n >= 1 && c1.ls === c1.n && c1.badge === String(c1.n) && foot1 === `Ice spots found: ${c1.n}` && /New spot!/.test(dark.tag), 'the counter went up on a dark spot and is stored', `${foot1}; ${dark.tag}`);
  await tap(darkClick.pt);
  const again = await card(), c2 = await p.evaluate(() => window.__ice.count);
  check(c2 === c1.n && /already/.test(again.tag), 'tapping the same dark spot again does not count twice', `${c2}, "${again.tag}"`);
  if (darkSpots.length > 1) {
    const other = darkSpots.find((s) => s !== darkClick.s), pt = await siteSpot(other);
    if (pt) { await tap(pt); const r = await p.evaluate(() => window.__ice.last), c3 = await p.evaluate(() => window.__ice.count);
      check(r.dark ? c3 === c1.n + 1 : c3 === c1.n, 'a second, distinct dark spot counts as another one', `${other.name}: ${c3}`); }
  }
  const litPt = await siteSpot(cr, 3), cBefore = await p.evaluate(() => window.__ice.count);
  check(!!litPt, 'a clear screen point on Connecting ridge', litPt ? `${litPt.km.toFixed(2)} km from the site point` : await whyNot(cr));
if (!litPt) throw new Error('cannot continue without a screen point on Connecting ridge');
  await tap(litPt);
  const lit = await card(), litData = await p.evaluate(async () => { const { loadSky } = await import('./src/data.js'), sky = await loadSky('ice'), r = window.__ice.last; let n = 0; for (let i = 0; i < sky.n; i++) if (sky.ch.sunFrac[i] > 0) n++; return { n, total: sky.n, lit: r.lit, dark: r.dark }; });
  const pct = (litData.n / litData.total) * 100, want = pct < 1 ? 'less than 1%' : litData.n < litData.total && pct >= 99.5 ? 'over 99%' : Math.round(pct) + '%';
  check(!litData.dark && lit.head === 'The Sun reaches this spot.' && lit.main === `The Sun reached here for ${want} of the time: too warm for ice to stay.` && litData.n === litData.lit, 'lit card: the share shown equals the share recomputed from the hourly series', lit.main);
  check((await p.evaluate(() => window.__ice.count)) === cBefore, 'a lit spot does not add to the counter');
  check(lit.stat.includes(`${litData.n}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')) && /Hours with Sun/.test(lit.stat), 'lit card shows the hours behind the share', lit.stat);
  await fits('lit');
  await p.waitForTimeout(1000);
  await shot('3-lit-result');

  // outside the polar terrain: a friendly line, no verdict, no marker
  const farSpot = await findSpot(-80, 90);
  const marks0 = await p.evaluate(() => window.__ice.marks.length), cF = await p.evaluate(() => window.__ice.count);
  if (farSpot) await tap(farSpot); else await p.evaluate(() => window.__ice.hunt(30, 10).then(() => 0)), await p.waitForTimeout(300);
  const far = await card();
  check(far && far.head === 'Too far from the pole' && /only covers the area near the south pole/.test(far.main) && !/\d+%/.test(far.main) && (await p.evaluate(() => window.__ice.marks.length)) === marks0 && (await p.evaluate(() => window.__ice.count)) === cF, 'outside the polar terrain: a friendly line, no verdict, no marker, no count', far && far.main + (farSpot ? '' : ' (by call: no bare Moon at that place)'));
  await fits('far');

  // the language switch rewrites the card
  await tap(await siteSpot(darkClick.s));
  for (const [l, re] of [['ky', /Күн|муз/i], ['ru', /Солнц|лёд/i]]) {
    await p.click(`#lang button[data-l="${l}"]`);
    const t = await card(), btnTxt = await p.evaluate(() => document.getElementById('ice-btn').textContent);
    check(re.test(t.main) && /LCROSS/.test(t.ctx) && !/permanently shadowed|Water ice/.test(t.text) && btnTxt.length > 4 && !/Ice hunter/.test(btnTxt), `the card and button are in ${l}`, t.main.slice(0, 60));
    await fits(`dark ${l}`);
    if (l === 'ky') await shot('4-dark-result-ky');
  }
  await p.click('#lang button[data-l="en"]');

  // reload: the counter survives
  const saved = await p.evaluate(() => window.__ice.count);
  await p.reload(); await ready();
  const after = await p.evaluate(() => ({ n: window.__ice.count, badge: document.querySelector('.ice-badge').textContent, marks: window.__ice.marks.filter((m) => m.cls === 'dark').length }));
  check(after.n === saved && after.badge === String(saved) && after.marks === saved, 'the counter and the sparkles survive a reload', JSON.stringify(after));

  // c. mode off: a click on the same kind of spot still drops a lander
  await p.waitForTimeout(4200);
  await p.evaluate(() => { window.__app.S.held = true; });
  await p.click('#ice-btn'); await p.click('#ice-btn'); // on, then off: the map is back to normal
  const offState = await p.evaluate(() => ({ on: window.__ice.on, card: document.getElementById('ice-card').hidden, cursor: getComputedStyle(document.getElementById('gl')).cursor }));
  check(!offState.on && offState.card && offState.cursor !== 'crosshair', 'mode off: card gone, normal cursor', JSON.stringify(offState));
  const rA = await rows(), spot = await findSpot(-87.5, -84.5);
  await p.mouse.click(spot.x, spot.y);
  await p.waitForFunction((n) => window.__all.rows.length === n + 1, rA, { timeout: 30000 }).catch(() => {});
  const rB = await rows();
  check(rB === rA + 1, 'mode off: a click still drops a lander', `rows ${rA} -> ${rB}`);

  // the phone: the card never leaves the screen (checked above for every state); one more look with the mode on
  await p.click('#ice-btn'); await p.waitForTimeout(300);
  await shot('5-final');
  check(errs.length === 0, 'no page errors', errs.join(' | '));
  await b.close(); if (srv) srv.close();
  if (fails.length) { console.error(`FAIL ${fails.length} check(s): ${fails.join('; ')}`); process.exit(1); }
  console.log(`ice hunter works at ${TAG}`);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
