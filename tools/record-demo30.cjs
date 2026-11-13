// Records the submitted demo: 29 seconds of Mission mode with English captions and a visible SI (AI) watermark,
// both drawn by this recorder on top of the page (the app itself has neither). No audio.
// Space Apps rule: "Video (30 seconds or less)", and SI-made video "must include a visible watermark".
// Output: docs/demo-30s.mp4 (docs/demo.mp4 is the older 2 minute walkthrough, not for submission), 1920x1080, 25 fps. Run: node tools/record-demo30.cjs
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const { execFileSync } = require('child_process');
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const ROOT = path.join(__dirname, '..'), FRAMES = path.join(ROOT, 'docs', 'video', 'frames30'), DEST = path.join(ROOT, 'docs', 'demo-30s.mp4');
const SECONDS = 29;

(async () => {
  fs.rmSync(FRAMES, { recursive: true, force: true }); fs.mkdirSync(FRAMES, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Served over http: the 3D view from the spot needs it (ES modules and data files).
  const http = require('http'), root = path.join(ROOT, 'app'), types = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json' };
  const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
    if (!f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': types[f.split('.').pop()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  await page.goto(`http://127.0.0.1:${srv.address().port}/index.html`);
  await page.waitForFunction(() => window.__app && window.__app.sites.length > 0);
  await page.evaluate(() => {
    const box = (css, text) => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;z-index:99;font-family:system-ui;' + css; d.textContent = text; document.body.appendChild(d); return d; };
    box('right:16px;bottom:12px;font-size:17px;color:#fff;background:#000c;padding:5px 10px;border-radius:6px', 'Made with AI (SI) tools: code, footage and captions by Claude, checked by team 404 agents');
    window.__cap = box('left:50%;transform:translateX(-50%);bottom:64px;width:max-content;max-width:1500px;text-align:center;font-size:40px;font-weight:700;color:#fff;background:#000d;padding:14px 26px;border-radius:12px', '');
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

  const spot = (key) => page.evaluate((k) => document.querySelector(`[data-spot="${__app.sites.find((x) => x.key === k).id}"]`).click(), key);
  await say('Team 404 agents, Naryn. NASA Space Apps 2026: Lunar Landing Site Navigator'); await until(3);
  await say("At the Moon's south pole, one hill can hide the Sun or the Earth for days."); await until(6.5);
  await page.click('#mGo');
  await say('You choose where a robot lands. Real NASA terrain decides if it survives.'); await until(10);
  const view = page.frameLocator('iframe.stand');
  await spot('ridge');
  await say('Ridge, landing 22 July 2027: the robot survives. Stand on the spot and watch.'); await until(12);
  await view.locator('#play').click(); await until(15.5);
  await page.click('#mNext');
  await say('Then the rocket slips 21 days, as real launches do. The same spot is lost.'); await until(19.5);
  await spot('plateau');
  await say('Replan: the plateau survives. The place matters, and so does the date.'); await until(21);
  await view.locator('#play').click(); await until(23);
  await page.click('#mFinish'); await until(24);
  await page.click('#mOpenPlanner');
  await say('For experts: the full planner, any site on the Moon, any date, checked against NASA JPL Horizons.'); await until(26.5);
  await say('Runs offline in English, Russian and Kyrgyz: for planners, teachers and every classroom.'); await until(SECONDS);

  recording = false; await capture;
  await browser.close(); srv.close();
  const total = SECONDS * 25; // exactly 29 s at 25 fps: frame i is the newest capture taken by i * 40 ms
  for (let i = 0, k = 0; i < total; i++) {
    while (k + 1 < frames.length && frames[k + 1].t <= i * 40) k++;
    fs.linkSync(frames[k].f, path.join(FRAMES, `o${String(i).padStart(5, '0')}.jpg`));
  }
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', '25', '-i', path.join(FRAMES, 'o%05d.jpg'), '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', '20',
    '-metadata', 'comment=Screen footage, captions and code generated with SI (AI) tools: Claude (Anthropic). Checked by team 404 agents.', DEST]);
  fs.rmSync(FRAMES, { recursive: true, force: true });
  console.log(`${frames.length} captures, ${(frames.length / SECONDS).toFixed(1)} per second`);
  if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
  console.log('wrote', DEST);
})();
