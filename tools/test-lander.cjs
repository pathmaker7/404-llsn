// My lander: the drop, the card and the first person lander, played like a visitor. Run: node tools/test-lander.cjs
// Env: BASE_URL (test a deployed site instead of the local app), VIEWPORT (1440x900 default, or 1920x1080, 390x844),
//      SHOTS (directory for screenshots).
// Checks: the drop ends with the verdict of the grid cell (thousands of site and day pairs by the verdict code, dozens
// through the drop itself, and real clicks on grid cells); the card keeps its choices over a reload; a crafted name is text,
// never markup; the first person lander shows the same verdict and follows the day; the texts come out in three languages.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright-core');
const { serve, launch } = require('./smoke.cjs');

const [VW, VH] = (process.env.VIEWPORT || '1440x900').split('x').map(Number);
const PHONE = VW <= 760;
const SHOTS = process.env.SHOTS || '/private/tmp/claude-501/-Users-agentsinc-Desktop-NASA-Naryn/4ec727e1-b59d-4e91-8d93-17544d5a3cfb/scratchpad/lander';
try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (e) { /* the screenshots are optional */ }
const tag = `${VW}x${VH}`;
const fails = [], shots = [];
const check = (name, ok, detail) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ' ' + JSON.stringify(detail)}`); if (!ok) fails.push(name); };
let seed = +process.env.SEED || 20261115; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);

(async () => {
  let srv = null, url = process.env.BASE_URL;
  if (!url) { srv = await serve(path.join(__dirname, '..', 'app')); url = `http://127.0.0.1:${srv.address().port}/`; }
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH } });
  await ctx.addInitScript(() => { try { localStorage.setItem('kidHelp', 'off'); } catch (e) { /* no storage */ } }); // the first visit help has its own test (test-tour.cjs)
  const page = await ctx.newPage(), errs = [];
  page.on('pageerror', (e) => errs.push('page error: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  page.on('dialog', (d) => { errs.push('dialog opened: ' + d.message()); d.dismiss(); });
  const shot = async (name, o = {}) => { const f = path.join(SHOTS, `lander-${tag}-${name}.png`); await page.screenshot({ path: f, ...o }); shots.push(f); };
  const boot = async (hash = '') => {
    // Leave only when the page has stopped fetching: Safari's engine reports a download cut short by leaving the page as a
    // page error ("TypeError: Load failed"), which is this test's own doing and not a fault of the app.
    await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
    await page.goto(url + hash); await page.waitForFunction(() => window.__all && window.__all.ready && window.__lander && window.__app && window.__app.ready, null, { timeout: 150000 });
    await page.waitForFunction(() => !window.__app.overview.anim, null, { timeout: 30000 }); await page.waitForTimeout(500);
  };

  await page.goto(url); await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* blocked */ } });
  await boot();

  // ---- 1. the card: there at first load, open on a desktop and closed on a phone, a default lander is ready
  const c0 = await page.evaluate(() => { const c = document.querySelector('#kidbar .kl-card'); return c && { closed: c.classList.contains('closed'), inBar: !!c.closest('#kidbar'), order: getComputedStyle(c).order, cfg: __lander.cfg, hats: c.querySelectorAll('.kl-hat img').length, sw: c.querySelectorAll('.kl-swatch').length, types: c.querySelectorAll('.kl-pill').length }; });
  check('the card sits in the kid bar with its choices', !!c0 && c0.inBar && c0.order === '1' && c0.sw === 6 && c0.types === 3, c0);
  check(PHONE ? 'on a phone the card is closed' : 'on a desktop the card is open', c0 && c0.closed === PHONE, c0 && c0.closed);
  check('a default lander is ready, nothing required', c0 && c0.cfg.type === 'lander' && c0.cfg.name === 'Naryn-1' && /^#[0-9a-f]{6}$/.test(c0.cfg.color) && c0.cfg.hat === 'kyrgyz', c0 && c0.cfg);
  check('every hat has its picture (4 hats and the no hat sign)', c0 && c0.hats === 5, c0 && c0.hats);
  if (PHONE) { await page.click('.kl-toggle'); await page.waitForTimeout(600); }
  const open = await page.evaluate(() => { const r = document.querySelector('.kl-card').getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: innerWidth, h: innerHeight, scrollW: document.documentElement.scrollWidth }; });
  check('the open card fits the screen, no sideways scroll', open.left >= 0 && open.right <= open.w && open.scrollW <= open.w, open);
  if (!PHONE) { const sl = await page.evaluate(() => document.getElementById('sitelist').getBoundingClientRect().top); check('the open card leaves the day table free', open.bottom <= sl + 2, { cardBottom: open.bottom, tableTop: sl }); }
  await page.waitForTimeout(500);
  await shot('card', PHONE ? {} : { clip: { x: 0, y: 56, width: Math.min(340, VW), height: Math.min(open.bottom + 10, VH) - 56 } });
  if (PHONE) await shot('phone-card-open');

  // ---- 2. customise with real clicks; the choice survives a reload (localStorage "myLander")
  await page.click('.kl-pill[data-type="rover"]'); await page.click('.kl-swatch[data-i="3"]'); await page.click('.kl-hat[data-hat="uzbek"]');
  await page.fill('.kl-input', 'Aigul-7'); await page.waitForTimeout(200);
  const st = await page.evaluate(() => ({ cfg: __lander.cfg, raw: localStorage.getItem('myLander') }));
  check('the card writes localStorage myLander as { type, color, name, hat }', (() => { try { const o = JSON.parse(st.raw); return Object.keys(o).sort().join() === 'color,hat,name,type' && o.type === 'rover' && o.color === '#3b82f6' && o.name === 'Aigul-7' && o.hat === 'uzbek'; } catch (e) { return false; } })(), st);
  await shot('custom');
  await boot();
  const st2 = await page.evaluate(() => ({ cfg: __lander.cfg, input: document.querySelector('.kl-input').value, on: [...document.querySelectorAll('.kl-card .on')].map((b) => b.dataset.type || b.dataset.color || b.dataset.hat) }));
  check('type, colour, name and hat survive a reload', st2.cfg.type === 'rover' && st2.cfg.color === '#3b82f6' && st2.cfg.name === 'Aigul-7' && st2.cfg.hat === 'uzbek' && st2.input === 'Aigul-7' && st2.on.length === 3, st2);
  // storage that holds nonsense falls back to the default instead of breaking the page
  await page.evaluate(() => localStorage.setItem('myLander', '{"type":"tank","color":"red","name":42,"hat":"cap"}')); await boot();
  const bad = await page.evaluate(() => __lander.cfg);
  check('a broken stored choice falls back to the default', bad.type === 'lander' && /^#[0-9a-f]{6}$/.test(bad.color) && bad.hat === 'kyrgyz' && bad.name === '42', bad);

  // ---- 3. a name is text, never markup
  const evil = '<img src=x onerror="window.__xss=1"><b>hi</b>';
  if (PHONE) await page.click('.kl-toggle');
  // Other features keep their own <b> in the button column (the ice hunter badge): count only tags the name adds.
  const bold0 = await page.evaluate(() => document.querySelectorAll('.kl-card b, #kidbar b').length);
  await page.fill('.kl-input', evil); await page.waitForTimeout(300);
  let x1 = await page.evaluate((b0) => ({ cfg: __lander.cfg.name, ran: window.__xss === 1, imgs: document.querySelectorAll('img[src="x"]').length, bold: document.querySelectorAll('.kl-card b, #kidbar b').length - b0 }), bold0);
  check('a crafted name typed into the card runs no script and makes no tags', !x1.ran && !x1.imgs && !x1.bold && !/[<>"=]/.test(x1.cfg) && x1.cfg.length <= 20, x1);
  await page.evaluate((e) => localStorage.setItem('myLander', JSON.stringify({ type: 'hopper', color: '#a855f7', name: e, hat: 'tajik' })), evil); await boot();
  const x2 = await page.evaluate(() => ({ cfg: __lander.cfg, ran: window.__xss === 1, imgs: document.querySelectorAll('img[src="x"]').length, val: document.querySelector('.kl-input').value }));
  check('a crafted name read from storage is cleaned and shown as text', !x2.ran && !x2.imgs && !/[<>"=]/.test(x2.cfg.name) && x2.cfg.name.length <= 20 && x2.val === x2.cfg.name, x2);
  await page.evaluate(() => localStorage.setItem('myLander', JSON.stringify({ type: 'lander', color: '#e5484d', name: 'x'.repeat(60), hat: 'kyrgyz' }))); await boot();
  check('a name longer than 20 characters is cut', (await page.evaluate(() => __lander.cfg.name.length)) === 20);
  await page.evaluate(() => localStorage.setItem('myLander', JSON.stringify({ type: 'lander', color: '#e5484d', name: 'Naryn-1', hat: 'kyrgyz' }))); await boot();

  // ---- 4. the verdict of the drop is the verdict of the grid cell
  const ids = await page.evaluate(() => __all.rows.map((r) => r.id));
  const dayT = () => { const t0 = Date.parse('2021-01-01T00:00:00Z') / 1000, t1 = Date.parse('2031-12-31T00:00:00Z') / 1000 - 15 * 86400; return Math.floor((t0 + rnd() * (t1 - t0)) / 86400) * 86400; };
  const pairs = Array.from({ length: 3000 }, () => ({ id: ids[Math.floor(rnd() * ids.length)], t: dayT() }));
  const m1 = await page.evaluate(async (pairs) => {
    let bad = [], ok = 0, lost = 0; const failed = {};
    for (const p of pairs) { const r = await __lander.judge(p.id, p.t), date = new Date(p.t * 1000).toISOString().slice(0, 10), cell = __all.at(p.id, date);
      const first = r.rows.find((x) => x.pri === 'must' && x.ok === false);
      if (r.ok !== cell || (first ? first.id : null) !== r.failed || r.ok === !!r.failed || !r.line || /[{}]|NaN|undefined|Infinity/.test(r.line)) { if (bad.length < 4) bad.push({ id: p.id, date, ok: r.ok, cell, failed: r.failed, line: r.line }); }
      r.ok ? ok++ : lost++; if (r.failed) failed[r.failed] = (failed[r.failed] || 0) + 1; }
    return { bad, ok, lost, failed, n: pairs.length };
  }, pairs);
  check(`the verdict, the failed check and its line match the grid cell for ${m1.n} random site and day pairs`, !m1.bad.length, m1.bad);
  check('the sample holds survived days and the failed checks the sites can show (night, radio, light)', m1.ok > 100 && ['night', 'radio', 'light'].every((k) => m1.failed[k] > 0), m1);
  // The fifteen sites never fail on slope alone (night comes first), so the slope line and the no sunrise line are checked on made up rows.
  const lines = await page.evaluate(() => { const out = {}; const row = (id, v, ok) => ({ id, pri: 'must', ok, v }); const base = () => [row('night', 10, true), row('radio', 10, true), row('light', 0, true), row('slope', 3, true), { id: 'sunPct', pri: 'info', v: 87.4 }];
    for (const l of ['en', 'ru', 'ky']) { document.querySelector('#lang button[data-l="' + l + '"]').click(); const o = [];
      for (const [k, f] of [['ok', (r) => r], ['night', (r) => { r[0] = row('night', 100, false); }], ['radio', (r) => { r[1] = row('radio', 90, false); }], ['light', (r) => { r[2] = row('light', 40, false); }], ['never', (r) => { r[2] = row('light', Infinity, false); }], ['slope', (r) => { r[3] = row('slope', 12.34, false); }]]) {
        const r = base(); f(r); const bad = r.find((x) => x.pri === 'must' && x.ok === false); o.push(__lander.line({ rows: r }, bad, 14)); }
      out[l] = o; }
    document.querySelector('#lang button[data-l="en"]').click(); return out; });
  check('each failed check has its own line with its number, in three languages', ['en', 'ru', 'ky'].every((l) => lines[l].length === 6 && new Set(lines[l]).size === 6 && lines[l].every((x) => x && !/[{}]|NaN|undefined|Infinity/.test(x))) && /87/.test(lines.en[0]) && /12\.3/.test(lines.en[5]) && /100|4\.2/.test(lines.en[1]) && /40/.test(lines.en[3]) && /[а-яё]/i.test(lines.ru[1]) && /[өүң]/i.test(lines.ky.join(' ')), lines);
  // the drop itself, fast forward: 24 pairs, each played through its whole show
  const drops = pairs.slice(0, 24);
  const m2 = await page.evaluate(async (pairs) => {
    const out = []; for (const p of pairs) { const date = new Date(p.t * 1000).toISOString().slice(0, 10), r = await __lander.drop(p.id, p.t, { speed: 30 }); out.push({ id: p.id, date, ok: r.ok, cell: __all.at(p.id, date), last: __lander.last.ok, busy: !!__lander.show && __lander.busy }); }
    return out;
  }, drops);
  check('24 full drops end with the same verdict as the grid cell', m2.every((r) => r.ok === r.cell && r.last === r.ok), m2.filter((r) => r.ok !== r.cell));
  check('the show is over when the drop returns (nothing left on screen)', await page.evaluate(() => getComputedStyle(document.getElementById('landerfx')).display === 'none' && !document.querySelector('.kl-bubble.on')));

  // ---- 5. real clicks on grid cells: freeze the show mid drop and after landing, then the site opens as before
  const cases = [['Peak near Shackleton', 0.1], ['Connecting ridge', 0.5], ['Slater rim', 0.3], ['Leibnitz beta plateau', 0.8]];
  let sawOk = false, sawLost = false;
  for (const [i, [name, frac]] of cases.entries()) {
    await page.evaluate(() => { __lander.hold.pauseAt = 0.9; });
    const cv = page.locator('#sites li', { hasText: name }).locator('canvas'), box = await cv.boundingBox();
    await cv.click({ position: { x: box.width * frac, y: 6 } });
    await page.waitForFunction(() => window.__lander.show && __lander.show.el >= 0.89, null, { timeout: 10000 });
    const mid = await page.evaluate(() => ({ phase: __lander.show.phase, x: __lander.show.x, y: __lander.show.y, shown: getComputedStyle(document.getElementById('landerfx')).display, bubble: !!document.querySelector('.kl-bubble.on') }));
    check(`${name}: mid drop the lander is on screen and falling`, mid.shown === 'block' && mid.phase === 'fall' && !mid.bubble && mid.x > 0 && mid.x < VW && mid.y > 0 && mid.y < VH, mid);
    if (i === 0 || i === 1) await shot(`drop-mid-${i}`);
    await page.evaluate(() => { __lander.hold.pauseAt = 2.4; });
    await page.waitForFunction(() => __lander.show && __lander.show.el >= 2.39, null, { timeout: 10000 });
    const landed = await page.evaluate(() => ({ phase: __lander.show.phase, line: document.querySelector('.kl-bubble .kl-bt span').textContent, cls: document.querySelector('.kl-bubble').className, on: !!document.querySelector('.kl-bubble.on'), last: __lander.last }));
    const cell = await page.evaluate((last) => __all.at(last.siteId, last.date), landed.last);
    check(`${name}: landed as ${landed.last.ok ? 'survived (green)' : 'lost (frost)'} like its grid cell`, landed.last.ok === cell && landed.phase === (cell ? 'ok' : 'lost') && landed.on && landed.cls.includes(cell ? 'ok' : 'lost') && landed.line.length > 20, { landed, cell });
    if (landed.last.ok && !sawOk) { sawOk = true; await shot('landed-green'); } else if (!landed.last.ok && !sawLost) { sawLost = true; await shot('landed-frost'); }
    if (i === 0) await shot(`landed-${i}`);
    await page.evaluate(() => { __lander.hold.pauseAt = null; });
    await page.waitForFunction(() => window.__verdict && document.body.classList.contains('mode-surface'), null, { timeout: 90000 }); await page.waitForTimeout(1500);
    const surf = await page.evaluate(() => ({ s: __lander.surf(), v: __verdict.ok, date: __verdict.date, site: __app.S.siteId }));
    check(`${name}: the site opens after the show, and the first person lander shows the same verdict`, surf.s.visible && surf.v === landed.last.ok && surf.s.ok === surf.v && surf.s.state === (surf.v ? 'ok' : 'lost') && surf.date === landed.last.date, surf);
    if (i < 2) await shot(`surface-${i}-${surf.v ? 'ok' : 'lost'}`);
    // the day changes in the panel: the lander follows (first the day with the opposite verdict, found by the grid)
    if (i === 1 || i === 0) {
      const other = await page.evaluate(() => { const S = __app.S, d0 = Date.parse(__verdict.date + 'T00:00:00Z') / 1000; for (let k = 1; k < 60; k++) { const d = new Date((d0 + k * 86400) * 1000).toISOString().slice(0, 10); if (__all.at(S.siteId, d) !== __verdict.ok) return d; } return null; });
      if (other) {
        await page.fill('#v-day', other); await page.dispatchEvent('#v-day', 'change'); await page.waitForTimeout(700);
        const s2 = await page.evaluate(() => ({ s: __lander.surf(), v: __verdict.ok }));
        check(`${name}: when the landing day changes the first person lander changes with it`, s2.s.ok === s2.v && s2.s.state === (s2.v ? 'ok' : 'lost') && s2.v !== surf.v, { s2, was: surf.v });
        await page.waitForTimeout(1200); await shot(`surface-${i}-day-${s2.v ? 'ok' : 'lost'}`);
      }
    }
    if (i === 1) {
      await page.evaluate(() => __lander.set({ type: 'hopper', color: '#2fbf71', hat: 'tajik' })); await page.waitForTimeout(500);
      const s3 = await page.evaluate(() => __lander.surf());
      check('changing the lander in the card changes the one standing on the terrain', s3.model.startsWith('hopper#2fbf71tajik'), s3);
      await page.waitForTimeout(800); await shot('surface-custom');
      await page.evaluate(() => __lander.set({ type: 'lander', color: '#e5484d', hat: 'kyrgyz' }));
    }
    await page.click('#back'); await page.waitForTimeout(900); await page.evaluate(() => { window.__verdict = null; });
  }

  // ---- 6. a tap on the Moon drops the lander there, judged for the landing day
  const spot = await page.evaluate(() => { const cv = document.getElementById('gl'), r = cv.getBoundingClientRect();
    for (let y = 0.2; y < 0.7; y += 0.03) for (let x = 0.35; x < 0.8; x += 0.03) { const px = r.width * x, py = r.height * y;
      if (document.elementFromPoint(r.left + px, r.top + py) === cv && window.__ov.pick(px, py, r.width, r.height)) return { x: r.left + px, y: r.top + py }; } });
  if (!spot) check('a bare spot of Moon exists to tap', false); else {
    await page.evaluate(() => { __lander.hold.pauseAt = 2.4; delete __lander.last; });
    await page.mouse.click(spot.x, spot.y);
    await page.waitForFunction(() => window.__lander.show && __lander.show.el >= 2.39, null, { timeout: 20000 });
    const tp = await page.evaluate(() => ({ last: __lander.last, cell: __all.at(__lander.last.siteId, __lander.last.date), day: new Date(__app.S.missionStart * 1000).toISOString().slice(0, 10), bubble: !!document.querySelector('.kl-bubble.on') }));
    check('a tap on the Moon drops the lander on the new spot, judged for the landing day like its row', tp.last.siteId[0] === 'u' && tp.last.ok === tp.cell && tp.last.date === tp.day && tp.bubble, tp);
    await shot('tap-drop');
    await page.evaluate(() => { __lander.hold.pauseAt = null; }); await page.waitForTimeout(2200);
  }

  // ---- 7. a click skips the show
  const t0 = Date.now();
  const skipped = await page.evaluate(() => new Promise((res) => { const t = performance.now(); __lander.drop('cr', Date.parse('2026-12-02T00:00:00Z') / 1000, { speed: 1 }).then(() => res(performance.now() - t)); setTimeout(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) || window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })), 700); }));
  check('a key press skips the show', skipped < 1600, skipped);

  // ---- 8. the texts, in three languages
  for (const l of ['ru', 'ky', 'en']) {
    await page.click(`#lang button[data-l="${l}"]`); await page.waitForTimeout(200);
    if (PHONE && !(await page.evaluate(() => !document.querySelector('.kl-card').classList.contains('closed')))) await page.click('.kl-toggle');
    const t = await page.evaluate(async () => { const c = document.querySelector('.kl-card'), r = await __lander.judge('cr', Date.parse('2026-12-02T00:00:00Z') / 1000); return { text: c.innerText, line: r.line, title: document.querySelector('.kl-toggle').textContent, hint: document.querySelector('.kl-hint').textContent, ph: document.querySelector('.kl-input').placeholder }; });
    const re = { ru: /[а-яё]/i, ky: /[өүң]/i, en: /Lander/ }[l];
    check(`language ${l}: the card and the verdict line are written in it, with no raw keys`, re.test(t.text + t.line) && !/kL[A-Z]|undefined|NaN|\{\w+\}/.test(t.text + t.line + t.hint + t.ph), t);
  }

  // ---- 9. the card on the day table screen: the final look
  await page.waitForTimeout(500); await shot('map');
  check('no page error, no script dialog, no console error', errs.length === 0, errs);
  await browser.close(); if (srv) srv.close();
  console.log('screenshots:\n' + shots.join('\n'));
  if (fails.length) { console.error(`\nFAILED ${fails.length}: ${fails.join(' | ')}`); process.exit(1); }
  console.log(`\nall lander checks pass at ${tag}`);
})().catch((e) => { console.error(e); process.exit(1); });
