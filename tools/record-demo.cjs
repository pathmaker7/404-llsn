// Records the 29.5 second demo film of the app as a real user would use it, with English captions and a visible SI (AI)
// watermark drawn on top of the page. Space Apps rules: video of 30 seconds or less, SI-made video and audio say so.
// Output: docs/demo-silent.mp4 (1920x1080, 25 fps) and docs/demo-captions.json (each caption and when it appeared);
// tools/narrate.cjs then lays a synthetic voice reading the same captions under them. Run: npm run video
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const { execFileSync } = require('child_process');
const { serve } = require('./smoke.cjs');
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const ROOT = path.join(__dirname, '..'), FRAMES = path.join(ROOT, 'docs', 'frames'), DEST = path.join(ROOT, 'docs', 'demo-silent.mp4');
const SECONDS = 29.5;

(async () => {
  fs.rmSync(FRAMES, { recursive: true, force: true }); fs.mkdirSync(FRAMES, { recursive: true });
  const srv = await serve(path.join(ROOT, 'app'));
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  await page.addInitScript(() => { try { localStorage.setItem('kidHelp', 'off'); } catch (e) { /* no storage */ } }); // the film shows the app as a returning visitor sees it; the first visit tour is not in it
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/`);
  await page.waitForFunction(() => window.__all && window.__all.ready, null, { timeout: 120000 });
  // Ice hunter needs the 7 MB polar terrain; load it before filming (users fetch it on their first tap).
  await page.evaluate(() => import('./src/data.js').then((m) => m.loadPolar()));
  // A person's own voice (VOICE_NOTE="Voice: Manuchehr, team member") replaces the synthetic voice notice; the AI notice stays.
  await page.evaluate((voiceNote) => {
    const box = (css, text) => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;z-index:99;font-family:system-ui;pointer-events:none;' + css; d.textContent = text; document.body.appendChild(d); return d; };
    box('left:50%;transform:translateX(-50%);top:12px;white-space:nowrap;font-size:16px;color:#fff;background:#000c;padding:5px 10px;border-radius:6px', `Made with AI (SI) tools: Claude. ${voiceNote}. Checked by team 404 agents`);
    window.__names = box('left:50%;transform:translateX(-50%);top:205px;font-size:26px;color:#fff;background:#000d;padding:8px 18px;border-radius:10px', 'Manuchehr, Aruzhan, Kairat, Arsen, Amirbek');
    window.__cap = box('left:50%;transform:translateX(-50%);bottom:230px;width:max-content;max-width:1500px;text-align:center;white-space:pre-line;font-size:38px;font-weight:700;color:#fff;background:#000d;padding:14px 26px;border-radius:12px', '');
  }, process.env.VOICE_NOTE || 'Synthetic voice');
  const t0 = Date.now(), frames = []; let recording = true;
  const capture = (async () => {
    while (recording) {
      const f = path.join(FRAMES, `f${String(frames.length).padStart(5, '0')}.jpg`);
      try { await page.screenshot({ path: f, type: 'jpeg', quality: 88 }); frames.push({ f, t: Date.now() - t0 }); } catch (e) { /* page busy */ }
    }
  })();
  const until = async (sec) => { const wait = sec * 1000 - (Date.now() - t0); if (wait > 0) await page.waitForTimeout(wait); };
  // Where a caption sits: 'map' in the free band between the site labels and the day table (a caption at the top hid
  // the lander at touchdown), 'high' over the battery game, 'low' on the site screen (above the time bar), 'end'
  // under the name and address of the last scene. Every caption is kept with the moment it appeared: after recording,
  // each must be readable in the time it stays on screen.
  const caps = [];
  const POS = { map: ['500px', 'auto', '50%', '1500px'], high: ['120px', 'auto', '50%', '1500px'], low: ['auto', '230px', '60%', '1300px'], end: ['700px', 'auto', '50%', '1500px'] };
  const say = (text, pos = 'map') => (caps.at(-1)?.text !== text && caps.push({ text, t: (Date.now() - t0) / 1000 }), page.evaluate(([t, p]) => { const c = window.__cap; c.textContent = t.replace('. ', '.\n'); /* two sentences: one line each */ [c.style.top, c.style.bottom, c.style.left, c.style.maxWidth] = p; }, [text, POS[pos]]));
  const mark = (what) => console.log(`${((Date.now() - t0) / 1000).toFixed(1).padStart(5)} s  ${what}`);

  // Order follows the Space Apps project submission guide: [0:00] who we are, [0:02] the challenge, [0:05] the title and
  // tagline, [0:10] how it works with NASA data, [0:20-0:30] what it can do for people. One story in five scenes (the
  // first screen, the drop, the site, the battery game, the whole Moon with the address), so a viewer with no context
  // can follow it: an earlier film showed seven features in 26 seconds and gave "who it is for" its last 2 seconds.
  // The last 9 seconds say why the team built it and what a student needs to use it (a browser, nothing else).
  // The voice reads each caption word for word (subtitles = speech), and each line ends about a second before the next.
  await say("Hi, we're team 404 agents from Naryn, Kyrgyzstan.");
  // My lander: the hats of Central Asia, tried on one after another, ending on the Kyrgyz ak kalpak.
  await until(1.5);
  for (const h of ['kazakh', 'uzbek', 'tajik', 'kyrgyz']) { await page.click(`.kl-hat[data-hat="${h}"]`); await page.waitForTimeout(330); }
  await until(3.4);
  await page.evaluate(() => window.__names.remove());
  // The problem, shown: the map's own clock plays, sunlight sweeps over the pole and the site dots turn green and red.
  await say("At the Moon's south pole, one long shadow can kill a solar robot.");
  await page.click('#a-play'); mark('map clock plays: sunlight sweeps the pole');
  await until(7.1);
  await page.click('#a-play'); await page.waitForTimeout(150);
  // The day to click: a green day (the mission survives) whose first days hold a dark stretch the battery can carry, so
  // the battery game that follows shows a real drain and a real refill. Judged with the app's own series; the first row
  // that has such a day wins, else the best site's first green day.
  const cell = await page.evaluate(async () => {
    const d = await import('./src/data.js'), A = window.__all, n = A.b - A.a, day = (k) => new Date(Date.parse(A.from + 'T00:00:00Z') + k * 864e5).toISOString().slice(0, 10);
    const at = (li, k, dark) => { const b = li.querySelector('canvas').getBoundingClientRect(); return { x: b.left + ((k + 0.5) / n) * b.width, y: b.top + b.height / 2, id: li.dataset.id, date: day(k), dark }; };
    const rows = [...document.querySelectorAll('#sites li.a-row')];
    for (const li of rows) { const s = window.__app.S.index.sites.find((x) => x.id === li.dataset.id), sky = await d.loadSky((s.variants.best || s.variants.databook).dir);
      for (let k = 1; k < n - 1; k++) { if (!A.at(li.dataset.id, day(k))) continue;
        const i0 = Math.round((Date.parse(day(k) + 'T00:00:00Z') / 1000 - sky.t0) / 3600); let run = 0, best = 0;
        for (let i = i0 + 6; i < i0 + 130; i++) { run = sky.ch.sunFrac[i] < 0.5 ? run + 1 : 0; if (run > best) best = run; }
        if (best >= 14 && best <= 40) return at(li, k, best); } }
    const li = rows[0]; let k = 1; while (k < n - 1 && !A.at(li.dataset.id, day(k))) k++; return at(li, k, 0);
  });
  console.log('day to click:', JSON.stringify(cell));
  await until(7.6);
  await say('Lunar Landing Site Navigator: pick a day, and your lander drops in.');
  await page.mouse.move(cell.x, cell.y, { steps: 10 }); await page.waitForTimeout(250); await page.mouse.click(cell.x, cell.y); mark('day clicked: the lander drops');
  await until(12.0);
  const data = "Green means it survives, on real terrain from NASA's open data.";
  await say(data);
  const dropped = await page.evaluate(() => window.__lander.last);
  if (!dropped || !dropped.ok) errors.push('the dropped lander did not survive on the green day: ' + JSON.stringify(dropped));
  await page.waitForFunction(() => window.__verdict && document.body.classList.contains('mode-surface') && !document.getElementById('fade').classList.contains('on'), null, { timeout: 60000 }); mark('on the site');
  if (!(await page.evaluate(() => window.__verdict.ok))) errors.push('the site panel does not say the mission survived');
  if ((Date.now() - t0) / 1000 > 15.0) errors.push('the site opened later than 15.0 s: the line about NASA terrain would end before the terrain shows');
  await say(data, 'low'); await until(16.2);

  // Keep me alive: the battery game on this site and this landing day, at four times speed.
  await say('Kids learn by playing: keep the battery alive in the dark.', 'high');
  await page.click('#g-open');
  // The kid picks a landing day in the game: here a day that survives although the Sun hides for a day or more early
  // in the stay, so the battery is seen draining and filling again. Found with the game's own judge on this site.
  const gday = await page.evaluate(() => { const S = window.__app.S, s = S.site, G = window.__game, DAY = 86400;
    for (let t = Math.floor(Date.now() / 1000 / DAY) * DAY, k = 0; k < 1800; k++, t += DAY) { const i0 = Math.round((t - s.t0) / 3600); let run = 0;
      for (let i = i0 + 8; i < i0 + 70; i++) { if (s.ch.sunFrac[i] < 0.5) run++; else if (run >= 24 && run <= 44) break; else run = 0; }
      if (run >= 24 && run <= 44 && G.judgeDay(t).ok) return { date: new Date(t * 1000).toISOString().slice(0, 10), dark: run }; }
    return null; });
  if (!gday) errors.push('no surviving day with a long shadow for the battery game');
  else { await page.fill('#g-day', gday.date); await page.dispatchEvent('#g-day', 'change'); console.log('game day:', JSON.stringify(gday)); }
  await page.waitForTimeout(350); await page.click('#g-start'); await page.click('.g-segbtn button[data-sp="4"]'); mark('game started');
  await until(20.3);
  mark('game at ' + await page.evaluate(() => document.querySelector('.g-dayno')?.textContent));

  // Why we built it: back on the first screen, the sunlight plays again and the view pulls out to the whole Moon.
  await say('We built it so every student can learn how a real Moon mission is planned.');
  await page.evaluate(() => window.__game.close()); await page.click('#back'); await page.click('#a-play');
  const free = await page.evaluate(() => { const cv = document.getElementById('gl'); // a point of the Moon view that no label or card covers
    for (const [x, y] of [[1500, 430], [1650, 380], [1350, 470], [700, 430], [960, 520]]) if (document.elementFromPoint(x, y) === cv) return { x, y }; return null; });
  if (!free) errors.push('no free point on the Moon view to scroll out from');
  else { await page.mouse.move(free.x, free.y); for (let i = 0; i < 16; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(90); } mark('scrolled out to the whole Moon'); }
  await until(24.6);
  // The last scene: the project's name and address over the whole Moon, what it needs and who it is for.
  await page.evaluate(() => {
    const el = (css, text, into) => { const d = document.createElement('div'); d.style.cssText = css; d.textContent = text; into.appendChild(d); return d; };
    const dim = el('position:fixed;inset:0;z-index:98;pointer-events:none;font-family:system-ui;background:rgba(2,5,10,.8);display:flex;flex-direction:column;align-items:center;gap:30px;padding-top:255px;opacity:0;transition:opacity .45s', '', document.body);
    el('font-size:78px;font-weight:800;color:#fff', 'Lunar Landing Site Navigator', dim);
    el('font-size:60px;font-weight:700;color:#46e0c8', 'lunar-navigator-404.web.app', dim);
    el('font-size:34px;color:#e3e9f3', 'Free  ·  Any browser  ·  English, Russian, Kyrgyz', dim);
    requestAnimationFrame(() => { dim.style.opacity = 1; });
  });
  await say('No telescope, no lab: just a browser. Free, starting with schools here in Central Asia.', 'end'); await until(SECONDS);
  // Readable: at most 3.7 words a second for the time each caption really stayed on screen.
  caps.forEach((c, i) => { const on = (caps[i + 1]?.t ?? SECONDS) - c.t, w = c.text.split(/\s+/).length;
    console.log(`${c.t.toFixed(1).padStart(5)} s  ${(w / on).toFixed(1)} words/s  ${c.text}`);
    if (w / on > 3.7) errors.push(`caption too fast to read (${(w / on).toFixed(1)} words/s): ${c.text}`); });

  fs.writeFileSync(path.join(ROOT, 'docs', 'demo-captions.json'), JSON.stringify(caps.map((c, k) => ({ ...c, end: caps[k + 1]?.t ?? SECONDS })), null, 1) + '\n');
  recording = false; await capture;
  await browser.close(); srv.close();
  const total = Math.round(SECONDS * 25); // exactly 29.5 s at 25 fps: frame i is the newest capture taken by i * 40 ms
  for (let i = 0, k = 0; i < total; i++) {
    while (k + 1 < frames.length && frames[k + 1].t <= i * 40) k++;
    fs.linkSync(frames[k].f, path.join(FRAMES, `o${String(i).padStart(5, '0')}.jpg`));
  }
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', '25', '-i', path.join(FRAMES, 'o%05d.jpg'), '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', '20',
    '-metadata', 'comment=Screen footage and captions made with SI (AI) tools: Claude (Anthropic). ' + (process.env.VOICE_NOTE || 'Voice is synthetic') + '. Checked by team 404 agents.', DEST]);
  fs.rmSync(FRAMES, { recursive: true, force: true });
  console.log(`${frames.length} captures, ${(frames.length / SECONDS).toFixed(1)} per second`);
  if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
  console.log('wrote', DEST);
})();
