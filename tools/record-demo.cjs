// Records the demo footage for the 2-minute cut in docs/video-script.md (screen column, same timings).
// Output: docs/video/demo-footage.mp4 at 1920x1080, 25 fps. Frames are timestamped screenshots joined by the system
// ffmpeg (/opt/homebrew/bin/ffmpeg), so Playwright needs no video download. Voice and cards are joined afterwards.
// Run: node tools/record-demo.cjs
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const { execFileSync } = require('child_process');
const FFMPEG = '/opt/homebrew/bin/ffmpeg';

const OUT = path.join(__dirname, '..', 'docs', 'video');
const W = 1920, H = 1080;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const FRAMES = path.join(OUT, 'frames');
  fs.rmSync(FRAMES, { recursive: true, force: true }); fs.mkdirSync(FRAMES);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const t0 = Date.now();
  const frames = []; let recording = true;
  const capture = (async () => { // screenshot loop running alongside the scripted actions
    while (recording) {
      const f = path.join(FRAMES, `f${String(frames.length).padStart(5, '0')}.jpg`);
      try { await page.screenshot({ path: f, type: 'jpeg', quality: 85 }); frames.push({ f, t: Date.now() - t0 }); } catch (e) { /* page busy during navigation */ }
    }
  })();
  const until = async (sec) => { const wait = sec * 1000 - (Date.now() - t0); if (wait > 0) await page.waitForTimeout(wait); };
  const mark = (txt) => console.log(`${((Date.now() - t0) / 1000).toFixed(1).padStart(5)} s  ${txt}`);

  await page.goto('file://' + path.join(__dirname, '..', 'app', 'index.html'));
  await page.waitForFunction(() => window.__app && window.__app.sites.length > 0);
  mark('app loaded (title card covers 0:00 to 0:12 in the edit)');
  await until(12);

  mark('whole Moon, then back to the pole');
  await page.click('#viewGlobe'); await until(19);
  await page.click('#viewPole'); await until(25);

  mark('live shadows on, play the stay');
  await page.check('#shadowToggle');
  await page.click('#play'); await until(45);
  await page.click('#play');

  mark('Shackleton rim: table, Artemis III, panorama');
  await page.locator('#sites .site', { hasText: 'Shackleton rim' }).click();
  await page.locator('#table tr', { hasText: 'Shackleton rim' }).locator('span[title]').hover();
  await until(65);

  mark('neighbourhood map');
  await page.locator('#hoodBtn').scrollIntoViewIfNeeded();
  await page.click('#hoodBtn');
  await page.waitForFunction(() => window.__hood);
  await until(80);

  mark("add Chang'e 4 (far side) and Apollo 11");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.selectOption('#addPreset', "Chang'e 4 (far side)"); await until(87);
  await page.selectOption('#addPreset', 'Apollo 11'); await until(95);

  mark('comparison table, then end');
  await page.locator('#table').scrollIntoViewIfNeeded(); await until(110);
  await page.evaluate(() => window.scrollTo(0, 0)); await until(120);
  mark('done');

  recording = false; await capture;
  await browser.close();
  // Resample to exactly 25 fps: output frame i (time i * 40 ms) is the newest capture taken by then.
  const total = Math.round(frames[frames.length - 1].t / 40);
  for (let i = 0, k = 0; i <= total; i++) {
    while (k + 1 < frames.length && frames[k + 1].t <= i * 40) k++;
    fs.linkSync(frames[k].f, path.join(FRAMES, `o${String(i).padStart(5, '0')}.jpg`));
  }
  const dest = path.join(OUT, 'demo-footage.mp4');
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', '25', '-i', path.join(FRAMES, 'o%05d.jpg'), '-vf', 'format=yuv420p', '-c:v', 'libx264', dest]);
  fs.rmSync(FRAMES, { recursive: true, force: true });
  console.log(`${frames.length} frames, ${(frames.length / (frames[frames.length - 1].t / 1000)).toFixed(1)} captured per second`);
  if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
  console.log(`wrote ${dest}`);
  console.log('Join (after recording voice.m4a and exporting title.png / end.png from the deck):');
  console.log('ffmpeg -loop 1 -t 12 -i title.png -i docs/video/demo-footage.mp4 -loop 1 -t 10 -i end.png -i voice.m4a ' +
    '-filter_complex "[0:v]scale=1920:1080,setsar=1[a];[1:v]trim=12:110,setpts=PTS-STARTPTS,scale=1920:1080,setsar=1[b];[2:v]scale=1920:1080,setsar=1[c];[a][b][c]concat=n=3:v=1:a=0[v]" ' +
    '-map "[v]" -map 3:a -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest docs/demo.mp4');
})();
