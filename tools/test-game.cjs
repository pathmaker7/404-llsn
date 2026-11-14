// Keep me alive (the battery game): the game must never say anything the answer panel does not.
//   a) many landings (random sites, variants and days across 2021 to 2031, and random battery and radio limits): the game's
//      replay (window.__game.simulate) equals judgeAt: same ok, the reason is a failed "must" row, the first of the failures in
//      time, and the same as the colour of the map's grid cell where the grid judges that point.
//   b) the real screen in a browser: a green day and a red day played to the end, with screenshots of the start, the middle
//      and the end; a night, a first Sun and a steep slope loss; languages; the kid's own lander from localStorage; closing.
//   c) the layout: nothing cut off, overlapping or scrolling sideways (run it at 1440x900, 1920x1080 and 390x844).
// Run: node tools/test-game.cjs
// Environment: BASE_URL (the deployed site instead of the local copy), VIEWPORT like 390x844, SHOTS (screenshot folder), SEED.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright-core');
const { serve } = require('./smoke.cjs');

const VIEWPORT = process.env.VIEWPORT || '1440x900', [VW, VH] = VIEWPORT.split('x').map(Number), PHONE = VW <= 760;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'keep-me-alive-shots');
const SEED = +process.env.SEED || Math.floor(Math.random() * 1e9);
const fails = [];
const check = (ok, msg, detail) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) { fails.push(msg); if (detail !== undefined) console.log('     ', typeof detail === 'string' ? detail : JSON.stringify(detail)); } };

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const srv = process.env.BASE_URL ? null : await serve(path.join(__dirname, '..', 'app'));
  const base = (process.env.BASE_URL || `http://127.0.0.1:${srv.address().port}/`).replace(/#.*$/, '');
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage({ viewport: { width: VW, height: VH } }), errs = [];
  await page.addInitScript(() => { try { localStorage.setItem('kidHelp', 'off'); } catch (e) { /* no storage */ } }); // the first visit help has its own test (test-tour.cjs)
  page.on('pageerror', (e) => errs.push('page error: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console error: ' + m.text()); });
  const shot = (name) => page.screenshot({ path: path.join(SHOTS, `game-${name}-${VIEWPORT}.png`) });
  const load = async (hash) => {
    await page.goto('about:blank'); await page.goto(base + hash);
    await page.waitForFunction(() => window.__app && window.__app.ready && window.__game, null, { timeout: 120000 });
    await page.waitForFunction(() => window.__all && window.__all.ready, null, { timeout: 180000 });
    if (hash.includes('site=')) await page.waitForFunction(() => __app.S.site && document.body.classList.contains('mode-surface'), null, { timeout: 120000 });
  };
  console.log(`Keep me alive test: ${base} at ${VIEWPORT}, seed ${SEED}`);

  // ============================================================ a) the rules equal the answer panel
  await load('#site=cr&land=2027-03-10');
  const A = await page.evaluate(async ({ seed, n }) => {
    const { judgeAt } = await import('./src/verdict.js'), { loadSky } = await import('./src/data.js');
    const idx = __app.S.index, Mi = globalThis.Mission, G = window.__game, W = __app.S.missionDays * 24;
    let a = seed >>> 0; const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const variants = [];
    for (const s of idx.sites) for (const [k, v] of Object.entries(s.variants)) variants.push({ id: s.id, name: s.name, k, v, grid: k === (s.variants.best ? 'best' : 'databook') });
    const skies = {}; for (const x of variants) skies[x.v.dir] = await loadSky(x.v.dir);
    const ORDER = ['slope', 'night', 'radio', 'light'];
    const only = (lim, k) => ({ nightH: k === 'night' ? lim.nightH : Infinity, silenceH: k === 'radio' ? lim.silenceH : Infinity, firstSunH: k === 'light' ? lim.firstSunH : Infinity, slopeLimit: k === 'slope' ? lim.slopeLimit : Infinity });
    const out = { n: 0, bad: [], gridChecked: 0, reasons: { night: 0, radio: 0, light: 0, slope: 0, none: 0 }, numbers: 0, varN: variants.length };
    const one = (x, d, tag) => {
      const sky = skies[x.v.dir], i0 = d * 24, lim = G.limits(), slope = x.v.slope_deg, eva = __app.S.extra[x.v.dir] ?? slope;
      const sim = G.simulate(sky, i0, W, slope, lim), J = judgeAt(sky, i0, W, slope, eva);
      const failed = J.rows.filter((r) => r.pri === 'must' && r.ok === false).map((r) => r.id), row = (id) => J.rows.find((r) => r.id === id);
      const date = new Date((sky.t0 + d * 86400) * 1000).toISOString().slice(0, 10), why = [];
      out.n++; out.reasons[sim.reason || 'none']++;
      if (sim.ok !== J.ok) why.push('ok differs');
      if (!sim.ok && !failed.includes(sim.reason)) why.push('reason is not a failed must row');
      if (failed.length === 1 && sim.reason !== failed[0]) why.push('single failure not named');
      if (G.settle(sim, J).agree !== true) why.push('settle disagrees');
      // the first failure in time: each rule alone, the earliest wins, ties go in the order of ORDER
      const at = {}; for (const k of failed) { const r = G.simulate(sky, i0, W, slope, only(lim, k)); at[k] = r.reason === k ? r.hour : null; }
      const known = ORDER.filter((k) => at[k] != null), first = known.sort((p, q) => at[p] - at[q] || ORDER.indexOf(p) - ORDER.indexOf(q))[0];
      if (!sim.ok && (sim.reason !== first || sim.hour !== at[first])) why.push(`not the first failure in time (game ${sim.reason}@${sim.hour}, alone ${JSON.stringify(at)})`);
      // the numbers the kid is shown come from the same series
      if (sim.reason === 'night') { out.numbers++; if (!(sim.run > lim.nightH && sim.run <= row('night').v)) why.push('night run ' + sim.run + ' vs ' + row('night').v); }
      if (sim.reason === 'radio') { out.numbers++; if (!(sim.run > lim.silenceH && sim.run <= row('radio').v)) why.push('radio run ' + sim.run + ' vs ' + row('radio').v); }
      if (sim.reason === 'light') { out.numbers++; if (!(sim.wait >= lim.firstSunH && sim.wait === row('light').v)) why.push('light wait ' + sim.wait + ' vs ' + row('light').v); }
      if (!sim.ok && sim.hour >= sim.N) why.push('failing hour outside the stay');
      if (sim.ok && sim.len !== sim.N) why.push('a survived stay must replay every hour');
      // the map's grid cell for the point the grid judges (default limits only: the grid re-judges when the limits change)
      if (x.grid && tag === 'default' && W === 336) { out.gridChecked++; const cell = __all.at(x.id, date); if (cell !== sim.ok) why.push('grid cell ' + cell); }
      if (why.length) out.bad.push({ tag, site: x.name, point: x.k, date, lim: { n: lim.nightH, r: lim.silenceH }, why });
    };
    const nd = (x) => Math.floor((skies[x.v.dir].n - W) / 24) + 1;
    const sr = variants.find((x) => x.id === 'sr');
    for (let i = 0; i < n; i++) { const x = i < 3 ? sr : variants[Math.floor(rnd() * variants.length)]; one(x, Math.floor(rnd() * nd(x)), 'default'); }
    // every point, a spread of days, until each of the four reasons has been met a few times (the random sample may miss one)
    for (const x of variants) for (let k = 0; k < 14; k++) one(x, Math.floor(rnd() * nd(x)), 'default');
    // other limits: the user can set the battery and radio on the map, so the boundaries move
    const keep = { ...Mi.limits };
    for (let i = 0; i < n; i++) { Mi.limits.nightH = [0, 12, 24, 36, 48, 72, 120, 240][Math.floor(rnd() * 8)]; Mi.limits.silenceH = [0, 12, 24, 48, 72, 120, 240][Math.floor(rnd() * 7)]; const x = variants[Math.floor(rnd() * variants.length)]; one(x, Math.floor(rnd() * nd(x)), 'limits'); }
    Object.assign(Mi.limits, keep);
    // Shackleton rim region centre: a 32 degree slope, so every landing tips over at touchdown
    const s0 = sr && G.simulate(skies[sr.v.dir], 0, W, sr.v.slope_deg, G.limits());
    out.srSlope = { slope: sr.v.slope_deg, reason: s0.reason, hour: s0.hour };
    return out;
  }, { seed: SEED, n: 50 });
  check(A.bad.length === 0, `${A.n} landings over ${A.varN} points: the game equals judgeAt (ok, a failed row, the first in time, ${A.numbers} numbers, ${A.gridChecked} grid cells)`, A.bad.slice(0, 5));
  check(['night', 'radio', 'light', 'slope'].every((k) => A.reasons[k] >= 3) && A.reasons.none >= 3, `every outcome was met: ${JSON.stringify(A.reasons)}`);
  check(A.srSlope.reason === 'slope' && A.srSlope.hour === 0, `Shackleton rim region centre (${A.srSlope.slope} deg): the lander tips over at hour 0`, A.srSlope);

  // the exact boundaries, on a synthetic stay where the answer is known: a run equal to the limit survives, one hour more loses
  const edge = await page.evaluate(async () => {
    const { judgeAt } = await import('./src/verdict.js'), G = __game, Mi = globalThis.Mission, n = 24 * 30, W = 336, bad = [], seen = [];
    const mk = (dark = [0, 0], gap = [0, 0]) => { const ch = { sunFrac: new Float32Array(n).fill(1), earthVis: new Float32Array(n).fill(1), sunEl: new Float32Array(n).fill(1.5) };
      for (let i = dark[0]; i < dark[0] + dark[1]; i++) ch.sunFrac[i] = 0.49; for (let i = gap[0]; i < gap[0] + gap[1]; i++) ch.earthVis[i] = 0.5; // 49% of the disc and a margin of exactly one half still count as hidden
      return { ch, n, t0: 0, meta: { lat: -89 } }; };
    const cases = [];
    for (const k of [47, 48, 49]) cases.push([`night ${k} h`, mk([100, k]), 0, 2, k <= 48]);
    for (const k of [71, 72, 73]) cases.push([`radio ${k} h`, mk([0, 0], [100, k]), 0, 2, k <= 72]);
    for (const k of [22, 23, 24, 25]) cases.push([`first Sun after ${k} h`, mk([0, k]), 0, 2, k < 24]);
    for (const s of [9.9, 10]) cases.push([`slope ${s}`, mk(), 0, s, s < 10]);
    cases.push(['night 48 h in the last hours of the stay', mk([336 - 48, 48]), 0, 2, true], ['night 49 h in the last hours of the stay', mk([336 - 49, 49]), 0, 2, false]);
    cases.push(['no Sun at all', mk([0, n]), 0, 2, false]);
    for (const [name, site, i0, slope, want] of cases) {
      const lim = G.limits(), sim = G.simulate(site, i0, W, slope, lim), J = judgeAt(site, i0, W, slope, 5), failed = J.rows.filter((r) => r.pri === 'must' && r.ok === false).map((r) => r.id);
      seen.push(`${name}: ${sim.ok ? 'survives' : sim.reason + '@' + sim.hour}`);
      if (sim.ok !== want || J.ok !== want || (!sim.ok && !failed.includes(sim.reason))) bad.push({ name, game: sim.reason, hour: sim.hour, judgeAt: failed, want });
    }
    // a stay cut short by the end of the data: the game replays only the hours that exist, as judgeAt counts them
    const cut = mk(), short = G.simulate(cut, n - 10, W, 2, G.limits()), shortJ = judgeAt(cut, n - 10, W, 2, 5);
    if (short.N !== 10 || short.ok !== shortJ.ok) bad.push({ name: 'stay cut by the end of the data', short: [short.N, short.ok], judgeAt: shortJ.ok });
    return { n: cases.length + 1, bad, seen };
  });
  check(edge.bad.length === 0, `${edge.n} exact boundaries (a run equal to the limit survives, one hour more loses): the game equals judgeAt`, edge.bad);

  // ============================================================ b) the real screen
  const ui = {
    state: () => page.evaluate(() => { const g = __game.state; return { phase: g.phase, h: g.h, day: g.day, speed: g.speed, paused: g.paused, ok: g.res && g.res.ok, reason: g.res && g.res.reason, agree: g.res && g.res.agree, simReason: g.sim && g.sim.reason, hour: g.sim && g.sim.hour, N: g.sim && g.sim.N, t: __app.S.t, t0: g.t0 }; }),
    wait: (cond, arg, ms = 90000) => page.waitForFunction(cond, arg, { timeout: ms }),
    text: (sel) => page.evaluate((s) => document.querySelector(s)?.textContent ?? null, sel),
    visible: (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return !e.closest('[hidden]') && r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; }, sel),
  };
  const raw = /kG[A-Z]|undefined|NaN|\[object|\{\w+\}/;
  // Layout (c): everything inside the screen, no sideways scroll, the main blocks do not sit on each other.
  const layout = async (label, sels, pairs = []) => {
    const r = await page.evaluate(({ sels, pairs, VW, VH }) => {
      const box = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); const vis = !e.closest('[hidden]') && b.width > 0 && getComputedStyle(e).visibility !== 'hidden'; return vis ? { s, l: b.left, t: b.top, r: b.right, b: b.bottom } : null; };
      const out = [], boxes = Object.fromEntries(sels.map((s) => [s, box(s)]));
      for (const [s, b] of Object.entries(boxes)) { if (!b) { out.push('not shown: ' + s); continue; } if (b.l < -0.5 || b.t < -0.5 || b.r > VW + 0.5 || b.b > VH + 0.5) out.push(`${s} leaves the screen ${JSON.stringify([b.l, b.t, b.r, b.b].map(Math.round))}`); }
      for (const [p, q] of pairs) { const a = boxes[p] || box(p), c = boxes[q] || box(q); if (a && c && a.l < c.r - 1 && c.l < a.r - 1 && a.t < c.b - 1 && c.t < a.b - 1) out.push(`${p} overlaps ${q}`); }
      for (const e of document.querySelectorAll('#gameov .g-card')) if (!e.closest('[hidden]') && e.scrollWidth > e.clientWidth + 1) out.push('sideways overflow inside ' + e.className);
      if (document.documentElement.scrollWidth > VW) out.push('page scrolls sideways: ' + document.documentElement.scrollWidth);
      return out;
    }, { sels, pairs, VW, VH });
    check(r.length === 0, `layout at ${VIEWPORT}: ${label}`, r);
  };

  // --- the button, the setup card
  check(await ui.visible('#g-open'), 'the "Play: Keep me alive" button is on the site screen');
  const btnTxt = await page.evaluate(() => { const b = document.getElementById('g-open'), r = b.getBoundingClientRect(); return { text: b.innerText, top: r.top, left: r.left, right: r.right, parent: b.parentElement.id }; });
  check(btnTxt.parent === 'sitekid' && btnTxt.top < 60 && btnTxt.right < VW, `the button sits in the top bar (${btnTxt.text})`, btnTxt);
  await page.click('#g-open');
  await ui.wait(() => __game.state.phase === 'setup');
  check(await ui.visible('.g-setup') && !(await ui.visible('.g-play')) && (await page.evaluate(() => document.documentElement.classList.contains('game-on'))), 'the setup card opens over the 3D view');
  check(await page.evaluate(() => __game.state.day === Math.floor(__app.S.missionStart / 86400) * 86400 && document.getElementById('g-day').value === new Date(__app.S.missionStart * 1000).toISOString().slice(0, 10)), 'the landing day defaults to the day chosen on the site');
  const lim0 = await page.evaluate(() => document.querySelector('.g-lim').textContent);
  check(/2 days/.test(lim0) && /3 days/.test(lim0) && /24 hours/.test(lim0) && /23 hours/.test(lim0), 'the limits line shows the app limits (2 days, 3 days, 24 h, 23 h of charge)', lim0);
  check(!raw.test(await page.evaluate(() => document.getElementById('gameov').innerText)), 'no raw text keys on the setup card');
  await layout('setup card', ['.g-setup', '#g-day', '#g-green', '#g-red', '#g-start', '#g-close0']);
  await shot('1-setup');

  // --- a green day, played to the end through the real controls
  const playGame = async (kind, tag) => {
    await page.click(kind === 'green' ? '#g-green' : '#g-red');
    const st0 = await ui.state(), verdict = await page.evaluate((d) => __game.judgeDay(d).ok, st0.day);
    check(verdict === (kind === 'green'), `"Try a ${kind} day" found ${new Date(st0.day * 1000).toISOString().slice(0, 10)}, which judgeAt says ${verdict ? 'survives' : 'is lost'}`);
    check((await page.inputValue('#g-day')) === new Date(st0.day * 1000).toISOString().slice(0, 10), 'the date field shows the picked day');
    const tBefore = await page.evaluate(() => __app.S.t);
    await page.click('#g-start');
    await ui.wait(() => __game.state.phase === 'play' || __game.state.phase === 'ending' || __game.state.phase === 'end');
    check(await ui.visible('.g-batt') && await ui.visible('.g-sunc') && await ui.visible('.g-radioc') && await ui.visible('.g-live') && await ui.visible('.g-rib') && await ui.visible('.g-dayno'), 'battery, Sun panel, radio, lander, 14 day ribbon and day counter are on screen');
    await shot(`${tag}-2-start`);
    await page.click('.g-segbtn button[data-sp="4"]');
    check((await ui.state()).speed === 4, 'the speed button sets 4x');
    // the middle: pause there, read every indicator against the data in one go
    await ui.wait(() => { const g = __game.state; if (g.phase !== 'play' || g.h >= Math.min(g.endH * 0.55, g.endH - 3)) { if (g.phase === 'play') document.getElementById('g-pause').click(); return true; } return false; }); // pause inside the frame: no race with a fast game
    const mid = await page.evaluate(() => {
      const g = __game.state, tr = g.sim.trace, k = Math.min(Math.floor(g.h), g.sim.len - 1), q = (s) => document.querySelector(s);
      return { phase: g.phase, paused: g.paused, k, bh: q('.g-bh').textContent, batt: Math.round(tr.batt[k]), sunOn: q('.g-sunc').dataset.on, sun: tr.sun[k], earthOn: q('.g-radioc').dataset.on, earth: tr.earth[k],
        sil: q('.g-radioc .g-sub').textContent, silN: tr.silent[k], day: q('.g-dayno').textContent, t: __app.S.t, expectT: g.t0 + Math.min(g.h, g.endH) * 3600, playing: __app.S.playing, wing: q('.g-live').classList.contains('sun-on') };
    });
    check((mid.paused || mid.phase !== 'play') && mid.bh === String(mid.batt) && (mid.sunOn === '1') === (mid.sun === 1) && (mid.earthOn === '1') === (mid.earth === 1) && new RegExp(`${mid.silN}\\s`).test(mid.sil) && mid.wing === (mid.sun === 1), `the middle (hour ${mid.k}): battery ${mid.bh} h, Sun ${mid.sunOn}, Earth ${mid.earthOn}, silence ${mid.silN} h equal the data`, mid);
    check(Math.abs(mid.t - mid.expectT) < 1 && mid.t > tBefore + 3600 && mid.playing === false, 'the real 3D sky clock follows the game clock (S.t moved, the app clock is not running)');
    await layout(`${tag} game screen`, ['.g-batt', '.g-sunc', '.g-radioc', '.g-lander', '.g-bar', '.g-clock', '#g-pause', '.g-segbtn', '#g-close1'], [['.g-batt', '.g-sunc'], ['.g-sunc', '.g-radioc'], ['.g-side', '.g-lander'], ['.g-lander', '.g-bar'], ['.g-clock', '.g-side'], ['.g-clock', '.g-lander'], ['.g-clock', '.g-bar']]);
    await shot(`${tag}-3-middle`);
    await page.click('#g-pause');
    check(await page.evaluate(() => { const h = __game.state.h; return new Promise((r) => setTimeout(() => r(__game.state.h > h || __game.state.phase !== 'play'), 600)); }), 'resume moves the clock on again');
    await ui.wait(() => __game.state.phase === 'end');
    await page.waitForTimeout(400);
    const end = await ui.state(), words = await page.evaluate(() => ({ verdict: document.querySelector('.g-verdict').textContent, big: document.querySelector('.g-big2').textContent, why: document.querySelector('.g-why').textContent, card: document.querySelector('.g-end').innerText, face: document.querySelector('.g-end .g-prev').dataset.face }));
    const Mp = await page.evaluate(() => [I18n.t('mPass'), I18n.t('mFail')]);
    const J = await page.evaluate((d) => { const j = __game.judgeDay(d), r = j.rows.filter((x) => x.pri === 'must' && x.ok === false).map((x) => x.id); return { ok: j.ok, failed: r }; }, end.day);
    check(end.ok === J.ok && end.agree === true && words.verdict === (J.ok ? Mp[0] : Mp[1]), `the end verdict "${words.verdict}" is judgeAt's (${J.ok ? 'survives' : 'lost: ' + J.failed.join()}), the game agreed`, { end, J, words });
    check(!raw.test(words.card), 'no raw text or placeholders on the end card', words.card);
    await layout(`${tag} end card`, ['.g-end', '#g-again', '#g-close2', '.g-end .g-prev'], [['.g-end', '.g-bar']]);
    await shot(`${tag}-4-end`);
    return { end, J, words };
  };
  const G1 = await playGame('green', 'green');
  check(G1.end.ok === true && G1.end.simReason === null && G1.end.hour === G1.end.N && /14 days survived/.test(G1.words.big) && G1.words.face === 'happy', 'green day: 14 days survived, happy lander', G1);
  await page.click('#g-again');
  await ui.wait(() => __game.state.phase === 'setup');
  const G2 = await playGame('red', 'red');
  check(G2.end.ok === false && ['night', 'radio', 'light', 'slope'].includes(G2.end.reason) && G2.words.face === 'sleep' && /\d/.test(G2.words.big) && G2.words.why.length > 0, `red day: lost (${G2.end.reason}) with a sleepy lander and a real number: "${G2.words.big}"`, G2);
  const nums = G2.words.big.match(/\d+(\.\d+)?/g) || [];
  if (G2.end.reason === 'night' || G2.end.reason === 'radio') {
    const run = await page.evaluate(() => __game.state.sim.run), lim = await page.evaluate((r) => (r === 'night' ? __game.limits().nightH : __game.limits().silenceH), G2.end.reason);
    check(nums[0] === String(+(run / 24).toFixed(1)) && nums[1] === String(+(lim / 24).toFixed(1)), `the shown numbers (${nums.join(' and ')} days) are the run (${run} h) and the limit (${lim} h)`);
  }

  // --- close restores the 3D view and the clock
  const keepT = await page.evaluate(() => __game.state.saved.t);
  await page.click('#g-close2');
  const closed = await page.evaluate(() => ({ on: document.documentElement.classList.contains('game-on'), t: __app.S.t, saved: __game.state.saved.t, playing: __app.S.playing, phase: __game.state.phase }));
  check(!closed.on && closed.t === keepT && closed.playing === false && closed.phase === 'off', 'Close gives the 3D view back with its old clock', closed);

  // --- reopen: keys, pause button, back to the map
  await page.click('#g-open'); await ui.wait(() => __game.state.phase === 'setup');
  await page.keyboard.press('Escape');
  check(!(await page.evaluate(() => document.documentElement.classList.contains('game-on'))), 'Escape closes the game');
  await page.click('#g-open'); await ui.wait(() => __game.state.phase === 'setup');
  await page.click('#g-start'); await page.waitForTimeout(500);
  await page.keyboard.press(' ');
  const h1 = await ui.state(); await page.waitForTimeout(600); const h2 = await ui.state();
  check(h1.paused && h2.h === h1.h && h2.t === h1.t, 'the space bar pauses the game and the 3D clock with it');
  await page.click('#back');
  await page.waitForFunction(() => document.body.classList.contains('mode-overview'));
  check(!(await page.evaluate(() => document.documentElement.classList.contains('game-on'))) && !(await ui.visible('#g-open')), 'going back to the map closes the game and hides its button');

  // --- the kid's own lander, read from localStorage and cleaned
  await load('#site=cr&land=2027-03-10');
  await page.evaluate(() => localStorage.setItem('myLander', JSON.stringify({ type: 'rover', color: '#ff8844', name: 'Kalpak <b>X</b> "Z"', hat: 'tajik' })));
  await page.click('#g-open'); await ui.wait(() => __game.state.phase === 'setup');
  const my = await page.evaluate(() => ({ name: document.querySelector('.g-pname').textContent, bold: document.querySelectorAll('.g-pname b, .g-setup b').length, fill: !!document.querySelector('.g-setup svg rect[fill="#ff8844"]'), wheels: document.querySelectorAll('.g-setup svg circle[r="15"]').length, hat: document.querySelector('.g-setup .g-hat').innerHTML.includes('#0e7a4f') }));
  check(/^Kalpak bXb Z$/.test(my.name) && my.bold === 0 && my.fill && my.wheels === 2 && my.hat, `the kid's own lander is drawn (rover, colour, tajik hat) and its name is cleaned: "${my.name}"`, my);
  await page.evaluate(() => localStorage.setItem('myLander', JSON.stringify({ type: 'lander"><script>window.__x=1</script>', color: '#12345"onload="window.__x=1', name: 7, hat: ['x'] })));
  await page.click('#g-close0'); await page.click('#g-open'); await ui.wait(() => __game.state.phase === 'setup');
  const evil = await page.evaluate(() => ({ name: document.querySelector('.g-pname').textContent, x: window.__x, scripts: document.querySelectorAll('#gameov script').length, hat: !!document.querySelector('.g-setup .g-hat path'), def: !!document.querySelector('.g-setup svg rect[fill="#e9edf4"]') }));
  check(evil.name === 'Naryn-1' && !evil.x && evil.scripts === 0 && evil.hat && evil.def, 'a crafted myLander falls back to the default Naryn-1 with the white Kyrgyz kalpak, nothing runs', evil);
  await page.evaluate(() => localStorage.setItem('myLander', '{not json'));
  await page.click('#g-close0'); await page.click('#g-open'); await ui.wait(() => __game.state.phase === 'setup');
  check((await ui.text('.g-pname')) === 'Naryn-1', 'a broken myLander value gives the default lander');
  await page.evaluate(() => localStorage.removeItem('myLander'));

  // --- the three languages
  for (const l of ['ru', 'ky', 'en']) {
    await page.click(`#lang button[data-l="${l}"]`);
    const t = await page.evaluate(() => document.getElementById('gameov').innerText + ' ' + document.getElementById('g-open').title), btn = await page.evaluate(() => document.getElementById('g-open').innerText);
    const re = { ru: /Не дай мне погибнуть/, ky: /Мени аман сакта/, en: /Keep me alive/ }[l];
    check(re.test(t) && !raw.test(t) && (l === 'en' || /[а-яё]/i.test(btn)), `language ${l}: the game screen is translated, nothing raw (button "${btn.replace(/\n/g, ' ')}")`, t);
    if (l === 'ky') { check(/[өүң]/.test(t), 'Kyrgyz text uses Kyrgyz letters'); await layout('setup card in Kyrgyz', ['.g-setup', '#g-green', '#g-red', '#g-start']); await shot('5-setup-ky'); }
  }
  await page.click('#g-close0');

  // --- the three loss reasons on screen: night (battery runs down), first Sun, steep slope
  const scenario = async (reason, tag, site) => {
    // a landing day that loses for this reason, found with the game's own replay at the site (or at any site the grid judges)
    const found = await page.evaluate(async ({ reason, site }) => {
      const { loadSky } = await import('./src/data.js'), c = __app.S, G = __game, W = c.missionDays * 24, p0 = Date.parse(c.index.period.start) / 1000;
      const order = [...c.index.sites].sort((p, q) => (q.id === site) - (p.id === site) || (q.id === c.siteId) - (p.id === c.siteId));
      for (const e of order) {
        const v = e.variants.best || e.variants.databook, s = await loadSky(v.dir);
        for (let d = 0; d < Math.floor((s.n - W) / 24); d += 3) { const t = Math.ceil(p0 / 86400) * 86400 + d * 86400, r = G.simulate(s, Math.round((t - s.t0) / 3600), W, v.slope_deg, G.limits());
          if (r.reason === reason && (reason !== 'night' || r.hour > 72)) return { id: e.id, t }; }
        if (site) break;
      }
      return null;
    }, { reason, site });
    check(found != null, `a ${reason} loss exists to play`);
    if (!found) return;
    const here = await page.evaluate(() => __app.S.siteId);
    if (found.id !== here) await load(`#site=${found.id}&land=${new Date(found.t * 1000).toISOString().slice(0, 10)}`);
    await page.click('#g-open'); await ui.wait(() => __game.state.phase === 'setup');
    await page.fill('#g-day', new Date(found.t * 1000).toISOString().slice(0, 10)); await page.dispatchEvent('#g-day', 'change');
    if (reason === 'slope') { await page.click('#g-green'); check((await ui.text('#g-msg')) === (await page.evaluate(() => I18n.t('kGGreenNone'))), 'a place with no green day says so when asked for one'); }
    await page.click('#g-start'); await page.click(`.g-segbtn button[data-sp="${reason === 'night' ? 1 : 4}"]`);
    if (reason === 'night') { // pause when the battery is nearly empty: the red, draining state
      await ui.wait(() => { const g = __game.state, tr = g.sim.trace, k = Math.min(Math.floor(g.h), g.sim.len - 1); if (g.phase !== 'play' || (tr.batt[k] <= 6 && tr.sun[k] === 0)) { if (g.phase === 'play') document.getElementById('g-pause').click(); return true; } return false; });
      await page.waitForTimeout(500);
      const low = await page.evaluate(() => ({ lvl: document.querySelector('.g-batt').dataset.lvl, st: document.querySelector('.g-batt').dataset.st, face: document.querySelector('.g-live').dataset.face, state: document.querySelector('.g-bstate').textContent }));
      check(low.lvl === 'low' && low.st === 'drain' && low.face === 'worry', `night: the battery shows low and draining and the lander looks worried (${low.state})`, low);
      await layout('night, low battery', ['.g-batt', '.g-sunc', '.g-radioc', '.g-lander', '.g-bar'], [['.g-side', '.g-lander'], ['.g-lander', '.g-bar']]);
      await shot(`${tag}-low-battery`);
      await page.click('#g-pause');
    }
    await ui.wait(() => __game.state.phase === 'end');
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => ({ reason: __game.state.res.reason, simReason: __game.state.sim.reason, agree: __game.state.res.agree, big: document.querySelector('.g-big2').textContent, tipped: document.querySelector('.g-end .g-prev').classList.contains('tipped'), ok: __game.state.res.ok }));
    check(r.ok === false && r.reason === reason && r.agree && !raw.test(r.big) && r.tipped === (reason === 'slope'), `${reason} loss: "${r.big}"`, r);
    await shot(`${tag}-end`);
    await page.click('#g-close2');
  };
  await scenario('night', 'night');
  await scenario('light', 'light');
  await scenario('slope', 'slope', 'sr');
  const slopeNote = await page.evaluate(() => document.getElementById('h-coords') && __app.S.variant);
  check(slopeNote === 'databook', 'Shackleton rim opens on its region centre (the only point there)');

  // --- errors
  check(errs.length === 0, 'no page errors and no console errors (the game never disagreed with judgeAt)', errs.slice(0, 5));
  await browser.close(); if (srv) srv.close();
  if (fails.length) { console.error(`\n${fails.length} FAILED:\n- ` + fails.join('\n- ')); process.exit(1); }
  console.log(`\nall Keep me alive checks pass at ${VIEWPORT} (screenshots in ${SHOTS})`);
})().catch((e) => { console.error(e); process.exit(1); });
