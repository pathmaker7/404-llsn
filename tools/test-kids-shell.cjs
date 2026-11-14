// The shell the four kids features plug into (main.js "kids features", #kidbar, #sitekid). Run: node tools/test-kids-shell.cjs
// 1) One feature's failing hook must not take the app down: a frame hook that throws leaves the picture running, a day
//    click still opens the site when the lander show fails, and both errors still reach the console (never swallowed).
// 2) The button column never lies on the day table, at a desktop, a small laptop and a phone size.
// 3) While the battery game is open, the first person 3D lander is hidden (the game draws the kid's lander itself).
// Env: BASE_URL (test a deployed site instead of the local app).
const path = require('path');
const { chromium } = require('playwright-core');
const { serve, launch } = require('./smoke.cjs');

(async () => {
  const srv = process.env.BASE_URL ? null : await serve(path.join(__dirname, '..', 'app')), url = process.env.BASE_URL || `http://127.0.0.1:${srv.address().port}/`;
  const b = await launch();
  let fails = 0;
  const check = (ok, what, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ': ' + detail : ''}`); fails += !ok; };
  const open = async (w, h) => { const p = await b.newPage({ viewport: { width: w, height: h } }); await p.addInitScript(() => { try { localStorage.setItem('kidHelp', 'off'); } catch (e) { /* no storage */ } }); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
    await p.goto(url); await p.waitForFunction(() => window.__all && window.__all.ready && window.__app && window.__app.ready, null, { timeout: 120000 }); await p.waitForTimeout(3500); return p; };

  // 2. layout
  for (const [w, h] of [[1440, 900], [1280, 720], [390, 844]]) {
    const p = await open(w, h);
    const r = await p.evaluate(() => { const bar = [...document.querySelectorAll('#kidbar > *')].map((e) => e.getBoundingClientRect()), list = document.getElementById('sitelist').getBoundingClientRect();
      return { n: bar.length, bottom: Math.round(Math.max(...bar.map((x) => x.bottom))), right: Math.round(Math.max(...bar.map((x) => x.right))), listTop: Math.round(list.top), w: window.innerWidth }; });
    check(r.n === 5 && r.bottom <= r.listTop && r.right <= r.w, `${w}x${h}: the lander card and the four buttons beside it stand clear of the day table`, JSON.stringify(r));
    check(p.errs.length === 0, `${w}x${h}: no page error`, p.errs.join('; '));
    await p.close();
  }

  // 1. hook isolation
  const p = await open(1440, 900);
  await p.evaluate(() => { const k = window.__app.kid; k.frame.unshift(() => { throw new Error('frame hook boom'); }); k.frame.push(() => { window.__frames = (window.__frames || 0) + 1; }); });
  await p.waitForTimeout(800);
  const frames = await p.evaluate(() => window.__frames || 0);
  check(frames > 5, 'a frame hook that throws does not stop the picture', `${frames} frames drawn after it`);
  await p.evaluate(() => { window.__app.kid.dayPick.unshift(async () => { throw new Error('dayPick boom'); }); window.__lander.speed = 30; });
  const cell = await p.evaluate(() => { const cv = document.querySelector('#sites li.a-row canvas').getBoundingClientRect(); return { x: cv.left + cv.width * 0.3, y: cv.top + cv.height / 2 }; });
  await p.mouse.click(cell.x, cell.y);
  const opened = await p.waitForFunction(() => document.body.classList.contains('mode-surface') && !document.getElementById('fade').classList.contains('on'), null, { timeout: 30000 }).then(() => true, () => false);
  check(opened, 'a day click opens the site although a day hook failed');
  await p.waitForTimeout(300);
  check(p.errs.some((e) => /frame hook boom/.test(e)) && p.errs.some((e) => /dayPick boom/.test(e)), 'both failures reach the console, none is swallowed', p.errs.join('; '));

  // 3. one lander at a time
  if (opened) {
    await p.waitForFunction(() => window.__lander.surf().visible, null, { timeout: 15000 }).catch(() => {});
    const before = await p.evaluate(() => window.__lander.surf().visible);
    await p.click('#g-open'); await p.waitForTimeout(400);
    const during = await p.evaluate(() => window.__lander.surf().visible);
    await p.evaluate(() => window.__game.close()); await p.waitForTimeout(400);
    const after = await p.evaluate(() => window.__lander.surf().visible);
    check(before && !during && after, 'the first person lander hides while the battery game is open and returns after', JSON.stringify({ before, during, after }));
  }
  await b.close(); srv?.close();
  if (fails) { console.error(`FAILED ${fails}`); process.exit(1); }
  console.log('the kids shell holds');
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
