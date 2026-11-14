// Quiz mode for students: the pool, the live questions against the app's own model, and a child's round through real clicks.
// Run: node tools/test-quiz.cjs
// Environment: BASE_URL (test a deployed site instead of the local files), VIEWPORT like 1920x1080 or 390x844 (default 1440x900),
// SHOTS (directory for the screenshots). Exits non zero on any failed check or page error.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const { serve, launch } = require('./smoke.cjs');

const [VW, VH] = (process.env.VIEWPORT || '1440x900').split('x').map(Number);
const SHOTS = process.env.SHOTS || '/private/tmp/claude-501/-Users-agentsinc-Desktop-NASA-Naryn/4ec727e1-b59d-4e91-8d93-17544d5a3cfb/scratchpad/quiz';
const phone = VW <= 760, tag = `${VW}x${VH}`;
let failures = 0;
const check = (ok, name, extra = '') => { if (!ok) failures++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? ': ' + extra : ''}`); };

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  let srv = null, url = process.env.BASE_URL;
  if (!url) { srv = await serve(path.join(__dirname, '..', 'app')); url = `http://127.0.0.1:${srv.address().port}/`; }
  const b = await launch();
  const page = await b.newPage({ viewport: { width: VW, height: VH } }), errs = [];
  await page.addInitScript(() => { try { localStorage.setItem('kidHelp', 'off'); } catch (e) { /* no storage */ } }); // the first visit help has its own test (test-tour.cjs)
  page.on('pageerror', (e) => errs.push('page error: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.g/.test(m.text())) errs.push('console: ' + m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.__app && window.__app.ready && window.__quiz, null, { timeout: 90000 });
  await page.waitForFunction(() => window.__all && window.__all.ready, null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  const shot = (name) => page.screenshot({ path: path.join(SHOTS, `quiz-${tag}-${name}.png`), timeout: 90000 });

  // ------------------------------------------------------------------ (a) the pool
  const pool = await page.evaluate(async () => {
    const Q = window.__quiz, I = window.I18n, out = { n: Q.POOL.length, stat: Q.STATIC_IDS.length, live: Q.LIVE_IDS.length, bad: [] };
    const langs = ['en', 'ru', 'ky'];
    for (const p of Q.POOL) {
      const q = await Q.make(p.id), T = {};
      if (!q) { out.bad.push(p.id + ': no question'); continue; }
      for (const l of langs) { I.set(l); T[l] = Q.text(q); }
      I.set('en');
      for (const l of langs) {
        const t = T[l], texts = t.options.map((o) => o.text);
        if (t.options.length !== 4) out.bad.push(`${p.id} ${l}: ${t.options.length} options`);
        if (new Set(texts).size !== 4) out.bad.push(`${p.id} ${l}: options not distinct`);
        if (t.options.filter((o) => o.correct).length !== 1) out.bad.push(`${p.id} ${l}: not exactly one right`);
        if (!t.q.trim() || texts.some((x) => !x.trim()) || t.options.some((o) => !o.why.trim())) out.bad.push(`${p.id} ${l}: empty text`);
        if (/\{\w+\}|undefined|NaN|\[object/.test(t.q + texts.join() + t.options.map((o) => o.why).join())) out.bad.push(`${p.id} ${l}: unresolved text`);
        if (l !== 'en') {
          const e = T.en;
          if (t.q === e.q) out.bad.push(`${p.id} ${l}: question equals English`);
          t.options.forEach((o, i) => { if (o.text === e.options[i].text) out.bad.push(`${p.id} ${l}: option ${i + 1} equals English`); if (o.why === e.options[i].why) out.bad.push(`${p.id} ${l}: explanation ${i + 1} equals English`); });
        }
      }
      if (/[—–]|--/.test(JSON.stringify(T))) out.bad.push(p.id + ': dash used as punctuation');
    }
    return out;
  });
  check(pool.n === 25 && pool.stat === 15 && pool.live === 10, 'the pool has exactly 25 questions (15 static, 10 live)', `${pool.n} = ${pool.stat} + ${pool.live}`);
  check(pool.bad.length === 0, 'every question: 4 distinct options, 1 right, all texts in English, Russian and Kyrgyz, none equal to English', pool.bad.slice(0, 6).join(' | '));

  // ------------------------------------------------------------------ (b) live questions against the model
  const live = await page.evaluate(async () => {
    const { loadSky } = await import('/src/data.js'), { judgeAt } = await import('/src/verdict.js');
    const Q = window.__quiz, Mi = window.Mission, I = window.I18n;
    const index = await (await fetch('data/index.json')).json(), extra = await (await fetch('data/extra.json')).json();
    // The test's own copy of "which point does the grid judge for a site", read from the data files, not from the quiz.
    const spec = (id) => { const s = index.sites.find((x) => x.id === id), v = s.variants.best || s.variants.databook; return { dir: v.dir, slope: v.slope_deg, eva: extra[v.dir] ?? v.slope_deg }; };
    const rows = async (id, iso) => { const sp = spec(id), sky = await loadSky(sp.dir); return judgeAt(sky, Math.round((Date.parse(iso + 'T00:00:00Z') / 1000 - sky.t0) / 3600), 336, sp.slope, sp.eva); };
    const R = (x, k) => x.rows.find((r) => r.id === k);
    const fails = (x) => x.rows.filter((r) => r.pri === 'must' && r.ok === false).map((r) => r.id);
    const plus = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
    const out = {};
    for (const id of Q.LIVE_IDS) {
      const o = { n: 0, bad: [], vals: new Set(), sites: new Set(), dates: new Set(), pos: [0, 0, 0, 0], kind: '' };
      for (let i = 0; i < 40; i++) {
        const q = await Q.make(id); o.kind = q.kind;
        const right = q.options.filter((x) => x.correct);
        if (q.options.length !== 4 || right.length !== 1) { o.bad.push('not exactly one right'); continue; }
        const m = q.meta, c = right[0];
        o.pos[q.options.indexOf(c)]++; o.vals.add(String(c.val)); o.dates.add(m.date); if (m.siteId) o.sites.add(m.siteId);
        let want, why;
        if (q.kind === 'survive' || q.kind === 'whichCheck') {
          const x = await rows(m.siteId, m.date), f = fails(x), at = window.__all.at(m.siteId, m.date);
          if (q.kind === 'survive') { want = f.length === 0 ? 'yes' : f.length === 1 ? f[0] : 'many'; if (at !== (f.length === 0)) o.bad.push(`grid cell disagrees on ${m.siteId} ${m.date}`); }
          else { want = f.length === 1 ? f[0] : 'many'; if (at !== false) o.bad.push(`grid cell is green on ${m.siteId} ${m.date}`); }
          // the text quotes the real numbers: the right option's line holds the verdict rows' values in days
          const t = Q.text(q).options.find((y) => y.correct).why, n1 = (R(x, 'night').v / 24).toFixed(1).replace(/\.0$/, ''), n2 = (R(x, 'radio').v / 24).toFixed(1).replace(/\.0$/, '');
          if (q.kind === 'survive' && want === 'yes' && !(t.includes(n1) && t.includes(n2))) o.bad.push(`explanation lacks ${n1} or ${n2}: ${t}`);
          if (q.kind === 'survive' && want === 'night' && !t.includes(n1)) o.bad.push(`explanation lacks ${n1}: ${t}`);
          if (q.kind === 'survive' && want === 'radio' && !t.includes(n2)) o.bad.push(`explanation lacks ${n2}: ${t}`);
        } else if (q.kind === 'whichSite') {
          const xs = []; for (const sid of m.ids) xs.push([sid, (await rows(sid, m.date)).ok, window.__all.at(sid, m.date)]);
          const ok = xs.filter((y) => y[1]);
          if (ok.length !== 1 || xs.some((y) => y[1] !== y[2])) o.bad.push('survivors differ from the grid on ' + m.date);
          want = ok.length === 1 ? ok[0][0] : 'many';
        } else if (q.kind === 'count30') {
          let k = 0, g = 0; for (let d = 0; d < 30; d++) { k += (await rows(m.siteId, plus(m.date, d))).ok; g += window.__all.at(m.siteId, plus(m.date, d)); }
          if (k !== g) o.bad.push('count differs from the grid cells'); want = k;
        } else if (q.kind === 'battery' || q.kind === 'radio') {
          const x = await rows(m.siteId, m.date), k = q.kind === 'battery' ? 'night' : 'radio', lim = q.kind === 'battery' ? Mi.limits.nightH : Mi.limits.silenceH;
          want = R(x, k).v <= lim ? 'pass' : 'fail'; if (R(x, k).v !== m.hours) o.bad.push('hours differ');
          const t = Q.text(q); if (!t.q.includes(String(m.hours))) o.bad.push('question lacks ' + m.hours + ' hours');
        } else if (q.kind === 'firstSun') {
          const w = R(await rows(m.siteId, m.date), 'light').v; want = w === 0 ? 1 : w < 24 ? 2 : w < Infinity ? 3 : 4;
        } else if (q.kind === 'moreSun' || q.kind === 'moreEarth') {
          const key = q.kind === 'moreSun' ? 'sunPct' : 'earthPct', xs = [];
          for (const sid of m.ids) xs.push([sid, R(await rows(sid, m.date), key).v]);
          xs.sort((a, b) => b[1] - a[1]); want = xs[0][1] - xs[1][1] >= 5 ? xs[0][0] : 'tie';
        } else if (q.kind === 'nextSafe') {
          if (window.__all.at(m.siteId, m.date) !== false) o.bad.push('the start day is green');
          let k = 0; for (let d = 1; d <= 60 && !k; d++) if ((await rows(m.siteId, plus(m.date, d))).ok) k = d; want = k;
          if (window.__all.at(m.siteId, plus(m.date, k)) !== true) o.bad.push('grid cell on the answer day is not green');
        }
        if (c.val !== want) o.bad.push(`right option ${c.val} but the model says ${want} (${m.siteId || m.ids} ${m.date})`);
        o.n++;
      }
      o.vals = [...o.vals]; o.sites = o.sites.size; o.dates = o.dates.size;
      out[id] = o;
    }
    return out;
  });
  for (const [id, o] of Object.entries(live)) {
    check(o.n === 40 && o.bad.length === 0, `${id} ${o.kind}: 40 asks, each right option equals judgeAt and the grid, exactly one right`, o.bad.slice(0, 3).join(' | '));
    check(o.dates >= 10 && (o.sites === 0 || o.sites >= 4) && o.vals.length >= 2 && o.pos.filter((x) => x > 0).length >= 3,
      `${id} varies: ${o.dates} dates, ${o.sites} sites, answers ${o.vals.slice(0, 6).join('/')}, right option at A B C D = ${o.pos.join(' ')}`);
  }

  // ------------------------------------------------------------------ the facts the static questions state, from the model
  const facts = await page.evaluate(async () => {
    const { loadSky } = await import('/src/data.js'), { judgeAt } = await import('/src/verdict.js'), { dayVerdicts } = await import('/src/allsites.js');
    const index = await (await fetch('data/index.json')).json(), extra = await (await fetch('data/extra.json')).json();
    const dirOf = (id) => { const s = index.sites.find((x) => x.id === id); return (s.variants.best || s.variants.databook); };
    const ps = dirOf('ps'), sky = await loadSky(ps.dir), ch = sky.ch;
    const a = Math.round((Date.parse('2027-01-01T00:00:00Z') / 1000 - sky.t0) / 3600), z = a + 365 * 24, o = {};
    let e = 0, su = 0; const win = []; let run = 0;
    for (let i = a; i < z; i++) { e += ch.earthVis[i] > 0.5; su += ch.sunFrac[i] >= 0.5; if (ch.earthVis[i] > 0.5) run++; else { if (run) win.push(run / 24); run = 0; } }
    o.earthPct = 100 * e / (z - a); o.sunPct = 100 * su / (z - a); o.winMean = win.reduce((p, c) => p + c, 0) / win.length; o.windows = win.length;
    // night check fails per month, Feb to Jul 2027, and green days in Jun and Jul (Peak near Shackleton, 14 day stay)
    const idx = (iso) => Math.round((Date.parse(iso + 'T00:00:00Z') / 1000 - sky.t0) / 3600);
    o.nightFail = []; o.green = [];
    for (let m = 2; m <= 7; m++) { let nf = 0, g = 0; const n = new Date(Date.UTC(2027, m, 0)).getUTCDate(); for (let d = 1; d <= n; d++) { const x = judgeAt(sky, idx(`2027-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`), 336, ps.slope_deg, extra[ps.dir] ?? ps.slope_deg); nf += x.rows.find((r) => r.id === 'night').ok === false; g += x.ok; } o.nightFail.push(nf); o.green.push(g); }
    // highest Sun in 2027 at the six sites nearest the pole
    const lats = []; for (const s of index.sites) { const v = dirOf(s.id), k = await loadSky(v.dir); let mx = -90; for (let i = a; i < z; i++) mx = Math.max(mx, k.ch.sunEl[i]); lats.push([k.meta.lat, mx, s.name]); }
    lats.sort((p, q) => p[0] - q[0]); // most southern first: the sites nearest the pole
    o.nearSun = lats.slice(0, 6).map((l) => [l[2], +l[1].toFixed(2)]);
    // the two crater floors never see the Sun in the whole period
    o.floors = []; for (const id of ['sf', 'ff']) { const k = await loadSky(dirOf(id).dir); let m = 0; for (let i = 0; i < k.n; i++) m = Math.max(m, k.ch.sunFrac[i]); o.floors.push(m); }
    // the repeat: strongest lag between 200 and 400 days for the 14 day verdict series
    const dv = dayVerdicts(sky, ps.slope_deg, extra[ps.dir] ?? ps.slope_deg, 14), x = Array.from(dv, (v) => (v === 0 ? 1 : 0)), n = x.length, mean = x.reduce((p, c) => p + c, 0) / n;
    const ac = (lag) => { let s = 0, t = 0; for (let i = 0; i + lag < n; i++) s += (x[i] - mean) * (x[i + lag] - mean); for (let i = 0; i < n; i++) t += (x[i] - mean) ** 2; return s / t; };
    let best = [0, -9]; for (let l = 200; l <= 400; l++) { const v = ac(l); if (v > best[1]) best = [l, v]; }
    o.lag = best[0]; o.r354 = ac(354); o.r365 = ac(365);
    // the equator: the Apollo 11 site on a smooth Moon, longest night in 2027 (the app's treatment of a point outside the pole)
    const Sky = window.Sky, f = Sky.siteFrame(0.67416, 23.47314, 2), dip = -Math.acos(1737400 / 1737402) * 180 / Math.PI, t0 = Date.parse('2027-01-01T00:00:00Z') / 1000;
    let r = 0, mx = 0; for (let i = 0; i < 365 * 24; i++) { const s = Sky.azEl(Sky.bodiesMoonFixed(new Date((t0 + i * 3600) * 1000)).sun, f); if (s.el + Math.asin(695700 / s.dist) * 180 / Math.PI > dip) r = 0; else { r++; mx = Math.max(mx, r); } }
    o.equatorNight = mx / 24;
    return o;
  });
  check(facts.earthPct > 45 && facts.earthPct < 62 && facts.winMean > 12 && facts.winMean < 18, 'kQ02: Earth in view about half of 2027 at Peak near Shackleton, in windows of about two weeks', `${facts.earthPct.toFixed(1)}%, ${facts.windows} windows, mean ${facts.winMean.toFixed(1)} days`);
  check(facts.nightFail.every((v) => v >= 14 && v <= 21) && facts.green[4] === 0 && facts.green[5] === 0, 'kQ03: night check fails 14 to 21 days a month Feb to Jul 2027, no green day in Jun and Jul', `night fails ${facts.nightFail.join(' ')}, green ${facts.green.join(' ')}`);
  check(facts.lag >= 352 && facts.lag <= 356 && facts.r354 > 0.6 && facts.r365 < 0.2, 'kQ04: the green pattern repeats at 354 days, not 365', `best lag ${facts.lag}, r354 ${facts.r354.toFixed(2)}, r365 ${facts.r365.toFixed(2)}`);
  check(facts.sunPct > 80 && facts.sunPct < 91 && facts.equatorNight > 13.5 && facts.equatorNight < 15.5, 'kQ05: Sun up about 85% of 2027 at Peak near Shackleton; longest night about 14.7 days on the equator', `${facts.sunPct.toFixed(1)}%, ${facts.equatorNight.toFixed(1)} days`);
  check(facts.nearSun.length === 6 && facts.nearSun.every((s) => s[1] > 1.5 && s[1] < 3.1), 'kQ06: highest Sun about 2 to 3 degrees at the six sites nearest the pole', facts.nearSun.map((s) => `${s[0]} ${s[1]}`).join(', '));
  check(facts.floors.every((v) => v === 0), 'kQ11: Shackleton floor and Faustini floor never see the Sun in 2021 to 2031', facts.floors.join(' '));

  // ------------------------------------------------------------------ (c) a round through real clicks
  const btn = page.locator('.kq-btn');
  await btn.waitFor({ state: 'visible' });
  const inBar = await page.evaluate(() => { const b = document.querySelector('.kq-btn'), r = b.getBoundingClientRect(), cs = getComputedStyle(b); return { inside: !!b.closest('#kidbar'), order: cs.order, top: r.top, left: r.left, w: r.width, vis: r.width > 0 && r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth }; });
  check(inBar.inside && inBar.order === '3' && inBar.vis, 'the Quiz button sits in the map button column, order 3, on screen', JSON.stringify(inBar));
  await shot('0-map-button');
  await btn.click();
  await page.locator('#quiz').waitFor({ state: 'visible' });
  await page.waitForFunction(() => window.__quiz.state.q, null, { timeout: 20000 });
  check((await page.locator('.kq-prog').textContent()) === 'Question 1 of 5', 'progress shows Question 1 of 5');
  // a chosen round: three live and two static, so the screenshots and clicks cover both kinds
  await page.evaluate(() => window.__quiz.start(['kQ16', 'kQ02', 'kQ18', 'kQ09', 'kQ20']));
  const ids = ['kQ16', 'kQ02', 'kQ18', 'kQ09', 'kQ20'], picks = [], seen = [];
  for (let i = 0; i < 5; i++) {
    await page.waitForFunction((n) => window.__quiz.state.idx === n && window.__quiz.state.q && window.__quiz.state.picked == null, i, { timeout: 20000 });
    const info = await page.evaluate(() => { const s = window.__quiz.state, t = window.__quiz.text(s.q); return { id: s.q.id, right: t.options.findIndex((o) => o.correct), wrong: t.options.findIndex((o) => !o.correct), n: t.options.length, live: s.q.live, chip: !!document.querySelector('.kq-live') }; });
    seen.push(info.id);
    check(info.id === ids[i] && info.n === 4 && (await page.locator('.kq-prog').textContent()) === `Question ${i + 1} of 5` && info.chip === info.live, `question ${i + 1}: ${info.id} ${info.live ? '(live, with its chip)' : '(static)'}, 4 options, progress "Question ${i + 1} of 5"`);
    if (i === 0) await shot('1-question-live');
    if (i === 1) await shot('1b-question-static');
    const wrongTurn = i === 1 || i === 3; // questions 2 and 4 are answered wrongly
    const pick = wrongTurn ? info.wrong : info.right;
    picks.push(!wrongTurn);
    await page.locator(`.kq-opt[data-i="${pick}"]`).click();
    const after = await page.evaluate(() => ({ verdict: document.querySelector('.kq-verdict')?.textContent, right: document.querySelectorAll('.kq-opt.right').length, wrong: document.querySelectorAll('.kq-opt.wrong').length, why: [...document.querySelectorAll('.kq-why')].map((w) => w.textContent.length), next: document.querySelector('.kq-next')?.textContent, disabled: [...document.querySelectorAll('.kq-opt')].every((o) => o.getAttribute('aria-disabled') === 'true') }));
    check(after.verdict === (wrongTurn ? 'Not quite' : 'Correct!') && after.right === 1 && after.wrong === (wrongTurn ? 1 : 0) && after.why.length === (wrongTurn ? 2 : 1) && after.why.every((n) => n > 40) && after.disabled && after.next === (i === 4 ? 'See my score' : 'Next'),
      `question ${i + 1}: ${wrongTurn ? 'a wrong answer' : 'the right answer'}: "${after.verdict}", the right option marked${wrongTurn ? ', the chosen one marked wrong, both with a "why" line' : ' with its "why" line'}`);
    // an answered question cannot be answered again
    await page.locator(`.kq-opt[data-i="${info.wrong === pick ? info.right : info.wrong}"]`).click({ force: true });
    check(await page.evaluate((n) => window.__quiz.state.results.length === n + 1, i), `question ${i + 1}: a second click does not change the answer`);
    if (i === 0) await shot('2-correct-live');
    if (i === 1) await shot('3-wrong-static');
    if (i === 2) await shot('2b-correct-live-sites');
    if (i === 3) await shot('3b-wrong-chandrayaan');
    await page.locator('.kq-next').click();
  }
  await page.waitForSelector('.kq-end');
  const end = await page.evaluate(() => ({ score: document.querySelector('.kq-score').textContent, stars: document.querySelectorAll('.kq-stars i').length, lit: document.querySelectorAll('.kq-stars i.ok').length, msg: document.querySelector('.kq-msg').textContent.length, again: !!document.querySelector('.kq-again') }));
  const nRight = picks.filter(Boolean).length;
  check(end.score === `You got ${nRight} out of 5` && end.stars === 5 && end.lit === nRight && end.msg > 20 && end.again, `end screen: score "${end.score}", ${end.lit} of 5 stars lit, a friendly message, Play again`);
  await shot('4-end');
  await page.locator('.kq-again').click();
  await page.waitForFunction(() => window.__quiz.state.q && window.__quiz.state.idx === 0 && window.__quiz.state.results.length === 0 && !window.__quiz.state.ended, null, { timeout: 20000 });
  const again = await page.evaluate(() => ({ ids: window.__quiz.state.ids, prog: document.querySelector('.kq-prog').textContent }));
  check(again.ids.length === 5 && new Set(again.ids).size === 5 && again.prog === 'Question 1 of 5', 'Play again starts a new round of 5 different questions', again.ids.join(' '));
  // rounds are random: ten fresh rounds hold 5 distinct pool questions each and are not all the same
  const rounds = await page.evaluate(() => { const o = []; for (let i = 0; i < 10; i++) { window.__quiz.state.ended = true; window.__quiz.close(); window.__quiz.open(); o.push(window.__quiz.state.ids.join()); } return o; });
  check(new Set(rounds).size >= 8, 'ten new rounds are mostly different', `${new Set(rounds).size} different`);
  await page.keyboard.press('Escape');
  await page.locator('#quiz').waitFor({ state: 'hidden' });
  check(true, 'Escape closes the quiz');
  await btn.click(); await page.locator('#quiz').waitFor({ state: 'visible' });
  await page.locator('.kq-x').click(); await page.locator('#quiz').waitFor({ state: 'hidden' });
  check(true, 'the close button closes the quiz');

  // ------------------------------------------------------------------ (d) Russian and Kyrgyz, through the language buttons
  for (const [lang, re, sample, own] of [['ru', /[а-яё]/i, /Вопрос 1 из 5/, /[а-яё]/i], ['ky', /[а-яёөүң]/i, /Суроо 1 \/ 5/, /[өүң]/]]) {
    await page.locator(`#lang button[data-l="${lang}"]`).click();
    await page.evaluate(() => window.__quiz.start(['kQ16', 'kQ05', 'kQ19', 'kQ12', 'kQ22']));
    await page.waitForFunction(() => window.__quiz.state.q && window.__quiz.state.picked == null, null, { timeout: 20000 });
    const t1 = await page.evaluate(() => ({ btn: document.querySelector('.kq-btn').textContent, prog: document.querySelector('.kq-prog').textContent, q: document.querySelector('.kq-q').textContent, opts: [...document.querySelectorAll('.kq-txt')].map((x) => x.textContent), title: document.querySelector('#kq-title').textContent, live: document.querySelector('.kq-live')?.textContent }));
    const latin = (s) => (s.match(/[A-Za-z]/g) || []).length / s.length;
    check(re.test(t1.q) && own.test(t1.q + t1.opts.join('')) && sample.test(t1.prog) && t1.opts.every((o) => re.test(o)) && /Quiz|Question/.test(t1.q + t1.prog) === false && latin(t1.q) < 0.2, `${lang}: the question, options, progress and title are in the language`, `${t1.prog} | ${t1.q}`);
    await shot(`5-${lang}-question`);
    const right = await page.evaluate(() => window.__quiz.text(window.__quiz.state.q).options.findIndex((o) => o.correct));
    await page.locator(`.kq-opt[data-i="${right}"]`).click();
    await shot(`5-${lang}-correct`);
    await page.locator('.kq-next').click();
    await page.waitForFunction(() => window.__quiz.state.idx === 1 && window.__quiz.state.q && window.__quiz.state.picked == null);
    const wrong = await page.evaluate(() => window.__quiz.text(window.__quiz.state.q).options.findIndex((o) => !o.correct));
    await page.locator(`.kq-opt[data-i="${wrong}"]`).click();
    const t2 = await page.evaluate(() => ({ verdict: document.querySelector('.kq-verdict').textContent, whys: [...document.querySelectorAll('.kq-why')].map((w) => w.textContent), next: document.querySelector('.kq-next').textContent }));
    check(t2.whys.length === 2 && t2.whys.every((w) => re.test(w)) && !/Correct|Not quite|Next|Why this/.test(t2.verdict + t2.next + t2.whys.join()), `${lang}: after a wrong answer the verdict, both "why" lines and the buttons are in the language`, `${t2.verdict} | ${t2.next}`);
    await shot(`6-${lang}-wrong`);
    // the language changes while a question is open (the hook main.js calls after the buttons): the screen is drawn again, the answer kept
    const other = lang === 'ru' ? 'ky' : 'ru', before = await page.evaluate(() => window.__quiz.state.picked);
    await page.evaluate((l) => { window.I18n.set(l); window.__app.kid.lang.forEach((f) => f()); }, other);
    const sw = await page.evaluate(() => ({ picked: window.__quiz.state.picked, q: document.querySelector('.kq-q').textContent, whys: document.querySelectorAll('.kq-why').length }));
    check(sw.picked === before && sw.whys === 2 && sw.q.length > 10 && sw.q !== t1.q, `${lang} to ${other}: switching the language redraws the open question and keeps the answer`);
    await page.evaluate(() => window.I18n.set('en')); // leave: the next loop switches through the buttons
    await page.keyboard.press('Escape');
    await page.locator('#quiz').waitFor({ state: 'hidden' });
  }
  await page.locator('#lang button[data-l="en"]').click();

  // ------------------------------------------------------------------ (e) fit: every static question, answered wrongly, in three languages
  const fitBad = [];
  await btn.click(); await page.locator('#quiz').waitFor({ state: 'visible' });
  for (const lang of ['en', 'ru', 'ky']) {
    await page.locator('.kq-x').click(); await page.locator('#quiz').waitFor({ state: 'hidden' });
    await page.locator(`#lang button[data-l="${lang}"]`).click();
    await btn.click(); await page.locator('#quiz').waitFor({ state: 'visible' });
    for (const qid of ['kQ01', 'kQ02', 'kQ03', 'kQ04', 'kQ05', 'kQ06', 'kQ07', 'kQ08', 'kQ09', 'kQ10', 'kQ11', 'kQ12', 'kQ13', 'kQ14', 'kQ15', 'kQ16', 'kQ17', 'kQ18', 'kQ19', 'kQ20', 'kQ21', 'kQ22', 'kQ23', 'kQ24', 'kQ25']) {
      await page.evaluate((id) => window.__quiz.start([id, 'kQ01', 'kQ01', 'kQ01', 'kQ01']), qid);
      await page.waitForFunction((id) => window.__quiz.state.q && window.__quiz.state.q.id === id && window.__quiz.state.picked == null, qid, { timeout: 20000 });
      // answer wrongly so the right option's explanation and the chosen one's both show
      const wrong = await page.evaluate(() => window.__quiz.text(window.__quiz.state.q).options.findIndex((o) => !o.correct));
      await page.locator(`.kq-opt[data-i="${wrong}"]`).click();
      const m = await page.evaluate(() => {
        const card = document.querySelector('.kq-card').getBoundingClientRect(), main = document.querySelector('.kq-main'), foot = document.querySelector('.kq-foot').getBoundingClientRect(), next = document.querySelector('.kq-next').getBoundingClientRect();
        main.scrollTop = main.scrollHeight;
        const mr = main.getBoundingClientRect(), last = [...main.querySelectorAll('.kq-why')].pop().getBoundingClientRect(), opts = [...main.querySelectorAll('.kq-opt')].map((o) => o.getBoundingClientRect());
        return { cardIn: card.left >= -0.5 && card.top >= -0.5 && card.right <= innerWidth + 0.5 && card.bottom <= innerHeight + 0.5, hx: main.scrollWidth > main.clientWidth + 1 || document.documentElement.scrollWidth > innerWidth + 1,
          nextIn: next.top >= card.top && next.bottom <= innerHeight + 0.5 && next.right <= innerWidth + 0.5 && next.left >= -0.5, lastShown: last.bottom <= mr.bottom + 1 && last.top >= mr.top - 1 || last.height > mr.height, optsW: opts.every((r) => r.left >= mr.left - 0.5 && r.right <= mr.right + 0.5), foot: foot.height };
      });
      if (!m.cardIn || m.hx || !m.nextIn || !m.lastShown || !m.optsW) fitBad.push(`${lang} ${qid} ${JSON.stringify(m)}`);
    }
  }
  check(fitBad.length === 0, `layout at ${tag}: 25 questions x 3 languages, answered wrongly: the card is inside the screen, no sideways scroll, Next in view, the last explanation reachable by scrolling inside the card, options inside it`, fitBad.slice(0, 3).join(' | '));
  // the longest static question in the longest language, for a picture
  await page.evaluate(() => window.__quiz.start(['kQ05', 'kQ01', 'kQ01', 'kQ01', 'kQ01'])); // the language is still Kyrgyz here, the last of the loop
  await page.waitForFunction(() => window.__quiz.state.q && window.__quiz.state.q.id === 'kQ05' && window.__quiz.state.picked == null);
  await page.locator(`.kq-opt[data-i="${await page.evaluate(() => window.__quiz.text(window.__quiz.state.q).options.findIndex((o) => !o.correct))}"]`).click();
  await shot('7-long-explanation-ky');
  await page.locator('.kq-x').click();
  await page.locator(`#lang button[data-l="en"]`).click();

  check(errs.length === 0, 'no page errors or console errors', errs.slice(0, 3).join(' | '));
  await b.close(); if (srv) srv.close();
  if (failures) { console.error(`\nFAIL: ${failures} check(s) failed at ${tag}`); process.exit(1); }
  console.log(`\nquiz works at ${tag}`);
})().catch((e) => { console.error(e); process.exit(1); });
