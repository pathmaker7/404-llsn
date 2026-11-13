// Records the 29 second demo film of the app, with English captions and a visible SI (AI) watermark drawn by this
// recorder on top of the page. No audio. Space Apps rules: video of 30 seconds or less, SI-made video carries a watermark.
// Output: docs/demo-30s.mp4, 1920x1080, 25 fps. Run: node tools/record-demo.cjs
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const { execFileSync } = require('child_process');
const { serve } = require('./smoke.cjs');
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const ROOT = path.join(__dirname, '..'), FRAMES = path.join(ROOT, 'docs', 'frames'), DEST = path.join(ROOT, 'docs', 'demo-30s.mp4');
const SECONDS = 29;

(async () => {
  fs.rmSync(FRAMES, { recursive: true, force: true }); fs.mkdirSync(FRAMES, { recursive: true });
  const srv = await serve(path.join(ROOT, 'app'));
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/`);
  await page.waitForFunction(() => window.__app && window.__app.ready, null, { timeout: 60000 });
  await page.evaluate(() => {
    const box = (css, text) => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;z-index:99;font-family:system-ui;pointer-events:none;' + css; d.textContent = text; document.body.appendChild(d); return d; };
    box('right:16px;top:60px;font-size:16px;color:#fff;background:#000c;padding:5px 10px;border-radius:6px', 'Made with AI (SI) tools: Claude. Checked by team 404 agents');
    window.__cap = box('left:50%;transform:translateX(-50%);bottom:230px;width:max-content;max-width:1500px;text-align:center;font-size:38px;font-weight:700;color:#fff;background:#000d;padding:14px 26px;border-radius:12px', '');
  });
  const t0 = Date.now(), frames = []; let recording = true;
  const capture = (async () => {
    while (recording) {
      const f = path.join(FRAMES, `f${String(frames.length).padStart(5, '0')}.jpg`);
      try { await page.screenshot({ path: f, type: 'jpeg', quality: 88 }); frames.push({ f, t: Date.now() - t0 }); } catch (e) { /* page busy */ }
    }
  })();
  const until = async (sec) => { const wait = sec * 1000 - (Date.now() - t0); if (wait > 0) await page.waitForTimeout(wait); };
  const say = (text) => page.evaluate((t) => { window.__cap.textContent = t; }, text);

  await say('Team 404 agents, Naryn. Lunar Landing Site Navigator'); await until(3);
  await say("At the Moon's south pole, one hill can hide the Sun or Earth for days."); await until(6);
  await say('Pick a landing site. Fly down. Stand on real NASA terrain.');
  await page.click('#sites li:nth-child(4) button');
  await page.waitForFunction(() => window.__verdict && document.body.classList.contains('mode-surface'), null, { timeout: 60000 });
  await until(11);
  await say('Would a solar robot survive 14 days here? One answer, eleven checks.'); await until(15);
  await say('Press play: the Sun slides along the horizon, Earth dips behind a ridge.');
  await page.click('#play'); await until(19.5);
  await page.click('#play');
  await say('Green days are safe to land, red days are not. Click any day.');
  if (await page.locator('#verdict .day.ok:not(.now)').count()) await page.locator('#verdict .day.ok:not(.now)').first().click();
  await until(23);
  await say('Any day from 2021 to 2031: history and prediction.');
  await page.click('.v-date button:has-text("+1 ")'); await until(24.5);
  await page.locator('.v-date button', { hasText: /^\+1 year|^\+1 год|^\+1 жыл/ }).click(); await until(26);
  await say('Built on NASA LRO LOLA terrain. Checked against NASA JPL ephemerides.'); await until(SECONDS);

  recording = false; await capture;
  await browser.close(); srv.close();
  const total = SECONDS * 25; // exactly 29 s at 25 fps: frame i is the newest capture taken by i * 40 ms
  for (let i = 0, k = 0; i < total; i++) {
    while (k + 1 < frames.length && frames[k + 1].t <= i * 40) k++;
    fs.linkSync(frames[k].f, path.join(FRAMES, `o${String(i).padStart(5, '0')}.jpg`));
  }
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', '25', '-i', path.join(FRAMES, 'o%05d.jpg'), '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', '20',
    '-metadata', 'comment=Screen footage and captions made with SI (AI) tools: Claude (Anthropic). Checked by team 404 agents.', DEST]);
  fs.rmSync(FRAMES, { recursive: true, force: true });
  console.log(`${frames.length} captures, ${(frames.length / SECONDS).toFixed(1)} per second`);
  if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
  console.log('wrote', DEST);
})();
