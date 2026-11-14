// The first visit, played like a child who has never seen the page. Run: node tools/test-tour.cjs
// Env: BASE_URL (a deployed site instead of the local app), VIEWPORT (1440x900 default, or 1920x1080, 390x844), SHOTS (screenshot folder).
// Checks: the tour starts by itself, each of its five steps lights the thing it names and its card stays on the screen;
// it does not come back after it was finished; the first press on Ice hunter, Quiz and Keep me alive shows three numbered
// steps and "Start" then really starts the toy; Keep me alive is on the first screen and opens the game on a site;
// "How to play" starts the tour again; Russian and Kyrgyz show no raw text keys.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const { serve } = require('./smoke.cjs');
const [VW, VH] = (process.env.VIEWPORT || '1440x900').split('x').map(Number);
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'tour-shots');

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const srv = process.env.BASE_URL ? null : await serve(path.join(__dirname, '..', 'app')), url = process.env.BASE_URL || `http://127.0.0.1:${srv.address().port}/`;
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const p = await b.newPage({ viewport: { width: VW, height: VH } }), errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  let fails = 0;
  const check = (ok, what, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ': ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`); fails += !ok; };
  const shot = (n) => p.screenshot({ path: path.join(SHOTS, `tour-${VW}x${VH}-${n}.png`) });
  const boot = async () => { await p.goto(url); await p.waitForFunction(() => window.__all && window.__all.ready && window.__app && window.__app.ready, null, { timeout: 120000 }); };
  // What the help shows now: its card (inside the screen or not), its texts, and how far the ring is from its target.
  const look = (sel) => p.evaluate((sel) => { const c = document.querySelector('.kt-card'), root = document.getElementById('kt'); if (!c || root.hidden) return null;
    const r = c.getBoundingClientRect(), ring = document.querySelector('.kt-ring').getBoundingClientRect(), t = sel && document.querySelector(sel)?.getBoundingClientRect();
    return { inside: r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth + 0.5 && r.bottom <= window.innerHeight + 0.5, title: c.querySelector('h3')?.textContent, text: c.textContent, steps: c.querySelectorAll('.kt-steps li').length,
      off: t ? Math.max(Math.abs(ring.left + 6 - t.left), Math.abs(ring.top + 6 - t.top), Math.abs(ring.width - 12 - t.width), Math.abs(ring.height - 12 - t.height)) : null,
      covers: t ? r.left < t.right && r.right > t.left && r.top < t.bottom && r.bottom > t.top : false, view: window.__tour.view }; }, sel);

  // 1. the tour starts by itself and walks the first screen
  await boot();
  await p.waitForFunction(() => window.__tour && window.__tour.view, null, { timeout: 15000 }).catch(() => {});
  const targets = ['#sitelist', '.kl-card', '#kt-game', '#ice-btn', '.kq-btn'];
  let s = await look(targets[0]);
  check(!!s && s.view.kind === 'tour' && s.view.i === 0 && s.view.steps === 5, 'on a first visit the tour starts by itself, five steps', s && s.view);
  for (let i = 0; i < 5; i++) {
    await p.waitForTimeout(400); // the ring glides to its target
    s = await look(targets[i]);
    check(!!s && s.view.i === i && s.off < 2 && s.inside && !/kT\d/.test(s.text) && s.text.length > 60, `step ${i + 1} lights ${targets[i]} and its card is on the screen`, s && { title: s.title, off: s.off, inside: s.inside });
    // On a wide screen the card stands beside the thing; on a phone the day table fills half the screen and may be partly under it.
    if (i > 0) check(!!s && !s.covers, `step ${i + 1}: the card does not cover what it explains`);
    if (i === 0 || i === 2) await shot(`step${i + 1}`);
    await p.click('.kt-go');
  }
  check((await look()) === null, 'the last step closes the tour');
  await boot(); await p.waitForTimeout(3000);
  check((await look()) === null, 'a finished tour does not come back on the next visit');

  // 2. the first press on a toy shows how to play; Start starts it
  await p.click('#ice-btn'); await p.waitForTimeout(200);
  s = await look();
  check(!!s && s.view.kind === 'how' && s.steps === 4 && s.inside && !(await p.evaluate(() => window.__ice.on)), 'the first press on Ice hunter shows numbered steps before anything starts', s && s.title);
  check(!!s && /Your job/.test(s.text) && /Shackleton floor/.test(s.text) && /The Sun never reaches here!/.test(s.text) && /press “Ice hunter” again/.test(s.text), 'the card says the goal, what to tap (a label by its name), what the answer looks like and how to stop');
  await shot('how-ice');
  await p.click('.kt-go'); await p.waitForTimeout(200);
  check((await look()) === null && (await p.evaluate(() => window.__ice.on)), 'Start turns Ice hunter on');
  // The card promised a sure find at the label "Shackleton floor": that tap must hunt there, never open the site.
  const pin = await p.evaluate(() => { const e = [...document.querySelectorAll('#pins .pin')].find((x) => x.dataset.name === 'Shackleton floor'), r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    return { x, y, top: document.elementFromPoint(x, y) === e, n: window.__ice.count }; });
  if (!pin.top) console.log('     (the label is under something at this size: pressing it through the page instead of by the mouse)');
  if (pin.top) await p.mouse.click(pin.x, pin.y); else await p.evaluate(() => [...document.querySelectorAll('#pins .pin')].find((x) => x.dataset.name === 'Shackleton floor').click());
  await p.waitForFunction(() => window.__ice.phase === 'result' || document.body.classList.contains('mode-surface'), null, { timeout: 60000 }).catch(() => {});
  const hunted = await p.evaluate(() => ({ map: document.body.classList.contains('mode-overview'), phase: window.__ice.phase, dark: window.__ice.last && window.__ice.last.dark, n: window.__ice.count, head: document.querySelector('#ice-card h3')?.textContent }));
  check(hunted.map && hunted.phase === 'result' && hunted.dark === true && hunted.n === pin.n + 1 && hunted.head === 'The Sun never reaches here!', 'a tap on the label "Shackleton floor" hunts there: dark, the counter goes up, the site does not open', hunted);
  if (!hunted.map) { await p.waitForFunction(() => !document.getElementById('fade').classList.contains('on'), null, { timeout: 30000 }).catch(() => {}); await p.click('#back'); await p.waitForTimeout(1500); }
  await p.evaluate(() => window.__ice.setMode(false));
  await p.click('#ice-btn'); await p.waitForTimeout(200);
  check((await look()) === null && (await p.evaluate(() => window.__ice.on)), 'the second time Ice hunter starts at once');
  await p.evaluate(() => window.__ice.setMode(false));

  await p.click('.kq-btn'); await p.waitForTimeout(200);
  s = await look();
  check(!!s && s.view.kind === 'how' && s.steps === 3 && /Your job/.test(s.text) && /Press “Start” below/.test(s.text) && /Press “Next”/.test(s.text) && !(await p.evaluate(() => window.__quiz.state.open)), 'the first press on Quiz shows the goal and what to press, in order', s && s.title);
  // the help follows the language
  for (const l of ['ru', 'ky']) { await p.evaluate((l) => document.querySelector(`#lang button[data-l="${l}"]`).click(), l); await p.waitForTimeout(150);
    const t = await look(); check(!!t && t.steps === 3 && /[а-яё]/i.test(t.text) && !/kT[A-Z0-9]|\{[a-z]+\}/.test(t.text) && t.inside, `the quiz help in ${l} is written out, no raw key or empty name`, t && t.title);
    if (l === 'ky') await shot('how-quiz-ky'); }
  await p.evaluate(() => document.querySelector('#lang button[data-l="en"]').click());
  await p.click('.kt-go'); await p.waitForSelector('.kq-opt', { timeout: 20000 }).catch(() => {});
  check(await p.evaluate(() => window.__quiz.state.open && document.querySelectorAll('.kq-opt').length === 4), 'Start opens the quiz on its first question');
  await p.evaluate(() => window.__quiz.close());

  // 3. Keep me alive is on the first screen
  const g = await p.evaluate(() => { const e = document.getElementById('kt-game'), r = e.getBoundingClientRect(); return { text: e.textContent, shown: r.width > 0 && r.top >= 0 && r.bottom <= window.innerHeight, top: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === e }; });
  check(g.text === 'Keep me alive' && g.shown && g.top, 'Keep me alive is a button on the first screen', g);
  await p.click('#kt-game'); await p.waitForTimeout(200);
  s = await look();
  check(!!s && s.view.kind === 'how' && s.steps === 4 && /Your job/.test(s.text) && /Try a green day/.test(s.text) && /Try a red day/.test(s.text) && /Start/.test(s.text), 'its first press shows the goal and how to play, naming the real buttons', s && s.title);
  await shot('how-game');
  await p.click('.kt-go');
  const played = await p.waitForFunction(() => document.body.classList.contains('mode-surface') && window.__game.state.open, null, { timeout: 60000 }).then(() => true, () => false);
  check(played, 'Start opens a site and the game on it');
  if (played) {
    await p.waitForTimeout(600);
    const day = await p.evaluate(() => ({ ok: window.__game.judgeDay(window.__app.S.missionStart).ok, site: window.__app.S.siteId, first: document.querySelector('#sites li.a-row').dataset.id }));
    check(day.site === day.first, 'it is the best site of the period shown (the first row)', day);
    console.log(`     the landing day it chose ${day.ok ? 'survives' : 'is lost (no surviving day in the next 60 at this site)'}`);
    await shot('game-from-map');
    await p.evaluate(() => window.__game.close()); await p.click('#back'); await p.waitForTimeout(1500);
  }

  // 4. How to play starts the tour again, and Escape closes it
  check((await look()) === null, 'back on the map the finished tour stays away');
  await p.click('#kt-help'); await p.waitForTimeout(300);
  s = await look('#sitelist');
  check(!!s && s.view.kind === 'tour' && s.view.i === 0, 'How to play starts the tour again');
  check(await p.evaluate(() => { const k = JSON.parse(localStorage.getItem('kidSeen') || '{}'); return !k.ice && !k.quiz && !k.game; }), 'and it brings the "How to play" cards of the three toys back');
  // The step says "press this button": the lit button really takes the press, a button that is not lit does not.
  const mid = (sel) => p.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
  for (let i = 0; i < 3; i++) await p.click('.kt-go');
  await p.waitForTimeout(400);
  let at = await mid('.kq-btn'); await p.mouse.click(at.x, at.y); await p.waitForTimeout(200);
  s = await look('#ice-btn');
  check(!!s && s.view.kind === 'tour' && s.view.i === 3 && !(await p.evaluate(() => window.__quiz.state.open)), 'in the tour a press on a button that is not lit does nothing', s && s.view);
  at = await mid('#ice-btn'); await p.mouse.click(at.x, at.y); await p.waitForTimeout(200);
  s = await look();
  check(!!s && s.view.kind === 'how' && s.view.key === 'ice', 'a press on the lit button works: the tour gives way to how to play Ice hunter', s && s.view);
  await p.click('.kt-go').catch(() => {}); await p.waitForTimeout(200);
  check((await look()) === null && (await p.evaluate(() => window.__ice.on)), 'and Start then turns Ice hunter on');
  await p.evaluate(() => window.__ice.setMode(false));
  // A day picked in the lit calendar: the tour steps aside at once, so the lander's drop is not played under the dark layer.
  await p.evaluate(() => { window.__tour.start(); window.__lander.speed = 30; }); await p.waitForTimeout(400);
  const cell = await p.evaluate(() => { const cv = document.querySelector('#sites li.a-row canvas').getBoundingClientRect(); return { x: cv.left + cv.width * 0.3, y: cv.top + cv.height / 2 }; });
  await p.mouse.click(cell.x, cell.y);
  const landed = await p.waitForFunction(() => document.body.classList.contains('mode-surface'), null, { timeout: 30000 }).then(() => true, () => false);
  check(landed && (await look()) === null, 'a day clicked in the lit calendar lands there and the tour is gone');
  await p.waitForFunction(() => !document.getElementById('fade').classList.contains('on'), null, { timeout: 30000 }).catch(() => {});
  if (landed) { await p.click('#back'); await p.waitForTimeout(1500); }
  await p.evaluate(() => window.__tour.start()); await p.waitForTimeout(200);
  check(!!(await look()), 'the tour can be opened again');
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  check((await look()) === null, 'Escape closes it');
  check(errs.length === 0, 'no page errors', errs.join('; '));
  await b.close(); srv?.close();
  if (fails) { console.error(`FAILED ${fails}`); process.exit(1); }
  console.log(`the first visit works at ${VW}x${VH} (screenshots in ${SHOTS})`);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
