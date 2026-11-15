// Plays the deck the way a judge does: real time, real clicks (about 40 seconds).
//   OUT=<dir for two phone pictures> node tools/deck-live.cjs [base url, default: the local explainer folder]
//   ENGINE=webkit plays it in Safari's engine.
const path = require('path'); const ROOT = process.cwd();
const { serve, launch } = require(path.join(ROOT, 'tools', 'smoke.cjs'));
(async () => {
  let srv, base = process.argv[2];
  if (!base) { srv = await serve(path.join(ROOT, 'explainer')); base = `http://127.0.0.1:${srv.address().port}`; }
  const browser = await launch(); const bad = [];
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => bad.push('page error ' + e.message));
  page.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
  await page.goto(base + '/deck.html'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
  const st = () => page.evaluate(() => [...document.querySelectorAll('section')].map((s) => s.classList.contains('play') ? s.id : '').filter(Boolean).join(','));
  console.log('on open, playing:', JSON.stringify(await st()));
  if (await st() !== 's1') bad.push('slide 1 should play on open');
  for (let n = 2; n <= 7; n++) {
    await page.click('#next'); await page.waitForTimeout(1500);
    const s = await st(); const info = await page.evaluate((id) => { const el = document.getElementById(id), r = el.getBoundingClientRect();
      const an = el.getAnimations({ subtree: true }); return { top: Math.round(r.top), running: an.filter((a) => a.playState === 'running').length, total: an.length, dur: +el.dataset.dur }; }, 's' + n);
    console.log(`Next -> slide ${n}: playing ${s}, top ${info.top}, animations ${info.total} (${info.running} running), loop ${info.dur}s`);
    if (s !== 's' + n) bad.push(`slide ${n}: playing is "${s}"`);
    if (Math.abs(info.top) > 4) bad.push(`slide ${n} is not at the top: ${info.top}`);
    if (!info.total) bad.push(`slide ${n} has no animations`);
  }
  // back to slide 2: a passing bubble must be visible in real time, the loop must restart by itself, Replay must restart
  for (let n = 0; n < 5; n++) { await page.click('#back'); await page.waitForTimeout(500); }
  await page.waitForTimeout(1200);
  console.log('Back x5, playing:', await st());
  const bubble = () => page.evaluate(() => { const b = document.querySelector('#s2 .say'); return b ? +getComputedStyle(b).opacity : -1; });
  const t0 = Date.now(); await page.click('#s2 .replay'); await page.waitForTimeout(4000);
  const op = await bubble(); console.log('slide 2 first bubble opacity 4 s after Replay:', op); if (op < 0.9) bad.push('the first bubble is not visible');
  const bar = () => page.evaluate(() => { const a = document.querySelector('#s2 .bar').getAnimations()[0]; return a ? Math.round(a.currentTime) : -1; });
  const b1 = await bar(); console.log('bar time after Replay (ms):', b1); if (b1 < 3500 || b1 > 5500) bad.push('Replay did not restart the film');
  await page.waitForTimeout(13000 - (Date.now() - t0) + 2000); // slide 2 loops every 13 s
  const b2 = await bar(); console.log('bar time 2 s after the loop point (ms):', b2); if (b2 < 500 || b2 > 4000) bad.push('the film did not start again by itself: ' + b2);
  // phone
  const ph = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ph.goto(base + '/deck.html'); await ph.waitForLoadState('networkidle');
  const w = await ph.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  console.log('phone 390: scroll width', w.sw, 'client', w.cw); if (w.sw > w.cw + 1) bad.push('phone: the page scrolls sideways');
  await ph.screenshot({ path: (process.env.OUT || require('os').tmpdir()) + '/phone-s1.png' });
  await ph.evaluate(() => document.getElementById('s3').scrollIntoView()); await ph.waitForTimeout(1200);
  await ph.screenshot({ path: (process.env.OUT || require('os').tmpdir()) + '/phone-s3.png' });
  await browser.close(); if (srv) srv.close();
  if (bad.length) { console.error('FAIL\n' + bad.join('\n')); process.exit(1); }
  console.log('ok');
})();
