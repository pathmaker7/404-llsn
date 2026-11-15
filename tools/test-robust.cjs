// Solid or borderline test. Run: node tools/test-robust.cjs
//   BASE_URL=https://...   test a deployed site instead of the local app folder
//   VIEWPORT=390x844       window size (default 1440x900)
//   SHOTS=/some/dir        where screenshots go (default: robust-shots in the system temp folder)
// One line per check; exit code 1 on any failed check or page error.
// The line under the checks of the answer panel says SOLID or BORDERLINE. The test opens a site with real clicks, walks the day strip,
// and recomputes every claim itself: the neighbour days by pressing the day buttons (window.__verdict), the terrain 0.2 degrees higher
// and lower by its own loop over the hours of the stay (own code, own thresholds, from the site's stored Sun and Earth directions).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { serve, launch } = require('./smoke.cjs');

const [VW, VH] = (process.env.VIEWPORT || '1440x900').split('x').map(Number);
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'robust-shots');
const TAG = `${VW}x${VH}`;
const fails = [];
const check = (ok, name, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); if (!ok) fails.push(name); };
const DAY = 86400;

// What the English line must say for a set of flips (written here by hand, not taken from the app).
const EN = { earlier: 'one day earlier', later: 'one day later', high: 'with the terrain 0.2° higher', low: 'with the terrain 0.2° lower' };
function expectEn(f, ok) {
  const bad = Object.keys(EN).filter((k) => f[k]);
  if (!bad.length) return { word: 'Solid', text: 'the answer holds one day earlier or later, and with the terrain 0.2° higher or lower.' };
  const d = f.earlier && f.later ? 'one day earlier or later' : f.earlier ? EN.earlier : f.later ? EN.later : '';
  const t = f.high && f.low ? 'with the terrain 0.2° higher or lower' : f.high ? EN.high : f.low ? EN.low : '';
  return { word: 'Borderline', text: `this landing ${ok ? 'is lost' : 'survives'} ${[d, t].filter(Boolean).join(', or ')}.` };
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
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console error: ' + m.text()); });
  p.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(url.replace(/\/$/, ''))) errs.push(`${r.status()} ${r.url()}`); });
  const shot = (name) => p.screenshot({ path: path.join(SHOTS, `robust-${TAG}-${name}.png`) });
  const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
  const ms = [];

  // What the page holds right now: the answer panel's numbers, the line, its facts.
  const read = () => p.evaluate(() => { const l = document.getElementById('rb-line'), R = window.__robust, V = window.__verdict;
    return { date: V.date, ok: V.ok, rows: V.rows.map((r) => ({ id: r.id, ok: r.ok, v: r.v })), facts: R && JSON.parse(JSON.stringify(R)), shown: !!l,
      word: l ? l.querySelector('.rb-word b').textContent : null, text: l ? l.querySelector('.rb-text').textContent : null, cls: l ? l.className : null }; });
  const settle = async (date) => { await p.waitForFunction((d) => window.__verdict && window.__verdict.date === d && window.__robust && window.__robust.date === d && document.getElementById('rb-line'), date, { timeout: 30000 }); };
  const openSite = async (id) => {
    await p.locator(`#sites li[data-id="${id}"] button`).click();
    await p.waitForFunction(() => window.__verdict && document.body.classList.contains('mode-surface') && window.__robust && document.getElementById('rb-line'), null, { timeout: 90000 });
    await p.waitForTimeout(300);
  };
  const strip = () => p.evaluate(() => [...document.querySelectorAll('.days .day')].map((d) => ({ t: +d.dataset.t, ok: d.classList.contains('ok') })));
  // A day of the strip by a real click when the strip shows it, else typed into the date box of the panel.
  const clickDay = async (t) => { const b = p.locator(`.days .day[data-t="${t}"]`); if (await b.count()) { await b.click(); await settle(iso(t)); } else await toDate(iso(t)); };
  async function toDate(date) { await p.fill('#v-day', date); await p.dispatchEvent('#v-day', 'change'); await settle(date); }
  // Neighbours by the day buttons of the panel: the arrows beside the date box.
  const neighbours = async (date) => {
    await p.locator('.v-date > button').first().click(); await settle(iso(Date.parse(date + 'T00:00:00Z') / 1000 - DAY)); const earlier = (await read()).ok;
    await p.locator('.v-date > button').nth(1).click(); await settle(date);
    await p.locator('.v-date > button').nth(1).click(); await settle(iso(Date.parse(date + 'T00:00:00Z') / 1000 + DAY)); const later = (await read()).ok;
    await p.locator('.v-date > button').first().click(); await settle(date);
    return { earlier, later };
  };

  // The test's own judge of one landing with the horizon moved by `shift` degrees: its own loops and thresholds
  // (night = hours in a row with less than half the Sun above the horizon, silence = hours in a row with Earth below it,
  // first sunlight within 24 h), from the Sun and Earth directions the site stores for every hour.
  await p.addInitScript(() => {
    const DAY_ = 86400;
    window.__tt = {
      async own(t, W, shift, slopeOk) {
        const { sunFraction, maskLookup } = await import(location.origin + '/src/science.js'), site = window.__app.S.site, { ch, meta } = site, M = window.Mission.limits;
        const mask = meta.mask.el_deg.map((v) => v + shift), step = meta.mask.az_step_deg, i0 = Math.round((t - site.t0) / 3600);
        let dark = 0, gap = 0, maxDark = 0, maxGap = 0, wait = -1;
        for (let k = 0; k < W; k++) {
          const i = i0 + k, sun = sunFraction(ch.sunAz[i], ch.sunEl[i], ch.sunR[i], mask, step) >= 0.5, earth = ch.earthEl[i] > maskLookup(mask, step, ch.earthAz[i]);
          dark = sun ? 0 : dark + 1; gap = earth ? 0 : gap + 1; maxDark = Math.max(maxDark, dark); maxGap = Math.max(maxGap, gap);
          if (sun && wait < 0) wait = k;
        }
        return slopeOk && maxDark <= M.nightH && maxGap <= M.silenceH && wait >= 0 && wait < 24;
      },
      // Over nDays landing days from t: the app's own helper next to the test's own judge, and the days where only the terrain flips.
      async scan(t, nDays, W) {
        const { judgeWithHorizon } = await import(location.origin + '/src/robust.js'), { judgeAt } = await import(location.origin + '/src/verdict.js'), site = window.__app.S.site, memo = new Map();
        const base = async (ts) => { if (!memo.has(ts)) memo.set(ts, await window.__tt.own(ts, W, 0, true)); return memo.get(ts); };
        let mismatch = 0, terrainOnly = [], terrainAny = 0, appBase = 0;
        for (let d = 0; d < nDays; d++) {
          const ts = t + d * DAY_, ok = await base(ts), hi = await window.__tt.own(ts, W, 0.2, true), lo = await window.__tt.own(ts, W, -0.2, true);
          const c = { site, t: ts, W, slope: 0, evaSlope: 0, judgeAt };
          const a0 = judgeWithHorizon(c, 0).ok, a1 = judgeWithHorizon(c, 0.2).ok, a2 = judgeWithHorizon(c, -0.2).ok;
          if (a0 !== ok) appBase++;
          if (a1 !== hi || a2 !== lo) mismatch++;
          if (hi !== ok || lo !== ok) { terrainAny++; if ((await base(ts - DAY_)) === ok && (await base(ts + DAY_)) === ok) terrainOnly.push({ date: new Date(ts * 1000).toISOString().slice(0, 10), ok, hi, lo }); }
        }
        return { mismatch, terrainAny, terrainOnly, appBase };
      },
    };
  });

  await p.goto(url);
  await p.waitForFunction(() => window.__all && window.__all.ready, null, { timeout: 120000 });
  const ids = await p.evaluate(() => [...document.querySelectorAll('#sites li.a-row')].map((l) => l.dataset.id));

  // 1. Find, by real clicks, a site with a long green run, a green day before a red one and a red day after a green one.
  let found = null, scanned = null, scanSite = null;
  for (const id of ids) {
    await openSite(id);
    const first = await read();
    if (first.rows.find((r) => r.id === 'slope').ok === false) { await p.click('#back'); await p.waitForTimeout(500); await p.evaluate(() => { window.__verdict = null; window.__robust = null; }); continue; }
    const s = await strip();
    const mid = [], g2r = [], r2g = [];
    for (let i = 0; i < s.length; i++) {
      if (s[i].ok && s[i + 1] && !s[i + 1].ok) g2r.push(i);
      if (!s[i].ok && i > 0 && s[i - 1].ok) r2g.push(i);
    }
    for (let i = 0; i < s.length;) { let j = i; while (j < s.length && s[j].ok === s[i].ok) j++; if (s[i].ok && j - i >= 5) mid.push(i + ((j - i) >> 1)); i = j; }
    if (mid.length && g2r.length && r2g.length) { found = { id, s, mid, g2r, r2g }; break; }
    await p.click('#back'); await p.waitForTimeout(500); await p.evaluate(() => { window.__verdict = null; window.__robust = null; });
  }
  check(!!found, 'a site with a long green run, a green day before a red one and a red day after a green one was found', found && `${found.id}: ${found.mid.length} run centres, ${found.g2r.length} green to red, ${found.r2g.length} red to green`);
  if (!found) { console.log(`\n${fails.length} failed`); await b.close(); if (srv) srv.close(); process.exit(1); }
  console.log(`     site ${found.id}`);

  // 2. The line is shown, under the checks and above the footnote, with a word and a mark.
  const day0 = await read();
  const lay = await p.evaluate(() => { const l = document.getElementById('rb-line'), r = l.getBoundingClientRect(), tb = document.querySelector('.v-rows').getBoundingClientRect(), nt = document.querySelector('.v-note').getBoundingClientRect(), box = document.getElementById('v-extra');
    return { shown: r.width > 0 && r.height > 0 && getComputedStyle(l).visibility !== 'hidden', inExtra: l.parentElement === box, below: r.top >= tb.bottom - 1, above: r.bottom <= nt.top + 1, h: Math.round(r.height), w: Math.round(r.width) }; });
  check(lay.shown && lay.inExtra && lay.below && lay.above, 'the line is shown in #v-extra, under the checks and above the footnote', JSON.stringify(lay));
  check(day0.facts && /^(Solid|Borderline)$/.test(day0.word) && !!day0.text, 'it carries a word and a sentence', `${day0.word}: ${day0.text}`);
  await shot('1-first');

  // 3. A test case: click a day of the strip, then compare the line with what the test works out itself.
  const marks = {};
  const judgeDay = async (label, idx, want) => {
    await clickDay(found.s[idx].t);
    const r = await read(), date = r.date, t = Date.parse(date + 'T00:00:00Z') / 1000, W = await p.evaluate(() => Math.round(window.__app.S.missionDays * 24));
    const nb = await neighbours(date), slopeOk = r.rows.find((x) => x.id === 'slope').ok;
    const own0 = await p.evaluate(([t, W, s]) => window.__tt.own(t, W, 0, s), [t, W, slopeOk]);
    const hi = await p.evaluate(([t, W, s]) => window.__tt.own(t, W, 0.2, s), [t, W, slopeOk]), lo = await p.evaluate(([t, W, s]) => window.__tt.own(t, W, -0.2, s), [t, W, slopeOk]);
    const flips = { earlier: nb.earlier !== r.ok, later: nb.later !== r.ok, high: hi !== r.ok, low: lo !== r.ok }, exp = expectEn(flips, r.ok), f = r.facts;
    ms.push(f.ms);
    check(own0 === r.ok, `${label}: the test's own judge agrees with the panel on the shown day (${date})`, `panel ${r.ok}, own ${own0}`);
    check(r.word === exp.word && r.text === exp.text, `${label}: the line says what the test works out`, `"${r.word}: ${r.text}"`);
    check(JSON.stringify(f.flips) === JSON.stringify(flips) && f.state === (exp.word === 'Solid' ? 'solid' : 'borderline'), `${label}: __robust holds the same four tests`, JSON.stringify(f.flips));
    if (want) check(want(r, flips, exp), `${label}: ${want.about}`, `night ${r.rows.find((x) => x.id === 'night').v} h, silence ${r.rows.find((x) => x.id === 'radio').v} h`);
    return { r, flips, exp, date };
  };

  // 3a. the middle of a long green run with comfortable margins says Solid (first run centre where the test itself finds nothing flips)
  let solid = null;
  for (const idx of found.mid) {
    await clickDay(found.s[idx].t);
    const r = await read(), M = await p.evaluate(() => window.Mission.limits), night = r.rows.find((x) => x.id === 'night').v, radio = r.rows.find((x) => x.id === 'radio').v;
    if (night > M.nightH - 12 || radio > M.silenceH - 12) continue; // margins under half a day: not "comfortable"
    const W = await p.evaluate(() => Math.round(window.__app.S.missionDays * 24)), t = Date.parse(r.date + 'T00:00:00Z') / 1000;
    const hi = await p.evaluate(([t, W]) => window.__tt.own(t, W, 0.2, true), [t, W]), lo = await p.evaluate(([t, W]) => window.__tt.own(t, W, -0.2, true), [t, W]);
    if (!hi || !lo) continue;
    solid = idx; break;
  }
  check(solid !== null, 'a day in the middle of a long green run with comfortable margins exists', solid !== null ? `strip position ${solid}` : 'none');
  if (solid !== null) {
    const s = await judgeDay('solid day', solid, Object.assign((r, f, e) => e.word === 'Solid' && r.ok === true && /^the answer holds one day earlier or later/.test(e.text), { about: 'it is Solid' }));
    marks.solid = await p.evaluate(() => { const m = document.querySelector('#rb-line .rb-mark'), r = m.getBoundingClientRect(), c = getComputedStyle(m); return { w: Math.round(r.width), h: Math.round(r.height), bg: c.backgroundColor, border: c.borderTopWidth, color: c.color }; });
    await shot('2-solid');
    // the tooltip: the app's pattern, with the whole explanation, the team's own 0.2 degrees, and the numbers of the two deciding checks
    const tip = await p.evaluate(() => { const e = document.querySelector('#rb-line .tip'); return { cls: e.className, tabindex: e.getAttribute('tabindex'), tip: e.dataset.tip }; });
    check(/\btip\b/.test(tip.cls) && tip.tabindex === '0' && /four times/.test(tip.tip) && /one day earlier, one day later/.test(tip.tip) && /0\.2° higher and 0\.2° lower/.test(tip.tip) && /our own test value, not a NASA figure/.test(tip.tip) && /Longest night \d+ h against 48 h allowed\. Longest radio silence \d+ h against 72 h allowed\./.test(tip.tip),
      'the tooltip (class tip, tabindex 0) names the four tests, calls 0.2° our own value and gives the two margins', tip.tip);
    check(!/["<]/.test(tip.tip), 'the tooltip has no quote or tag that could break the page');
    await p.hover('#rb-line .tip');
    const shownTip = await p.evaluate(() => getComputedStyle(document.querySelector('#rb-line .tip'), '::after').content);
    check(/not a NASA figure/.test(shownTip), 'hovering the word shows the tooltip', shownTip.slice(0, 60) + '...');
    await p.waitForTimeout(700); // other plug-ins fade things in
    await shot('3-solid-tip');
    await p.mouse.move(2, 2);
  }

  // 3b. the last green day before a red one: Borderline, and it names one day later
  const g = found.g2r[0], bl = await judgeDay('green before red', g, Object.assign((r, f, e) => e.word === 'Borderline' && f.later && /^this landing is lost one day later/.test(e.text) && r.ok === true, { about: 'it is Borderline and names one day later' }));
  marks.borderline = await p.evaluate(() => { const m = document.querySelector('#rb-line .rb-mark'), r = m.getBoundingClientRect(), c = getComputedStyle(m); return { w: Math.round(r.width), h: Math.round(r.height), bg: c.backgroundColor, border: c.borderTopWidth, color: c.color }; });
  await shot('4-borderline');
  // 3c. the first red day after a green one: Borderline, and it names one day earlier, in the other direction (lost becomes survived)
  const rg = found.r2g[0], lg = await judgeDay('red after green', rg, Object.assign((r, f, e) => e.word === 'Borderline' && f.earlier && /^this landing survives one day earlier/.test(e.text) && r.ok === false, { about: 'it is Borderline and names one day earlier, "survives"' }));
  await shot('5-borderline-lost');

  // 4. A solid mark against a hollow mark, the same size, and a different word: the state is not carried by size or colour alone.
  const sm = marks.solid, bm = marks.borderline;
  check(!!sm && sm.w === bm.w && sm.h === bm.h && sm.w > 0, 'the two marks are the same size', sm && `${sm.w}x${sm.h} against ${bm.w}x${bm.h}`);
  check(!!sm && sm.bg !== 'rgba(0, 0, 0, 0)' && bm.bg === 'rgba(0, 0, 0, 0)' && sm.border === bm.border, 'Solid is a filled mark, Borderline a hollow one (same border)', sm && `${sm.bg} against ${bm.bg}`);

  // 5. The helper and the test's own judge agree on hundreds of days; a day where only the terrain flips shows up in the line.
  let scan = null;
  for (const id of [found.id, ...ids.filter((x) => x !== found.id)]) {
    if (id !== found.id) { await p.click('#back'); await p.waitForTimeout(500); await openSite(id); if ((await read()).rows.find((r) => r.id === 'slope').ok === false) continue; }
    const t0 = Date.parse(iso(Date.now() / 1000) + 'T00:00:00Z') / 1000, W = await p.evaluate(() => Math.round(window.__app.S.missionDays * 24));
    const r = await p.evaluate(([t, n, W]) => window.__tt.scan(t, n, W), [t0, 400, W]);
    scanned = (scanned || { days: 0, mismatch: 0, appBase: 0, terrainAny: 0 }); scanned.days += 400; scanned.mismatch += r.mismatch; scanned.appBase += r.appBase; scanned.terrainAny += r.terrainAny;
    if (r.terrainOnly.length) { scan = r.terrainOnly[0]; scanSite = id; break; }
  }
  check(!!scanned && scanned.mismatch === 0 && scanned.appBase === 0, 'the app\'s horizon recomputation equals the test\'s own judge on every scanned day, at 0°, +0.2° and -0.2°', scanned && `${scanned.days} days, ${scanned.mismatch} mismatches, ${scanned.appBase} baseline differences`);
  check(!!scan, 'a day exists where only the terrain 0.2° flips the answer (the terrain test is not idle)', scan ? `${scanSite} ${scan.date}: shown ${scan.ok}, higher ${scan.hi}, lower ${scan.lo}; ${scanned.terrainAny} such days scanned` : 'none in ' + scanned.days + ' days');
  if (scan) {
    await toDate(scan.date);
    const r = await read(), exp = expectEn({ earlier: false, later: false, high: scan.hi !== scan.ok, low: scan.lo !== scan.ok }, scan.ok);
    check(r.word === 'Borderline' && r.text === exp.text && r.facts.flips.earlier === false && r.facts.flips.later === false && (r.facts.flips.high || r.facts.flips.low) && /terrain/.test(r.text), 'on that day the line is Borderline and names only the terrain', `${scan.date}: "${r.word}: ${r.text}"`);
    await shot('6-terrain-only');
  }

  if (scanSite && scanSite !== found.id) { await p.click('#back'); await p.waitForTimeout(500); await openSite(found.id); } // the language checks use the first site's days

  // 6. Speed: the panel renders again on every date change, so the work must stay small.
  check(ms.length > 0 && Math.max(...ms) < 20, 'the work behind the line stays under 20 ms per render', `slowest ${Math.max(...ms).toFixed(1)} ms over ${ms.length} renders, mean ${(ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(1)} ms`);

  // 7. Russian and Kyrgyz: the buttons change the line; the words and phrases are the ones a reader of that language expects.
  const sentence = async () => { const r = await read(); return `${r.word}: ${r.text}`; };
  const L = { ru: { solid: 'Надёжно: ответ остаётся тем же при посадке на день раньше или позже, и при рельефе на 0,2° выше или ниже.', word: 'На грани', later: 'при посадке на день позже', lost: 'миссия будет потеряна', tip: /не цифра NASA/ },
    ky: { solid: 'Бекем: жооп өзгөрбөйт: конуу бир күн эрте же кеч болсо да, рельеф 0,2° жогору же төмөн болсо да.', word: 'Чек арада', later: 'конуу бир күн кеч болсо', lost: 'бул конуу жоголот.', tip: /NASA берген сан эмес/ } };
  for (const l of ['ru', 'ky']) {
    await p.locator(`#lang button[data-l="${l}"]`).click();
    await p.waitForFunction((l) => document.documentElement.lang === l || (window.I18n && window.I18n.lang === l), l, { timeout: 10000 });
    await toDate(bl.date);
    const b1 = await read(), tipText = await p.evaluate(() => document.querySelector('#rb-line .tip').dataset.tip);
    check(b1.word === L[l].word && b1.text.includes(L[l].later) && b1.text.includes(L[l].lost), `${l}: the borderline day reads in the language (${bl.date})`, `${b1.word}: ${b1.text}`);
    check(L[l].tip.test(tipText) && !/[A-Za-z]{4,}/.test(tipText.replace(/NASA/g, '')), `${l}: the tooltip is in the language and calls 0,2° the team's own value`, tipText.slice(0, 70));
    await shot(`7-${l}`);
  }
  // the solid sentence in Russian and Kyrgyz, on a day the test knows is solid
  if (solid !== null) {
    const sd = (await (async () => { await p.locator('#lang button[data-l="en"]').click(); await toDate(iso(found.s[solid].t)); return read(); })()).date;
    for (const l of ['ru', 'ky']) {
      await p.locator(`#lang button[data-l="${l}"]`).click(); await toDate(sd);
      check((await sentence()) === L[l].solid, `${l}: the solid sentence reads in the language`, await sentence());
    }
    await p.locator('#lang button[data-l="en"]').click(); await toDate(sd);
  }

  // 8. Nothing overflows: the line, the panel and the page stay inside the screen, the tooltip too.
  const fit = await p.evaluate(() => { const l = document.getElementById('rb-line'), r = l.getBoundingClientRect(), W = window.innerWidth, v = document.getElementById('verdict'), t = l.querySelector('.tip').getBoundingClientRect(), tipW = Math.min(300, 0.7 * W);
    return { ok: r.left >= 0 && r.right <= W && l.scrollWidth <= l.clientWidth + 1 && v.scrollWidth <= v.clientWidth + 1 && document.documentElement.scrollWidth <= W && t.left + tipW <= W + 1, r: [r.left, r.right].map(Math.round), W, lsw: l.scrollWidth, lcw: l.clientWidth, vsw: v.scrollWidth, vcw: v.clientWidth, doc: document.documentElement.scrollWidth, tipRight: Math.round(t.left + tipW) }; });
  check(fit.ok, `nothing overflows at ${TAG} (line, panel, page, tooltip)`, JSON.stringify(fit));
  await p.locator('#rb-line .tip').focus(); await p.waitForTimeout(700); await shot('8-focus-tip');

  check(errs.length === 0, 'no page error, no console error, no failed request', errs.join(' | '));
  console.log(fails.length ? `\n${fails.length} failed: ${fails.join('; ')}` : '\nall passed');
  await b.close(); if (srv) srv.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
