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
  await page.waitForFunction(() => window.__all && window.__all.ready, null, { timeout: 120000 });
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
  // On the map screen the caption sits at the top, clear of the timeline it talks about; on the site screen it sits above the time bar.
  // Every caption with the moment it appeared: after recording, each must be readable in the time it stays on screen.
  const caps = [];
  const say = (text, top = false) => (caps.at(-1)?.text !== text && caps.push({ text, t: (Date.now() - t0) / 1000 }), page.evaluate(([t, up]) => { const c = window.__cap; c.textContent = t; c.style.top = up ? '120px' : 'auto'; c.style.bottom = up ? 'auto' : '230px'; c.style.left = up ? '50%' : '60%'; c.style.maxWidth = up ? '1500px' : '1300px'; }, [text, top]));

  // Order follows the Space Apps project submission guide: who we are, the challenge, the title, how it works with
  // NASA data, then what it can do for people. The story is a lesson: the two cycles that decide landing days, seen by
  // zooming out from one year to five (measured: the best sites repeat every 354 days, 12 lunar months; in the dark
  // season "night" fails, in the other months "radio" fails, so the monthly window is Earth's).
  const period = (k) => page.click(`.a-range button[data-y="${k}"]`);
  await say('Team 404 agents, Naryn: Manuchehr, Aruzhan, Kairat, Arsen, Amirbek', true); await until(3);
  await say('Lunar Landing Site Navigator: which days can a Moon mission survive?', true);
  await page.mouse.move(800, 260); await page.mouse.down(); await page.mouse.move(1150, 300, { steps: 40 }); await page.mouse.up(); await until(6);
  await period('1');
  await say('One year: green, the mission survives. Earth is up one week a month.', true); await until(10);
  await period('5');
  await say("Five years: with the Sun's dark season, it repeats every 354 days.", true); await until(13.5);
  await period('1m');
  await say('Click a green day. Stand on real NASA terrain.', true);
  // The best site's first green day after today: the film lands where the robot survives.
  const cell = await page.evaluate(() => {
    const li = document.querySelector('#sites li.a-row'), cv = li.querySelector('canvas'), b = cv.getBoundingClientRect(), n = __all.b - __all.a;
    const day = (d) => new Date(Date.parse(__all.from + 'T00:00:00Z') + d * 864e5).toISOString().slice(0, 10);
    let d = 1; while (d < n - 1 && !__all.at(li.dataset.id, day(d))) d++;
    return { x: b.left + ((d + 0.5) / n) * b.width, y: b.top + b.height / 2 };
  });
  await page.mouse.move(cell.x, cell.y, { steps: 12 }); await page.waitForTimeout(500); await page.mouse.click(cell.x, cell.y);
  await page.waitForFunction(() => window.__verdict && document.body.classList.contains('mode-surface'), null, { timeout: 60000 });
  await page.click('#look-sun'); await until(16.5);
  await say('One answer, eleven checks. The Sun slides along the horizon.');
  await page.click('#play'); await until(20); await page.click('#play');
  // The proof shot: a real landing replayed. The box on the left shows what happened next to the model's sunrise and sunset.
  const real = 'Chandrayaan-3, replayed: our sunset matches the day India put it to sleep.';
  await say(real, true);
  await page.click('#back'); await page.waitForTimeout(700);
  await page.selectOption('#a-famous', { label: 'Chandrayaan-3 (2023)' });
  await page.waitForFunction(() => window.__history && document.body.classList.contains('mode-surface'), null, { timeout: 60000 });
  await say(real); await until(25);
  await say('Built for schools in Kyrgyzstan and Central Asia: Kyrgyz, Russian, English.'); await until(SECONDS);
  // Readable: at most 3.7 words a second for the time each caption really stayed on screen.
  caps.forEach((c, i) => { const on = (caps[i + 1]?.t ?? SECONDS) - c.t, w = c.text.split(/\s+/).length;
    console.log(`${c.t.toFixed(1).padStart(5)} s  ${(w / on).toFixed(1)} words/s  ${c.text}`);
    if (w / on > 3.7) errors.push(`caption too fast to read (${(w / on).toFixed(1)} words/s): ${c.text}`); });

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
