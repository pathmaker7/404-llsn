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
    window.__cap = box('left:50%;transform:translateX(-50%);bottom:230px;width:max-content;max-width:1500px;text-align:center;font-size:38px;font-weight:700;color:#fff;background:#000d;padding:14px 26px;border-radius:12px', '');
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
  // the lander at touchdown), 'high' over the battery game, 'low' on the site screen (above the time bar), 'bottom'
  // under the quiz card. Every caption is kept with the moment it appeared: after recording, each
  // must be readable in the time it stays on screen.
  const caps = [];
  const POS = { map: ['500px', 'auto', '50%', '1500px'], high: ['120px', 'auto', '50%', '1500px'], low: ['auto', '230px', '60%', '1300px'], bottom: ['auto', '24px', '50%', '1500px'] };
  const say = (text, pos = 'map') => (caps.at(-1)?.text !== text && caps.push({ text, t: (Date.now() - t0) / 1000 }), page.evaluate(([t, p]) => { const c = window.__cap; c.textContent = t; [c.style.top, c.style.bottom, c.style.left, c.style.maxWidth] = p; }, [text, POS[pos]]));
  const mark = (what) => console.log(`${((Date.now() - t0) / 1000).toFixed(1).padStart(5)} s  ${what}`);

  // Order follows the Space Apps project submission guide: [0:00] who we are, [0:02] the challenge, [0:05] the title and
  // tagline, [0:10] how it works with NASA data, [0:20-0:30] what it can do for people. The voice reads each caption word
  // for word (subtitles = speech), so each line is short enough to be spoken in the time it stays on screen.
  await say("Hi, we're team 404 agents from Naryn, Kyrgyzstan."); await until(3.1);
  await page.evaluate(() => window.__names.remove());
  await say('When can a Moon landing survive?');
  // My lander: the hats of Central Asia, tried on one after another, ending on the Kyrgyz ak kalpak.
  for (const h of ['kazakh', 'uzbek', 'tajik', 'kyrgyz']) { await page.click(`.kl-hat[data-hat="${h}"]`); await page.waitForTimeout(330); }
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
  await until(5.3);
  await say('Lunar Landing Site Navigator: pick a day, and your lander drops in.');
  await page.mouse.move(cell.x, cell.y, { steps: 10 }); await page.waitForTimeout(250); await page.mouse.click(cell.x, cell.y); mark('day clicked: the lander drops');
  await until(9.6);
  await say('Green means it survives, on real NASA terrain.');
  const dropped = await page.evaluate(() => window.__lander.last);
  if (!dropped || !dropped.ok) errors.push('the dropped lander did not survive on the green day: ' + JSON.stringify(dropped));
  await page.waitForFunction(() => window.__verdict && document.body.classList.contains('mode-surface') && !document.getElementById('fade').classList.contains('on'), null, { timeout: 60000 }); mark('on the site');
  if (!(await page.evaluate(() => window.__verdict.ok))) errors.push('the site panel does not say the mission survived');
  await say('Green means it survives, on real NASA terrain.', 'low'); await until(13.6);

  // Keep me alive: the battery game on this site and this landing day, at four times speed.
  await say('Play Keep me alive: the battery drains in real shadow.', 'high');
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
  await until(17.6);
  mark('game at ' + await page.evaluate(() => document.querySelector('.g-dayno')?.textContent));

  // Ice hunter: back on the map, a tap on the floor of Shackleton crater, which the model never sees sunlit.
  await say('Hunt dark craters where water ice could hide.');
  await page.evaluate(() => window.__game.close()); await page.click('#back'); await page.waitForTimeout(500);
  await page.click('#ice-btn'); await page.waitForTimeout(250);
  const ice = await page.evaluate(() => { const ov = window.__ov, cv = document.getElementById('gl'), r = cv.getBoundingClientRect(), s = ov.sites.find((x) => x.name === 'Shackleton floor');
    const v = s.pos.clone().project(ov.camera), sx = (v.x * 0.5 + 0.5) * r.width, sy = (-v.y * 0.5 + 0.5) * r.height;
    for (const [dx, dy] of [[0, 0], [0, 6], [6, 0], [-6, 0], [0, -6], [8, 8], [-8, 8], [0, 12], [12, 0], [-12, 0]]) { const px = sx + dx, py = sy + dy, at = ov.pick(px, py, r.width, r.height);
      if (at && document.elementFromPoint(r.left + px, r.top + py) === cv) return { x: r.left + px, y: r.top + py, lat: s.lat, lon: s.lon }; }
    return { lat: s.lat, lon: s.lon, x: r.left + sx, y: r.top + sy, covered: true }; });
  await page.mouse.move(ice.x, ice.y, { steps: 8 });
  if (ice.covered) await page.evaluate(([la, lo]) => { window.__ice.hunt(la, lo); }, [ice.lat, ice.lon]); else await page.mouse.click(ice.x, ice.y);
  await page.waitForFunction(() => window.__ice.phase === 'result', null, { timeout: 20000 }); mark('ice result' + (ice.covered ? ' (spot covered by a label: judged at the site point)' : ''));
  if ((await page.evaluate(() => window.__ice.last && window.__ice.last.cls)) !== 'dark' && !(await page.evaluate(() => window.__ice.marks.at(-1)?.cls === 'dark'))) errors.push('the ice hunter spot is not dark in the model');
  await until(21.0);

  // Quiz: a live question (the answer is computed by the app for a real site and day), answered right.
  await say('Then test yourself in the quiz.', 'bottom');
  await page.evaluate(() => window.__ice.setMode(false)); await page.click('.kq-btn');
  await page.evaluate(() => window.__quiz.start(['kQ16', 'kQ01', 'kQ04', 'kQ09', 'kQ11'])); await page.waitForSelector('.kq-opt'); await page.waitForTimeout(1100);
  const right = await page.evaluate(() => window.__quiz.text(window.__quiz.state.q).options.findIndex((o) => o.correct));
  await page.click(`.kq-opt[data-i="${right}"]`); mark('quiz answered');
  await until(23.6);

  // The proof shot: a real landing replayed. The box on the left shows what happened next to the model's sunrise and sunset.
  const real = 'For Chandrayaan-3, our sunset is the day India put it to sleep.';
  await say(real);
  await page.evaluate(() => window.__quiz.close());
  await page.selectOption('#a-famous', { label: 'Chandrayaan-3 (2023)' });
  await page.waitForFunction(() => window.__history && document.body.classList.contains('mode-surface') && !document.getElementById('fade').classList.contains('on'), null, { timeout: 60000 }); mark('Chandrayaan-3 site');
  await say(real, 'low'); await until(27.5);
  await say('Free for schools across Central Asia.', 'low'); await until(SECONDS);
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
